import { Controller, Post, Body, Get, Headers, UseGuards ,UnauthorizedException, Ip } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';



@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Ip() ip: string) {
    return this.authService.login(loginDto, ip);
  }

  @UseGuards(JwtAuthGuard) // ป้องกันเส้นทางนี้ด้วย JWT Auth Guard
  @Post('logout')
  async logout(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }
    // 2. ดึงเฉพาะตัว Token ออกมา (ตัดคำว่า "Bearer " ทิ้ง)
    const token = authHeader.split(' ')[1];

    // 3. ส่ง Token เพียวๆ ไปให้ Service ทำงานต่อ
    return this.authService.logout(token);
  }
}
