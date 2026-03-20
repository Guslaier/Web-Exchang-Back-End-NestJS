import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBoothDto, UpdateBoothDto } from './dto/booth.dto';
import { Booth } from './entities/booth.entity';
import { User } from '../users/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class BoothsService {
  constructor(
    @InjectRepository(Booth)
    private readonly boothRepository: Repository<Booth>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  //การใช้ Transaction ในการลบ Booth แบบ Soft Delete พร้อมเปลี่ยนชื่อเพื่อหลีกเลี่ยง Unique Constraint ***
  async create(createBoothDto: CreateBoothDto) {
    const existingBooth = await this.boothRepository.findOne({
      where: { name: createBoothDto.name },
    });
    if (existingBooth) {
      // ใช้ ConflictException แทน BadRequest
      throw new ConflictException('Booth name already exists', { cause: 'BOOTH_NAME_ALREADY_EXISTS' });
    }
    const booth = this.boothRepository.create({
      name: createBoothDto.name || `Booth-${Date.now()}`,
      location: createBoothDto.location,
    });
    return this.boothRepository.save(booth);
  }

  async findAll() {
    return await this.boothRepository.find();
  }

  //การเช็คข้อมูลก่อนทำงาน และการโยน Error ที่มี Cause เพื่อให้ Frontend สามารถแยกแยะได้ง่ายขึ้น ***
  async findOne(id: string) {
    const booth = await this.boothRepository.findOne({ where: { id } });
    if (!booth) {
      throw new NotFoundException('Booth not found', { cause: 'BOOTH_NOT_FOUND' });
    }
    return booth;
  }

  //การเช็คข้อมูลก่อนทำงาน และการโยน Error ที่มี Cause เพื่อให้ Frontend สามารถแยกแยะได้ง่ายขึ้น ***
  async update(id: string, updateBoothDto: UpdateBoothDto) {
    const booth = await this.findOne(id); // เรียกใช้ findOne ที่ปรับใหม่

    // ถ้ามีการเปลี่ยนชื่อ ให้เช็คว่าชื่อใหม่ซ้ำกับ Booth อื่นหรือไม่
    if (updateBoothDto.name && updateBoothDto.name !== booth.name) {
      const existingBooth = await this.boothRepository.findOne({
        where: { name: updateBoothDto.name },
      });
      if (existingBooth) {
        throw new ConflictException('Booth name already exists', { cause: 'BOOTH_NAME_ALREADY_EXISTS' });
      }
    }
    // ถ้าอัพเดตสำเร็จ ให้คืนค่า Booth ที่อัพเดตแล้วกลับไป
    if (await this.boothRepository.update(id, updateBoothDto)) {
      return this.findOne(id); // เรียกใช้ findOne เพื่อดึงข้อมูล Booth ที่อัพเดตแล้วกลับไป
    }
    throw new BadRequestException('Failed to update booth', { cause: 'FAILED_TO_UPDATE_BOOTH' });
  }

  // การลบ Booth แบบ Soft Delete พร้อมเปลี่ยนชื่อเพื่อหลีกเลี่ยง Unique Constraint และใช้ Transaction เพื่อความปลอดภัยของข้อมูล ***
  async remove(id: string) {
    // 1. เช็คข้อมูลก่อน (Pre-check)
    const booth = await this.findOne(id); // เรียกใช้ findOne ที่ปรับใหม่
    
    if (booth.currentShiftId) {
      throw new ForbiddenException('Cannot delete booth with an active shift', { cause: 'ACTIVE_SHIFT_EXISTS' });
    }

    // 2. Transaction
    return await this.dataSource.transaction(async (manager) => {
      try {
        const deleteTime = Date.now();
        const mutatedName = `${booth.name}_deleted_${deleteTime}`;

        // ขั้นตอนที่ 1: เปลี่ยนชื่อ
        await manager.update(Booth, id, { name: mutatedName });

        // ขั้นตอนที่ 2: Soft Delete
        const result = await manager.softDelete(Booth, id);

        if (result.affected === 0) {
          throw new BadRequestException('Delete operation failed', { cause: 'DELETE_OPERATION_FAILED' });
        }
        
        return { message: 'Booth removed successfully' };
      } catch (err: any) {
        // ถ้าเป็น HttpException (เช่น BadRequest) ให้โยนออกไปเลย
        if (err instanceof BadRequestException || err instanceof ForbiddenException) {
          throw err;
        }
        // ถ้าเป็น Error อื่นๆ ให้หุ้มด้วยข้อความที่อ่านง่าย
        throw new BadRequestException(`Failed to delete booth: ${err.message}`, { cause: 'FAILED_TO_DELETE_BOOTH' });
      }
    });
  }

  // การเช็คข้อมูลก่อนทำงาน และการโยน Error ที่มี Cause เพื่อให้ Frontend สามารถแยกแยะได้ง่ายขึ้น ***
  async setDeActive(id: string) {
    const booth = await this.findOne(id); 
    if (booth.currentShift) {
      throw new ForbiddenException('Cannot deactivate booth with active shift', { cause: 'ACTIVE_SHIFT_EXISTS' });
    }
    if (booth.isOpen) {
        throw new ForbiddenException('Cannot deactivate booth that is already open', { cause: 'BOOTH_ALREADY_OPEN' });
    }
    if (!booth.isActive) {
      throw new ForbiddenException('Booth is already inactive', { cause: 'BOOTH_ALREADY_INACTIVE' });
    }

    await this.boothRepository.update(id, { isActive: false });
    return { message: 'Booth deactivated successfully' };
  }


  // การเช็คข้อมูลก่อนทำงาน และการโยน Error ที่มี Cause เพื่อให้ Frontend สามารถแยกแยะได้ง่ายขึ้น ***
  async setReActive(id: string) {
    const booth = await this.findOne(id);

    // ห้ามเปลี่ยนสถานะของ Booth ที่ไม่ Active
    if (booth.isActive) {
      throw new ForbiddenException('Booth is already active', { cause: 'BOOTH_ALREADY_ACTIVE' });
    }
    await this.boothRepository.update(id, { isActive: true });
    return { message: 'Booth activated successfully' };
  }


  // การเช็คข้อมูลก่อนทำงาน และการโยน Error ที่มี Cause เพื่อให้ Frontend สามารถแยกแยะได้ง่ายขึ้น ***
  async setStatus(id: string, isOpen: boolean) {
    const booth = await this.findOne(id);

    // ห้ามเปลี่ยนสถานะของ Booth ที่ไม่ Active
    if (!booth.isActive) {
        throw new ForbiddenException('Cannot change status of inactive booth', { cause: 'BOOTH_NOT_ACTIVE' });
    }

    if (booth.isOpen === isOpen) {
      throw new ForbiddenException(
        `Booth is already ${isOpen ? 'open' : 'closed'}`,
        { cause: isOpen ? 'BOOTH_ALREADY_OPEN' : 'BOOTH_ALREADY_CLOSED' }
      );
    }

    // ถ้าอัพเดตสำเร็จ ให้คืนค่า Message กลับไป
    if (await this.boothRepository.update(id, { isOpen })) {
      return { message: `Booth ${isOpen ? 'opened' : 'closed'} successfully` };
    }
    throw new BadRequestException(
      `Failed to ${isOpen ? 'open' : 'close'} booth`,
      { cause: isOpen ? 'FAILED_TO_OPEN_BOOTH' : 'FAILED_TO_CLOSE_BOOTH' }
    );
  }


  // การเช็คข้อมูลก่อนทำงาน และการโยน Error ที่มี Cause เพื่อให้ Frontend สามารถแยกแยะได้ง่ายขึ้น ***
  async setCurrentShift(id: string, shiftId: string | null) {
    const booth = await this.findOne(id);
    // ถ้า shiftId เป็น null หมายความว่าต้องการเคลียร์ current shift ออกจาก booth นี้
    if (shiftId === null) {
      if (await this.boothRepository.update(id, { currentShift: null })) {
        return { message: 'Current shift cleared successfully' };
      }
      throw new BadRequestException('Failed to clear current shift', { cause: 'FAILED_TO_CLEAR_CURRENT_SHIFT' });
    }

    // ถ้า shiftId ไม่ใช่ null ให้ทำการเช็คข้อมูลของ User ที่จะถูกกำหนดให้เป็น current shift
    const user = await this.userRepository.findOne({ where: { id: shiftId } });
    if (!user) {
      throw new NotFoundException('User not found', { cause: 'USER_NOT_FOUND' });
    }
    if(!user.isActive) {
      throw new ForbiddenException('User is not active', { cause: 'USER_NOT_ACTIVE' });
    }
    // ตรวจสอบว่า User ที่จะถูกกำหนดเป็น current shift มี Role เป็น EMPLOYEE หรือไม่
    if (user.role !== 'EMPLOYEE') {
      throw new ForbiddenException('User is not a staff member', { cause: 'USER_NOT_EMPLOYEE' });
    }

    // ตรวจสอบว่า User ที่จะถูกกำหนดเป็น current shift มี Booth อื่นที่กำลังทำงานอยู่หรือไม่
    if (booth.currentShiftId === shiftId) {
      throw new BadRequestException('User is already assigned to this booth', { cause: 'USER_ALREADY_ASSIGNED' });
    }

    const alreadyAssignedBooth = await this.boothRepository.findOne({
      where: { currentShiftId: shiftId },
    });
    // ถ้า User นี้มี Booth อื่นที่กำลังทำงานอยู่ และ Booth นั้นไม่ใช่ Booth เดิมที่กำลังอัพเดตอยู่ ให้โยน Error
    if (alreadyAssignedBooth && alreadyAssignedBooth.id !== id) {
      throw new BadRequestException(
        'User is already assigned to another booth',
        { cause: 'USER_ALREADY_ASSIGNED_ANOTHER_BOOTH' }
      );
    }


    // ถ้าอัพเดตสำเร็จ ให้คืนค่า Message กลับไป
    if (await this.boothRepository.update(id, { currentShiftId: shiftId })) {
      return { message: 'User assigned to booth successfully' };
    }
    throw new BadRequestException('Failed to assign user to booth', { cause: 'FAILED_TO_ASSIGN_USER' });
  }


  async findBoothByShiftId(shiftId: string) {
    if (!shiftId) {
      return null;
    }
    const booth = await this.boothRepository.findOne({
      where: { currentShiftId: shiftId },
      select: ['id', 'name', 'location', 'isActive', 'isOpen'],
    });
    if (!booth) {
      return null;
    }
    return booth;
  }
}
