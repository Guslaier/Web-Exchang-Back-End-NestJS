import { BadRequestException, Injectable } from '@nestjs/common';
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

  async create(createBoothDto: CreateBoothDto) {
    const existingBooth = await this.boothRepository.findOne({
      where: { name: createBoothDto.name },
    });
    if (existingBooth) {
      throw new BadRequestException('Booth name already exists');
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

  async findOne(id: string) {
    const booth = await this.boothRepository.findOne({ where: { id } });
    if (!booth) {
      throw new BadRequestException('Booth not found');
    }
    return booth;
  }

  async update(id: string, updateBoothDto: UpdateBoothDto) {
    const booth = await this.boothRepository.findOne({ where: { id } });
    if (!booth) {
      throw new BadRequestException('Booth not found');
    }
    if (updateBoothDto.name && updateBoothDto.name !== booth.name) {
      const existingBooth = await this.boothRepository.findOne({
        where: { name: updateBoothDto.name },
      });
      if (existingBooth) {
        throw new BadRequestException('Booth name already exists');
      }
    }
    if (await this.boothRepository.update(id, updateBoothDto)) {
      return this.boothRepository.findOne({ where: { id } });
    }
    return null;
  }

  async remove(id: string) {
    // 1. เช็คข้อมูลเบื้องต้นก่อนเข้า Transaction (เพื่อประหยัด Resource)
    const booth = await this.boothRepository.findOne({ where: { id } });
    if (!booth) throw new BadRequestException('Booth not found');
    if (booth.currentShiftId)
      throw new BadRequestException('Active shift exists');

    // 2. เริ่มต้น Transaction
    return await this.dataSource.transaction(async (manager) => {
      try {
        const deleteTime = Date.now();

        // *** สำคัญ: ต้องใช้ 'manager' ในการ execute คำสั่งเพื่อให้รันใน transaction เดียวกัน ***

        // ขั้นตอนที่ 1: เปลี่ยนชื่อเพื่อเลี่ยง Unique Constraint
        await manager.update(Booth, id, {
          name: `${booth.name}_deleted_${deleteTime}`,
        });

        // ขั้นตอนที่ 2: ทำการ Soft Delete
        const result = await manager.softDelete(Booth, id);

        if (result.affected === 0) {
          throw new Error('Delete failed'); // ถ้าโยน Error ตรงนี้ มันจะ Rollback ชื่อที่เปลี่ยนไปกลับมาเป็นเหมือนเดิม
        }
        return { message: 'Booth deleted successfully with transaction' };
      } catch (err: any) {
        // ถ้ามีอะไรพังใน try block นี้ ทุกอย่างจะถูกคืนค่า (Rollback) อัตโนมัติ
        throw new BadRequestException( `Failed to delete booth: ${err.message}`); // ส่งข้อความผิดพลาดกลับไปให้ผู้เรียกใช้งาน
      }
    });
  }
  async setDeActive(id: string) {
    const booth = await this.boothRepository.findOne({ where: { id } });
    if (!booth) {
      throw new BadRequestException('Booth not found');
    }
    if (!booth.isActive) {
      throw new BadRequestException('Booth is already inactive');
    }
    await this.boothRepository.update(id, { isActive: false });
    return { message: 'Booth deactivated successfully' };
  }

  async setReActive(id: string) {
    const booth = await this.boothRepository.findOne({ where: { id } });
    if (!booth) {
      throw new BadRequestException('Booth not found');
    }
    if (booth.isActive) {
      throw new BadRequestException('Booth is already active');
    }
    await this.boothRepository.update(id, { isActive: true });
    return { message: 'Booth activated successfully' };
  }

  async setStatus(id: string, isOpen: boolean) {
    const booth = await this.boothRepository.findOne({ where: { id } });
    if (!booth) {
      throw new BadRequestException('Booth not found');
    }
    if (booth.isOpen === isOpen) {
      throw new BadRequestException(
        `Booth is already ${isOpen ? 'open' : 'closed'}`,
      );
    }
    if (await this.boothRepository.update(id, { isOpen })) {
      return { message: `Booth ${isOpen ? 'opened' : 'closed'} successfully` };
    }
    throw new BadRequestException(
      `Failed to ${isOpen ? 'open' : 'close'} booth`,
    );
  }

  async setCurrentShift(id: string, shiftId: string | null) {
    const booth = await this.boothRepository.findOne({ where: { id } });
    if (!booth) {
      throw new BadRequestException('Booth not found');
    }

    if (shiftId === null) {
      if (await this.boothRepository.update(id, { currentShiftId: null })) {
        return { message: 'Current shift cleared successfully' };
      }
      throw new BadRequestException('Failed to clear current shift');
    }

    const user = await this.userRepository.findOne({ where: { id: shiftId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (booth.currentShiftId === shiftId) {
      throw new BadRequestException('User is already assigned to this booth');
    }

    const alreadyAssignedBooth = await this.boothRepository.findOne({
      where: { currentShiftId: shiftId },
    });
    if (alreadyAssignedBooth && alreadyAssignedBooth.id !== id) {
      throw new BadRequestException(
        'User is already assigned to another booth',
      );
    }

    if (await this.boothRepository.update(id, { currentShiftId: shiftId })) {
      return { message: 'User assigned to booth successfully' };
    }
    throw new BadRequestException('Failed to assign user to booth');
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
