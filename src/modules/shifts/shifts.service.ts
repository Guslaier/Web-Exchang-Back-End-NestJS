import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  Inject,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BoothsService } from '../../modules/booths/booths.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import {
  IsNull,
  Repository,
  DataSource,
  EntityManager,
  Between,
  Not,
} from 'typeorm';
import { SystemLogsService } from '../../modules/system-logs/system-logs.service';
import Redis from 'ioredis';
import {
  QueryDateDto,
  QueryShiftId,
  ShiftIdDto,
  SummaryData,
  BoothIdDto,
} from './dto/shift.dto';
import { isUUID } from 'class-validator';
import { handleError } from '../../common/error/error';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly boothService: BoothsService,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    private readonly systemLogsService: SystemLogsService,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
    private readonly dataSource: DataSource,
  ) {}

  // create

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
    });
  }

  async create(
    currentUser: any,
    userId: string,
    boothId: string,
    manager: EntityManager,
  ) {
    const shiftRepo = manager.getRepository(Shift);
    const row = shiftRepo.create({
      userId: userId,
      boothId: boothId,
    });

    try {

      const savedShift = await shiftRepo.save(row);
      const logQuery  = await this.log(currentUser,'OPEN_SHIFT_SUCCESS',`shift created  id : ${savedShift.id}`,manager,);
      return { message: 'open shift success.' };

    } catch (err) {

      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.log(currentUser,'OPEN_SHIFT_FAILED',`internal server error: ${errorMessage}`,manager,);
      throw new InternalServerErrorException('error in internal server. please contact admin.',);
    
    }
  }

  async openShift(currentUser: any, body: BoothIdDto) {
    const isEmployee = currentUser.role === 'EMPLOYEE';

    if (!isEmployee && !body.boothId) {
      console.log(body);
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        'Booth ID is required for managers.',
      );
      throw new BadRequestException('Booth ID is required for managers.');
    }

    const boothId = isEmployee
      ? (await this.boothService.findBoothByShiftId(currentUser.id))?.id
      : body.boothId;
    if (!boothId) {
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        'This employee is not assigned to any booth.',
      );
      throw new NotFoundException('No booth found.');
    }

    const userId = isEmployee
      ? currentUser.id
      : (await this.boothService.findOne(boothId))?.currentShiftId;
    if (!userId) {
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        'Booth not found or not assigned to any employee.',
      );
      throw new NotFoundException(
        'Booth not found or not assigned to any employee.',
      );
    }

    const shift = await this.getLastShiftByUserId(userId);
    try {
      await this.dataSource.transaction(async (manager) => {
        if (!shift) {
          return await this.create(currentUser, userId, boothId, manager);
        }

        const shiftRepo = manager.getRepository(Shift);
        const shiftQuery = shiftRepo.update(
          { id: shift.id },
          { status: 'OPEN', endTime: null },
        );
        const logQuery = this.log(currentUser,
          'OPEN_SHIFT_SUCCESS',
          `updated shift id : ${shift.id}  to Open`,
          manager,
        );
        await Promise.all([shiftQuery, logQuery]);
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        `internal server error: ${errorMessage}`,
      );
      handleError(err, 'ShiftsService.openShift');
    }

    return { message: 'Open shift success.' };
  }

  // read

  async getShifts(query: QueryDateDto) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Specific range date required.');
    }

    const start = new Date(query.startDate);
    const end = new Date(query.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'StartDate or EndDate in not in Date from.',
      );
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    try {

      return await this.shiftRepository.query(
        `select id , "boothId" , "userId" , total_receive , total_exchange , balance , status , "startTime" 
                from shifts   
                where ("startTime" between  $1 and $2)
                order by "startTime" asc`,
        [start, end],
      );
    } catch (err) {
      console.log(err);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getActiveShifts(query: QueryDateDto) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Specific range date required.');
    }

    const start = new Date(query.startDate);
    const end = new Date(query.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'StartDate or EndDate in not in Date from.',
      );
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    try {
      return await this.shiftRepository.query(
        `select booths.id , booths.name 
                from shifts join booths on booths.id = shifts."boothId"  
                where ("endTime" is null) and ("startTime" between  $1 and $2)
                order by booths.name asc`,
        [start, end],
      );
    } catch (err) {
      console.log(err);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }
  
  
  async getLastShiftByUserId(userId: string) {
    const fromDate = new Date();
    const toDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const shiftQuery = this.shiftRepository.find({
      where: { userId: userId, startTime: Between(fromDate, toDate) },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const shifts = await shiftQuery;
    return shifts.length > 0 ? shifts[0] : null;
  }

  async getLastShiftByBoothId(boothId: string | undefined) {
    if (!boothId) {
      return null;
    }

    const fromDate = new Date();
    const toDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setDate(toDate.getDate() + 1) ; 
    toDate.setHours(23, 59, 59, 999);

    const shiftQuery = this.shiftRepository.find({
      where: { boothId: boothId, startTime: Between(fromDate, toDate) , status : Not("COMPLETED") },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const shifts = await shiftQuery;

    if(shifts.length === 0 ) {
        throw new NotFoundException("Shift is not found from sent id.") ;    
    }

    return shifts.length > 0 ? shifts[0] : null;
  }

  

  async getShiftById(shiftId: string | undefined) {
    if (!shiftId || !isUUID(shiftId)) {
      throw new BadRequestException('Shift ID is not in correct format.');
    }

    const shift = await this.shiftRepository.findOne({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found.');
    }

    return shift;
  }
 
  
  // update 


  async setCloseDaily(shiftId: string, data: SummaryData, currentUser: any) {
    if (!isUUID(shiftId)) {
      await this.log(
        currentUser,
        'SET_CLOSE_DAILY_FAILED',
        'Id is not correct format.',
      );
      throw new BadRequestException('Id is not correct format.');
    }

    const shift = await this.shiftRepository.findOne({
      where: { id: shiftId },
    });

    if (!shift) {
      await this.log(
        currentUser,
        'SET_CLOSE_DAILY_FAILED',
        'Could not find shift from shift id.',
      );
      throw new NotFoundException('Could not find shift from shift id.');
    }

    if (shift.status != 'close') {
      const errorCause =
        shift.status == 'OPEN' ? 'it still active.' : 'it has been summarized.';
      await this.log(
        currentUser,
        'SET_CLOSE_DAILY_FAILED',
        `This shift cannot be summerize casue ${errorCause}`,
      );
      throw new ConflictException(
        `This shift cannot be summerize casue ${errorCause}`,
      );
    }

    const balanceCheck = data?.balanceCheck ? data.balanceCheck : 0;
    const cashAdvance = data?.cashAdvance ? data.cashAdvance : 0;

    if (cashAdvance < 0) {
      await this.log(
        currentUser,
        'SET_CLOSE_DAILY_FAILED',
        'Cash advacne cannot be negative.',
      );
      throw new BadRequestException('Cash advacne cannot be negative.');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const shiftRepo = manager.getRepository(Shift);
        await shiftRepo.update(shiftId, {
          balance_check: balanceCheck,
          cash_advance: cashAdvance,
          status: 'SUMMARIZED',
        });
        await this.log(currentUser, 'SET_CLOSE_DAILY_SUCCESS', '', manager);
      });
    } catch (err) {
      await this.log(
        null,
        'SET_CLOSE_DAILY_FAILED',
        `Internal Server Error : ${err}`,
      );
      handleError(err, 'ShiftsService.setCloseDaily');
    }
  }

   async setStatusToCLose(currentUser: any, body: ShiftIdDto) {
    const shiftId =
      currentUser.role === 'EMPLOYEE'
        ? (await this.getLastShiftByUserId(currentUser.id))?.id
        : body.id;
    if (!shiftId) {
      await this.log(currentUser, 'CLOSE_SHIFT_FAILED', 'No shift found.');
      throw new NotFoundException('No active shift found.');
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const shiftRepo = manager.getRepository(Shift);
        await shiftRepo.update(
          { id: shiftId },
          { status: 'CLOSE', endTime: new Date() },
        );
        const logQuery = await this.log(currentUser,'CLOSE_SHIFT_SUCCESS',`closed shift id : ${shiftId}` , manager) ; 
      });
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      await this.log(
        currentUser,
        'CLOSE_SHIFT_FAILED',
        `close shift failed  err : ${errMessage}`,
      );
      handleError(err, 'ShiftsService.setStatusToCLose');
    }
    return { message: 'Close shift success.' };
  }

  
  
}
