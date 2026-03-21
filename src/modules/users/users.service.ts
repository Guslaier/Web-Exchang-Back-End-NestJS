import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  CreateUserDto,
  ChangePasswordDto,
  UpdateUserDto,
} from './dto/user.dto';
import { User } from './entities/user.entity';
import { Not, Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.module';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) // ใช้ @Inject แทนการ new เอง
    private readonly redisClient: Redis,
  ) {}

  private checkPermission(currentUser: any, targetUser: User, action: string) {
    if (targetUser.role === 'ADMIN') {
      throw new ForbiddenException(`Cannot ${action} an ADMIN`);
    }

    if (currentUser.id === targetUser.id) {
      throw new ForbiddenException(`You cannot ${action} yourself`);
    }

    if (currentUser.role === 'EMPLOYEE') {
      throw new ForbiddenException(
        'Employees have no permission for this action',
      );
    }

    if (currentUser.role === 'MANAGER' && targetUser.role !== 'EMPLOYEE') {
      throw new ForbiddenException('Managers can only manage Employees');
    }
  }
  // +++++ฟังก์ชันลงทะเบียนผู้ใช้ใหม่ โดยจะสร้างรหัสผ่านแบบสุ่มและแฮชก่อนบันทึกลงฐานข้อมูล++++++
  async register(userDto: CreateUserDto) {
    // ตรวจสอบว่าผู้ใช้มีอยู่แล้วหรือไม่
    const existingUser = await this.userRepository.findOne({
      where: { email: userDto.email },
    });

    if (existingUser) {
      throw new UnauthorizedException('Email already in use');
    }

    return this.create(userDto);
  }

  // ฟังก์ชันสร้างผู้ใช้ใหม่ โดยจะสร้างรหัสผ่านแบบสุ่มและแฮชก่อนบันทึกลงฐานข้อมูล
  async create(createUserDto: CreateUserDto) {
    // 1. สร้างรหัสผ่านดิบ (Raw Password) และเก็บไว้
    const rawPassword = crypto.randomBytes(6).toString('base64').slice(0, 8);

    // 2. แฮชรหัสผ่านแบบ Asynchronous (ไม่บล็อก Event Loop)
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 3. สร้าง Entity และบันทึกลงฐานข้อมูล
    const user = this.userRepository.create({
      email: createUserDto.email,
      username: createUserDto.username,
      role: createUserDto.role,
      phoneNumber: createUserDto.phoneNumber,
      passwordHash: passwordHash,
    });

    // 4. บันทึกลงฐานข้อมูล
    const savedUser = await this.userRepository.save(user);

    // 5. คืนค่า User ที่บันทึกเสร็จ พร้อมกับ Raw Password
    return {
      user: {
        id: savedUser.id,
        email: savedUser.email,
        username: savedUser.username,
        role: savedUser.role,
        phoneNumber: savedUser.phoneNumber,
        isActive: savedUser.isActive,
        createdAt: savedUser.createdAt,
        updatedAt: savedUser.updatedAt,
      },
      generatedPassword: rawPassword, // สำคัญมาก ไม่งั้น User จะล็อกอินไม่ได้
    };
  }

  // ฟังก์ชันดึงข้อมูลผู้ใช้ทั้งหมด
  async findAll() {
    const users = await this.userRepository.find({
      select: [
        'id',
        'email',
        'username',
        'role',
        'phoneNumber',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
    });
    if (users.length === 0) {
      throw new NotFoundException('No users found');
    }
    return users;
  }

  // ฟังก์ชันดึงข้อมูลผู้ใช้ตาม ID
  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'username',
        'role',
        'phoneNumber',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
    });
    if (!user) {
      throw new NotFoundException(`User ID ${id} not found`);
    }
    return user;
  }

  async findOneByEmail(email: string) {
    const user = await this.userRepository.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'username',
        'role',
        'phoneNumber',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
    });
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  async findOneWithPassword(email: string) {
    // ฟังก์ชันนี้จะใช้สำหรับการตรวจสอบผู้ใช้ตอน Login เท่านั้น
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
    return user;
  }

  //+++++++++++++++++++++++++++ ฟังก์ชันอัปเดตข้อมูลผู้ใช้ (ไม่รวมรหัสผ่าน)++++++++++++++++++++++++++++++
  async update(currentUser: any, id: string, updateUserDto: UpdateUserDto) {
    // ควรใช้ UpdateUserDto

    if (
      !(updateUserDto.role === 'MANAGER' || updateUserDto.role === 'EMPLOYEE')
    ) {
      throw new BadRequestException(
        `Invalid role ${updateUserDto.role}. Role must be either 'MANAGER' or 'EMPLOYEE'.`,
      );
    }
    // ตรวจสอบว่าผู้ใช้ที่ต้องการอัปเดตมีอยู่จริงหรือไม่
    const existingUser = await this.userRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new BadRequestException(`User ID ${id} not found`);
    }
    // ตรวจสอบว่ามีผู้ใช้คนอื่นที่ใช้ email เดียวกันหรือไม่ (ถ้า email ถูกเปลี่ยน)
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailInUse = await this.userRepository.findOne({
        where: { email: updateUserDto.email, id: Not(id) },
      });
      if (emailInUse) {
        throw new ConflictException(
          `Email ${updateUserDto.email} is already in use by another user`,
        );
      }
    }

    //ห้ามแก้ตัวเอง (กัน elevate privilege)
    if (currentUser.id === id && updateUserDto.role) {
      throw new ForbiddenException('You cannot change your own role');
    }

    //EMPLOYEE ห้ามแก้ role
    if (currentUser.role === 'EMPLOYEE') {
      throw new ForbiddenException('No permission');
    }

    //MANAGER แก้ได้เฉพาะ EMPLOYEE
    if (currentUser.role === 'MANAGER') {
      if (existingUser.role !== 'EMPLOYEE') {
        throw new ForbiddenException('Manager can only update employee');
      }

      if (updateUserDto.role === 'MANAGER') {
        throw new ForbiddenException('Manager cannot promote to manager');
      }
    }

    //กันแก้ ADMIN
    if (existingUser.role === 'ADMIN') {
      throw new ForbiddenException('Cannot modify admin');
    }

    const res = await this.userRepository.update(id, {
      email: updateUserDto.email,
      username: updateUserDto.username,
      phoneNumber: updateUserDto.phoneNumber,
      role: updateUserDto.role,
    });
    if (res.affected === 0) {
      throw new NotFoundException(`User ID ${id} not found`);
    }
    return this.findOne(id);
  }

  //+++++++++++++++++++++++++++ ฟังก์ชันลบผู้ใช้ (Soft Delete)+++++++++++++++++++++++++++++++
  async remove(currentUser: any, id: string) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      // 1. ค้นหา User ที่ต้องการจะลบก่อน
      const user = await userRepo.findOne({ where: { id } });

      if (!user) {
        throw new BadRequestException(`ไม่พบผู้ใช้งาน ID: ${id}`);
      }
      //ห้ามลบตัวเอง
      if (currentUser.id === id) {
        throw new ForbiddenException('You cannot delete yourself');
      }

      this.checkPermission(currentUser, user, 'delete');

      if (user.role === 'ADMIN') {
        const AdminCount = await userRepo.count({
          where: { role: 'ADMIN', id: Not(id) },
        });
        if (AdminCount <= 1) {
          throw new ForbiddenException('Cannot delete the last admin user');
        }
      }
      // 2. สร้าง String สำหรับต่อท้ายอีเมล
      // ผลลัพธ์จะได้ประมาณ: test@mail.com_deleted_1710756000
      const mutatedEmail = `${user.email}_deleted_${Date.now()}`;
      // 3. อัปเดตอีเมลใหม่ลงไปใน Database
      await userRepo.update(id, { email: mutatedEmail });
      // 4. สั่ง Soft Delete ตามปกติได้เลย!
      const res = await userRepo.softDelete(id);
      if (res.affected === 0) {
        throw new BadRequestException(`User ID ${id} not found`);
      }
      return { message: `User ID ${id} removed successfully` };
    });
  }

  //+++++++++++++++++++++++++++ ฟังก์ชันเปลี่ยนรหัสผ่านผู้ใช้++++++++++++++++++++++++++++
  // +++++++++++++++++++++++++++ ฟังก์ชันเปลี่ยนรหัสผ่านผู้ใช้ ++++++++++++++++++++++++++++
  async changePassword(
    currentUser: any, // ข้อมูลจาก JWT Strategy (User ที่ Login อยู่)
    newPassword: string,
    oldPassword: string,
  ) {
    // 1. ดึงข้อมูล User "ของตัวเอง" เท่านั้น
    const user = await this.userRepository.findOne({
      where: { id: currentUser.id }, // ใช้ id จาก Token เท่านั้น ปลอดภัยกว่า
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    // 2. เช็ครหัสผ่านเดิม (Old Password)
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      // ใช้ Unauthorized หรือ Forbidden เพื่อบอกว่ารหัสผ่านเดิมไม่ถูกต้อง
      throw new UnauthorizedException('Old password incorrect');
    }

    // 3. แฮชรหัสผ่านใหม่
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // 4. อัปเดตลงฐานข้อมูล
    await this.userRepository.update(currentUser.id, { passwordHash });

    return { message: 'Password updated successfully' };
  }

  //+++++++++++++++++++++++++++ ฟังก์ชันรีเซ็ตรหัสผ่าน +++++++++++++++++++++++++++++
  async requestResetPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      return { message: 'If email exists, reset token sent' };
    }
    const token = crypto.randomBytes(32).toString('hex');

    // เก็บใน Redis (หมดอายุ 15 นาที)
    await this.redisClient.set(`reset:${token}`, user.id, 'EX', 60 * 15);

    return { message: 'Reset token sent', token }; // ในระบบจริงจะส่งอีเมลพร้อมลิงก์ที่มี token แทนการส่ง token กลับมาโดยตรง
  }

  //+++++++++++++++++++++++++++ ฟังก์ชันรีเซ็ตรหัสผ่าน (Reset Password)+++++++++++++++++++++++++++++
  async resetPassword(email: string, token: string, newPassword: string) {
    const userId = await this.redisClient.get(`reset:${token}`);

    if (!userId) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId, email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.userRepository.update(userId, { passwordHash });
    await this.redisClient.del(`reset:${token}`);

    return { message: 'Password reset successful' };
  }

  //+++++++++++++++++++++++++++ ฟังก์ชันปิดการใช้งานผู้ใช้ (Deactivate) ++++++++++++++++++++++++++++
  async deactivate(currentUser: any, id: string) {
    const user = await this.findOne(id);

    if (!user.isActive) {
      return { message: 'User is already inactive' };
    }
    this.checkPermission(currentUser, user, 'deactivate');
    await this.userRepository.update(id, { isActive: false });
    return { message: 'User deactivated successfully' };
  }

  //+++++++++++++++++++++++++++ ฟังก์ชันเปิดใช้งานผู้ใช้ (Reactivate) ++++++++++++++++++++++++++++
  async reactivate(currentUser: any, id: string) {
    const user = await this.findOne(id);
    if (user.isActive) {
      return { message: 'User is already active' };
    }
    this.checkPermission(currentUser, user, 'reactivate');

    await this.userRepository.update(id, { isActive: true });
    
    return { message: 'User reactivated successfully' };
  }
}
