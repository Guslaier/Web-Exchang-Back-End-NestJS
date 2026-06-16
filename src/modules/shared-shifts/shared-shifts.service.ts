import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, Between } from 'typeorm';
import { Shift } from '../shifts/entities/shift.entity';
import { Booth } from '../booths/entities/booth.entity';
import { User } from '../users/entities/user.entity';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { BoothIdDto} from '../shifts/dto/shift.dto' ;
import { SseService } from '../sse/sse.service';
import { isUUID } from 'class-validator';
import { handleError } from '../../common/error/error';

@Injectable()
export class SharedShiftsService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    private readonly systemLogsService: SystemLogsService,
    private readonly sseService: SseService,
  ) {}

  private async log(
    user: any,
    action: string,
    details: string,
    manager?: EntityManager,
  ) {
    await this.systemLogsService.createLog(user, {
      userId: user?.id || null,
      action,
      details,
    }, manager);
  }

  async getShiftById(manager: EntityManager, shiftId: string | undefined) {
    if (!shiftId || !isUUID(shiftId)) {
      throw new BadRequestException('Shift ID is not in correct format.');
    }

    const shiftRepo = manager.getRepository(Shift);
    const shift = await shiftRepo.findOne({
      where: { id: shiftId },
    });

    return shift;
  }

  async getLastShiftByUserId(manager: EntityManager, userId: string) {
    const fromDate = new Date();
    const toDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const shiftRepo = manager.getRepository(Shift);
    const shifts = await shiftRepo.find({
      where: { userId: userId, startTime: Between(fromDate, toDate) },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return shifts.length > 0 ? shifts[0] : null;
  }

  async getLastShiftByBoothId(manager: EntityManager, boothId: string | undefined, required = true) {
    if (!boothId) {
      if (required) {
        throw new BadRequestException('Booth ID is required.');
      } else {
        return null;
      }
    }

    const fromDate = new Date();
    const toDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setDate(toDate.getDate() + 1);
    toDate.setHours(23, 59, 59, 999);

    const shiftRepo = manager.getRepository(Shift);
    const shifts = await shiftRepo.find({
      where: { boothId: boothId, startTime: Between(fromDate, toDate) },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (shifts.length === 0) {
      if (required) {
        throw new NotFoundException('No shift found for this booth today.');
      } else {
        return null;
      }
    }

    return shifts.length > 0 ? shifts[0] : null;
  }

  async create(
    currentUser: any,
    userId: string,
    boothId: string,
    manager: EntityManager,
    today = true,
  ) {
    const shiftRepo = manager.getRepository(Shift);
    const now = new Date();
    const startTime = today
      ? now
      : new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        8,
        0,
        0,
        0,
      );
    const status = 'CLOSE';
    const row = shiftRepo.create({
      userId: userId,
      boothId: boothId,
      startTime: startTime,
      status: status,
    });

    try {
      const savedShift = await shiftRepo.save(row);
      const shiftData = await shiftRepo.findOne({ where: { id: savedShift.id }, relations: ['user', 'booth'] });
      const boothName = shiftData?.booth?.name || 'Unknown Booth';
      const userName = shiftData?.user?.username || 'Unknown User';
      await this.log(
        currentUser,
        'OPEN_SHIFT_SUCCESS',
        `Shift at ${boothName} (Booth ID: ${boothId}) was opened by ${userName} (User ID: ${userId}) (Shift ID: ${savedShift.id})`,
        manager,
      );
      this.sseService.triggerRefreshBoothShiftId(boothId, savedShift.id);
      return savedShift;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        `internal server error: ${errorMessage}`,
        manager,
      );
      throw new InternalServerErrorException(
        'error in internal server. please contact admin.',
      );
    }
  }

  async setStatusToOpen(
    currentUser: any,
    id: string,
    previousStatus: string,
    manager: EntityManager,
  ) {
    const shiftRepo = manager.getRepository(Shift);
    const updateResult = await shiftRepo.update({ id: id }, { status: 'OPEN' });
    if (updateResult.affected == 0) {
      const shiftData = await shiftRepo.findOne({ where: { id }, relations: ['booth'] });
      const boothName = shiftData?.booth?.name || 'Unknown Booth';
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        `Can't set status for shift at ${boothName} (Shift ID: ${id}) to OPEN.`,
        manager,
      );
      throw new NotFoundException(`Can't set status for shift at ${boothName} to OPEN.`);
    }

    const shiftData = await shiftRepo.findOne({ where: { id }, relations: ['booth'] });
    const boothName = shiftData?.booth?.name || 'Unknown Booth';
    await this.log(
      currentUser,
      'OPEN_SHIFT_SUCCESS',
      `Update shift at ${boothName} (Shift ID: ${id}) from ${previousStatus} to OPEN`,
      manager,
    );
    this.sseService.triggerRefreshShiftId(id);
    return { message: 'Open shift success.' };
  }

  async openShift(
    manager: EntityManager,
    currentUser: any,
    body: { boothId: string  , tomorrow ?: boolean}
  ) {
    const boothId = body.boothId;
    const boothRepo = manager.getRepository(Booth);
    const boothData = await boothRepo.findOne({ where: { id: boothId } });

    if (boothData == null) {
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        'Booth is not found with sent id.',
        manager,
      );
      throw new NotFoundException('Booth is not found with sent id.');
    }

    if (boothData.currentShiftId == null) {
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        'Booth has not assigend with any employee.',
        manager,
      );
      throw new BadRequestException(
        'This booth has not been assinged with any employee',
      );
    }

    const shiftData = await this.getLastShiftByBoothId(manager, boothId, false);
    if (shiftData == null) {
      try {
        return await this.create(
          currentUser,
          boothData.currentShiftId as string,
          boothId,
          manager,
          body.tomorrow ? false : true , 
        );
      } catch (err) {
        handleError(err, 'SharedShiftsService.openShift');
      }
    }

    if (shiftData?.userId === boothData?.currentShiftId) {
      try {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (shiftData.startTime > today) {
          await this.log(
            currentUser,
            'OPEN_SHIFT_FAILED',
            `Tomorrow shift is alreay created. This Booth ${boothData.name} (Booth ID: ${boothId}) can't open shift anymore.`,
            manager,
          );
          throw new ConflictException(
            `Tomorrow shift is alreay created. This Booth ${boothData.name} can't open shift anymore.`,
          );
        }

        if (shiftData.status === 'COMPLETED') {
          return await this.create(
            currentUser,
            boothData.currentShiftId as string,
            boothId,
            manager,
            false,
          );
        }

        if (body.tomorrow) {
          await this.log(currentUser , 'OPEN_SHIFT_FAILED' , `There still shift running on booth ${boothData.name} (Booth ID: ${body.boothId}).` , manager) ;
          throw new ConflictException(`There still shift running on booth ${boothData.name}.`) ; 
        }
    
        return await this.setStatusToOpen(
          currentUser,
          shiftData.id,
          shiftData.status,
          manager,
        );
      } catch (err) {
        handleError(err, 'SharedShiftsService.openShift');
      }
    }

    if (shiftData?.userId !== boothData?.currentShiftId) {
      if (shiftData.status === 'OPEN') {
        const lastUser = await manager.getRepository(User).findOne({ where: { id: shiftData.userId }});
        const dateStr = shiftData.startTime.toISOString().split('T')[0];
        const formattedShiftId = `(${boothData.name}+${lastUser?.username || 'Unknown'}+${dateStr})`;

        await this.log(
          currentUser,
          'OPEN_SHIFT_FAILED',
          `Last shift id : ${shiftData.id} ${formattedShiftId} is still open.`,
          manager,
        );
        throw new ConflictException(
          `Last shift id : ${formattedShiftId} is still open. Pleast close or audit it first.`,
        );
      }

      try {
        return await this.create(
          currentUser,
          boothData.currentShiftId as string,
          boothId,
          manager,
          body.tomorrow ? false : true ,
        );
      } catch (err) {
        handleError(err, 'SharedShiftsService.openShift');
      }
    }
  }

  async setStatusToCLose(
    manager: EntityManager,
    currentUser: any,
    body: { id?: string },
  ) {
    const isEmployee = currentUser.role === 'EMPLOYEE';
    const id = isEmployee ? currentUser.id : body.id;

    if (!id) {
      await this.log(
        currentUser,
        'CLOSE_SHIFT_FAILED',
        `Bad argrument no id sent by this user`,
        manager,
      );
      throw new BadRequestException('Shift id is requried for Non employee');
    }

    const shiftData = isEmployee
      ? await this.getLastShiftByUserId(manager, id)
      : await this.getShiftById(manager, id);

    if (!shiftData) {
      const errMessage = isEmployee
        ? 'Shift are not found from this employee.'
        : `Shift are not found from this sent shift id : ${id}. `;
      await this.log(currentUser, 'CLOSE_SHIFT_FAILED', errMessage, manager);
      throw new NotFoundException(errMessage);
    }

    if (shiftData.status === 'COMPLETED') {
      const boothName = shiftData.boothId ? (await manager.getRepository(Booth).findOne({ where: { id: shiftData.boothId } }))?.name || 'Unknown' : 'Unknown';
      const userName = shiftData.userId ? (await manager.getRepository(User).findOne({ where: { id: shiftData.userId } }))?.username || 'Unknown' : 'Unknown';
      const dateStr = shiftData.startTime.toISOString().split('T')[0];
      const formattedShiftId = `(${boothName}+${userName}+${dateStr})`;

      await this.log(
        currentUser,
        'CLOSE_SHIFT_FAILED',
        `This shift id : ${shiftData.id} ${formattedShiftId} is already completed. can't be open or close anymore.`,
        manager,
      );
      throw new ConflictException(`This shift id : ${formattedShiftId} is already completed.`);
    }

    try {
      const shiftRepo = manager.getRepository(Shift);
      const updateResult = await shiftRepo.update(
        { id: shiftData.id },
        { status: 'CLOSE', endTime: new Date() },
      );

      if (updateResult.affected == 0) {
        await this.log(
          currentUser,
          'CLOSE_SHIFT_FAILED',
          `Can't Update shift id : ${shiftData.id}.`,
          manager,
        );
        throw new NotFoundException(`Can't shift to close.`);
      }
      this.sseService.triggerRefreshShiftId(shiftData.id);
      await this.log(
        currentUser,
        'CLOSE_SHIFT_SUCCESS',
        `Shift id : ${shiftData.id} to update status from ${shiftData.status} to CLOSE.`,
        manager,
      );
      return { message: 'Close shift success.' };
    } catch (err) {
      handleError(err, `SharedShifts.service`);
    }
  }
}
