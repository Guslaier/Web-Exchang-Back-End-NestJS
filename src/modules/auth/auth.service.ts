import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { LoginDto } from './dto/login.dto';

import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  // เชื่อมต่อ Redis (ในการใช้งานจริง ควรดึง URL จาก .env)
  private redisClient = new Redis(
    `redis://localhost:${process.env.REDIS_PORT || 6379}`,
  );

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findOneWithPassword(email);
    if (!user || !user.passwordHash) {
      return null;
    }
    const checkPassword = await bcrypt.compare(password, user.passwordHash);
    if (checkPassword) {
      const { passwordHash, ...result } = user;

      return result;
    }
    return null;
  }

  // ระบบlogin ที่จะรับข้อมูล username และ password

  async login(loginDto: LoginDto) {
    // 1. ตรวจสอบข้อมูลผู้ใช้

    const validatedUser = await this.validateUser(
      loginDto.email,
      loginDto.password,
    );

    // 2. หากข้อมูลไม่ถูกต้อง ให้โยนข้อผิดพลาด

    if (!validatedUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // ตรวจสอบว่าบัญชีผู้ใช้ถูกปิดใช้งานหรือไม่
    if (!validatedUser.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    // 3. สร้าง Payload สำหรับ JWT โดยจะเก็บข้อมูลที่จำเป็น เช่น email, id, role และ jti (JWT ID สำหรับแบน token)
    const payload = {
      email: validatedUser.email,
      id: validatedUser.id,
      role: validatedUser.role,
      jti: crypto.randomUUID(), // JWT ID สำหรับใช้ในการแบน token
    };

    // 4. สร้างและส่งกลับ access token โดยใช้ JwtService

    return {
      access_token: this.jwtService.sign(payload),
      user: validatedUser, // ส่งข้อมูลผู้ใช้ที่ได้รับการตรวจสอบแล้วกลับไปด้วย (ไม่รวม passwordHash)
    };
  }

  async logout(token: string) {
    // 1. ถอดรหัส Token เพื่อดูข้อมูลข้างใน (โดยไม่เช็ค signature เพราะแค่จะดูเวลาหมดอายุ)
    const decoded: any = this.jwtService.decode(token);
    console.log('Decoded JWT:', decoded);
    if (decoded && decoded.exp) {
      // 2. คำนวณเวลาที่เหลืออยู่ (เป็นวินาที)
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const remainingTime = decoded.exp - currentTimeInSeconds;

      // 3. ถ้าเวลายังเหลือ ให้เก็บลง Redis
      if (remainingTime > 0) {
        // คำสั่ง set(key, value, 'EX', เวลาวินาที) -> 'EX' คือ Expire Time (TTL)
        await this.redisClient.set(
          `blacklist:${decoded.jti}`,
          'true',
          'EX',
          remainingTime,
        );
      }
    }
    return { message: 'Logged out successfully' };
  }

  // ฟังก์ชันให้ Strategy เรียกเช็ค
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    // ไปหาใน Redis ว่ามี Key นี้ไหม
    const result = await this.redisClient.get(`blacklist:${jti}`);
    return result === 'true'; // ถ้าเจอแปลว่าโดนแบน
  }
}
