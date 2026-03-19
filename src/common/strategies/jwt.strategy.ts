import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {AuthService} from '../../modules/auth/auth.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserData } from 'index';

@Injectable()
// JwtStrategy ใช้สำหรับตรวจสอบและยืนยันตัวตนของผู้ใช้โดยใช้ JSON Web Token (JWT) 
// ซึ่งจะถูกส่งมาพร้อมกับคำขอ (request) ในรูปแบบของ Bearer token 
// ใน header ของ HTTP request


// สร้าง JwtStrategy โดยสืบทอดจาก PassportStrategy และระบุว่าเราจะใช้กลยุทธ์ 'jwt'
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private authService: AuthService) {
    super({
      // กำหนดวิธีการดึง JWT จาก header ของ HTTP request โดยใช้ ExtractJwt.fromAuthHeaderAsBearerToken()
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // กำหนด secret key ที่ใช้ในการตรวจสอบความถูกต้องของ JWT โดยดึงค่าจาก configuration
      secretOrKey: (config.get('jwt') as any).secret,
    });
  }

  // ฟังก์ชัน validate จะถูกเรียกโดย Passport หลังจากที่ JWT ถูกตรวจสอบแล้วว่าเป็นของแท้และยังไม่หมดอายุ
  async validate(payload: any) {
    // สิ่งที่ return จะถูกแนบเป็น req.user

    // ตรวจสอบว่า token นี้ถูก blacklist หรือไม่ (เช่น ถูก logout ไปแล้ว)
    if (await this.authService.isTokenBlacklisted(payload.jti)) {
      return null;
    }
    const user: Pick<UserData, 'email' | 'id' | 'role'> = {
      email: payload.email,
      id: payload.id,
      role: payload.role,
    };
    return user;
  }
}