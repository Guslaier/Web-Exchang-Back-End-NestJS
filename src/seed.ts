import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './modules/users/entities/user.entity'; // ตรวจสอบ Path ให้ตรงกับไฟล์ของคุณ
import * as bcrypt from 'bcrypt';
import { UserDto } from './modules/users/dto/user.dto';


async function bootstrap() {
  // 1. สร้าง Application Context (เป็นการปลุก NestJS ขึ้นมาทำงานแบบไม่มี HTTP Server)
  const app = await NestFactory.createApplicationContext(AppModule);

  // 2. ขอเรียกใช้งาน Repository ของ User จาก TypeORM
  const userRepository = app.get(getRepositoryToken(User));

  console.log('🌱 เริ่มต้นการนำเข้าข้อมูล (Seeding)...');

  try {
    // 3. ตรวจสอบก่อนว่ามีข้อมูลในระบบหรือยัง
    const count = await userRepository.count();
    console.log(`🔍 พบผู้ใช้ทั้งหมด ${count} คนในระบบ`);
    if (count === 0) {
      // 4. สร้างข้อมูลเริ่มต้น
       const passwordHash = await bcrypt.hash('Admin@123', 10);
      const defaultAdmin = userRepository.create({
        email: 'admin@m.exchang.com',
        username: 'Admin',
        role: <UserDto['role']>'ADMIN',
        phoneNumber: '0000000000',
        passwordHash: passwordHash,
      });

      const secAdminPasswordHash = await bcrypt.hash('SecAdmin@123', 10);
      const secAdmin = userRepository.create({
        email: 'secadmin@m.exchang.com',
        username: 'SecAdmin',
        role: <UserDto['role']>'ADMIN',
        phoneNumber: '1111111111',
        passwordHash: secAdminPasswordHash,
      });

      await userRepository.save([defaultAdmin, secAdmin]);
      console.log('✅ สร้างข้อมูลผู้ดูแลระบบเริ่มต้นสำเร็จ!');
    } else {
      console.log('⚠️ มีข้อมูลในระบบอยู่แล้ว ข้ามการสร้างข้อมูลเริ่มต้น');
    }
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการ Seed ข้อมูล:', error);
  } finally {
    // 5. ปิดการทำงาน (สำคัญมาก ไม่งั้น Script จะค้าง)
    await app.close();
  }
}

bootstrap();