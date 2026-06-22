import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { DataSource } from 'typeorm';
import { UserRole } from 'index';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private dataSource: DataSource,
    @Inject(SystemLogsService)
    private readonly systemLogsService: SystemLogsService,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
    private configService: ConfigService,
  ) { }

  // ตรวจสอบรหัสผ่าน
  async validateUser(email: string, password: string): Promise<any> {
    try {
      const user = await this.usersService.findOneWithPassword(email);
      if (!user || !user.passwordHash) return null;

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (isMatch) {
        const { passwordHash, ...result } = user;
        return result;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  // ระบบ Login พร้อม Session/Device Mapping
  async login(loginDto: LoginDto, ip: string = 'Unknown IP', userAgent: string = 'Unknown') {
    const validatedUser = await this.validateUser(loginDto.email, loginDto.password);

    if (!validatedUser) {
      await this.systemLogsService.createLog(null, {
        userId: null,
        action: 'LOGIN_FAILED',
        details: `Invalid credentials for email: ${loginDto.email}`,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!validatedUser.isActive) {
      await this.systemLogsService.createLog(validatedUser, {
        userId: validatedUser.id,
        action: 'LOGIN_FAILED',
        details: `Account deactivated: ${validatedUser.email}`,
      });
      throw new UnauthorizedException('User account is deactivated');
    }

    return await this.dataSource.transaction(async (manager) => {
      const sessionId = crypto.randomUUID();
      const refreshJti = crypto.randomUUID();

      const payload = {
        email: validatedUser.email,
        id: validatedUser.id,
        role: validatedUser.role as UserRole,
        sessionId,
      };

      const accessToken = this.jwtService.sign(payload);

      const refreshSecret = this.configService.get<string>('jwt.refreshSecret') || 'change_this_refresh_secret';
      const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') || '14h';

      let ttlSeconds = 14 * 3600;
      if (refreshExpiresIn.endsWith('h')) {
        ttlSeconds = parseInt(refreshExpiresIn) * 3600;
      } else if (refreshExpiresIn.endsWith('d')) {
        ttlSeconds = parseInt(refreshExpiresIn) * 86400;
      } else if (refreshExpiresIn.endsWith('m')) {
        ttlSeconds = parseInt(refreshExpiresIn) * 60;
      }

      const absoluteExp = Math.floor(Date.now() / 1000) + ttlSeconds;

      const refreshToken = this.jwtService.sign(
        { ...payload, jti: refreshJti, session_exp: absoluteExp },
        { secret: refreshSecret, expiresIn: ttlSeconds }
      );

      const sessionData = {
        ip,
        userAgent,
        currentRefreshJti: refreshJti,
        absoluteExp,
      };

      await this.redisClient.set(
        `session:${validatedUser.id}:${sessionId}`,
        JSON.stringify(sessionData),
        'EX',
        ttlSeconds
      );

      await this.systemLogsService.createLog(
        validatedUser,
        {
          userId: validatedUser.id,
          action: 'LOGIN_SUCCESS',
          details: `User logged in from IP: ${ip}, Device: ${userAgent}`,
        },
        manager,
      );

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: validatedUser,
      };
    });
  }

  // ระบบ Refresh Token Rotation (Reuse Detection)
  async refreshToken(token: string, ip: string, userAgent: string) {
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret') || 'change_this_refresh_secret';
    let decoded: any;
    try {
      decoded = this.jwtService.verify(token, { secret: refreshSecret });
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { id, sessionId, jti, session_exp } = decoded;

    const sessionKey = `session:${id}:${sessionId}`;
    const sessionStr = await this.redisClient.get(sessionKey);
    if (!sessionStr) {
      const revokedReason = await this.redisClient.get(`revoked:${sessionId}`);
      if (revokedReason) {
        throw new UnauthorizedException(revokedReason);
      }
      throw new UnauthorizedException('SESSION_EXPIRED');
    }

    const sessionData = JSON.parse(sessionStr);

    if (sessionData.currentRefreshJti !== jti) {
      // Token reuse detected! Revoke session
      await this.redisClient.set(`revoked:${sessionId}`, 'SESSION_REVOKED_REUSE', 'EX', 120);
      await this.redisClient.del(sessionKey);
      await this.systemLogsService.createLog({ id } as any, {
        userId: id,
        action: 'SECURITY_ALERT',
        details: `Refresh token reuse detected. Session revoked. IP: ${ip}`,
      });
      throw new UnauthorizedException('SESSION_REVOKED_REUSE');
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime >= sessionData.absoluteExp) {
      await this.redisClient.del(sessionKey);
      throw new UnauthorizedException('Absolute session expired. Please log in again.');
    }

    const newRefreshJti = crypto.randomUUID();

    const payload = {
      email: decoded.email,
      id: decoded.id,
      role: decoded.role,
      sessionId,
    };

    const newAccessToken = this.jwtService.sign(payload);

    const remainingSeconds = sessionData.absoluteExp - currentTime;

    const newRefreshToken = this.jwtService.sign(
      { ...payload, jti: newRefreshJti, session_exp: sessionData.absoluteExp },
      { secret: refreshSecret, expiresIn: remainingSeconds }
    );

    sessionData.currentRefreshJti = newRefreshJti;
    await this.redisClient.set(sessionKey, JSON.stringify(sessionData), 'EX', remainingSeconds);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  // ระบบ Logout
  async logout(token: string) {
    let decoded: any;
    try {
      decoded = this.jwtService.decode(token);
    } catch (e) {
      throw new UnauthorizedException('Invalid token format');
    }

    if (!decoded || !decoded.sessionId || !decoded.id) {
      throw new UnauthorizedException('Invalid token');
    }

    return await this.dataSource.transaction(async (manager) => {
      await this.redisClient.del(`session:${decoded.id}:${decoded.sessionId}`);

      await this.systemLogsService.createLog(
        { id: decoded.id } as any,
        {
          userId: decoded.id,
          action: 'LOGOUT_SUCCESS',
          details: `Session terminated (SessionId: ${decoded.sessionId})`,
        },
        manager,
      );

      return { message: 'Logged out successfully' };
    });
  }

  // เช็ค Whitelist จาก Redis
  async isSessionActive(userId: number, sessionId: string): Promise<boolean> {
    const result = await this.redisClient.get(`session:${userId}:${sessionId}`);
    if (result) {
      return true;
    }

    // If session is not active, check if there's a specific revocation reason
    const revokedReason = await this.redisClient.get(`revoked:${sessionId}`);
    if (revokedReason) {
      throw new UnauthorizedException(revokedReason);
    }

    // Default expiration
    throw new UnauthorizedException('SESSION_EXPIRED');
  }
}
