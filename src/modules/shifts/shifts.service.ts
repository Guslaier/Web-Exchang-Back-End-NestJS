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
import { re } from 'mathjs';

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
    today = true 
  ) {
    const shiftRepo = manager.getRepository(Shift);
    const now = new Date()
    const startTime = today ? now : new Date(now.getFullYear() , now.getMonth() , (now.getDate() + 1) , 8 ,0 ,0 ,0) 
    const row = shiftRepo.create({
      userId: userId,
      boothId: boothId,
      startTime : startTime
    });

    try {
      const savedShift = await shiftRepo.save(row);
      const logQuery  = await this.log(currentUser,'OPEN_SHIFT_SUCCESS',`Shift id : ${savedShift.id} was opened by User id : ${currentUser.id}`,manager,);
       return {message : 'Open shift success.'} ; 
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.log(currentUser,'OPEN_SHIFT_FAILED',`internal server error: ${errorMessage}`,manager,);
      throw new InternalServerErrorException('error in internal server. please contact admin.',);
    }
  }

  async openShift(currentUser: any, body: BoothIdDto) {
    const boothId = body.boothId ;
    const boothData = await this.boothService.getBoothIfExist(boothId) ; 

     if (boothData == null) {
      await this.log(currentUser , 'OPEN_SHIFT_FAILED' , 'Booth is not found with sent id.') ; 
      throw new NotFoundException('Booth is not found with sent id.') ; 
    } 

    if (boothData.currentShiftId == null) {
      await this.log(currentUser , 'OPEN_SHIFT_FAILED' , 'Booth has not assigend with any employee.') ; 
      throw new BadRequestException('This booth has not been assinged with any employee') ; 
    } 

    const shiftData = await this.getLastShiftByBoothId(boothId , false) ; 
    console.log(shiftData) ; 
    if (shiftData == null) {
      console.log("shift Occured today.") ; 
      return await this.dataSource.transaction(async(manager)=>{
        try {
         return await this.create(currentUser , boothData.currentShiftId as string   , boothId , manager);
        }
        catch(err) {
          handleError(err, 'ShiftsService.openShift') ; 
        } 
      });
    } 

    if (shiftData?.userId === boothData?.currentShiftId) {
      //completed ห้าม ที่เหลือ set เป็น OPEN
      return await this.dataSource.transaction(async (manager) =>{
        try {
          const today = new Date() ; 
          today.setHours(23,59,59,9999) ; 
            
          if (shiftData.startTime > today  ) {
              await this.log(currentUser , 'OPEN_SHIFT_FAILED' , `Tomorrow shift is alreay created. This Booth id : ${boothId} can't open shift anymore.` , manager)
              throw new ConflictException(`Today shift already completed and tomorrow shift is alreay created. This Booth id : ${boothId} can't open shift anymore.`) ;
          }

          if (shiftData.status === 'COMPLETED') {
            return await this.create(currentUser , boothData.currentShiftId as string , boothId , manager , false ) ;
          }

          return await this.setStatusToOpen(currentUser , shiftData.id , shiftData.status , manager) ; 
        }
        catch (err) {
          handleError(err, 'ShiftsService.openShift') ; 
        }
      }) ;       
    }

    if (shiftData?.userId !== boothData?.currentShiftId) {
      if (shiftData.status === 'OPEN') {
          await this.log(currentUser , 'OPEN_SHIFT_FAILED' , `Last shift id : ${shiftData.id} is still open.`) ;
          throw new ConflictException(`Last shift id : ${shiftData.id} is still open. Pleast close or audit it first.`) ; 
        }

      return await this.dataSource.transaction(async (manager) =>{
        try {
            return await this.create(currentUser , boothData.currentShiftId as string , boothId , manager) ;
        }
        catch (err) {
          handleError(err, 'ShiftsService.openShift') ; 
        }
      }) ;       
    }
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

  async getLastShiftByBoothId(boothId: string | undefined, required = true) {
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
    toDate.setDate(toDate.getDate() + 1) ; 
    toDate.setHours(23, 59, 59, 999);

    const shiftQuery = this.shiftRepository.find({
      where: { boothId: boothId, startTime: Between(fromDate, toDate)  },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const shifts = await shiftQuery;

    if(shifts.length === 0 ) {
      if (required) {
        throw new NotFoundException('No shift found for this booth today.');
      } else
      { return null ; 
      }   
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
      handleError(err, 'ShiftsService.setCloseDaily');
    }
  }

  async setStatusToOpen(currentUser : any , id : string  , previousStatus : string , manager : EntityManager) 
  {
    const shiftRepo  = manager.getRepository(Shift) ; 
    const updateResult = await shiftRepo.update({id : id} , {status : 'OPEN'}) ; 
    if (updateResult.affected == 0) {
      await this.log(currentUser , 'OPEN_SHIFT_FAILED' , `Can't set status Shift id : ${id} to OPEN.`,manager) ; 
      throw new NotFoundException(`Can't set status Shift id : ${id} to OPEN.`) ;  
    } 

    await this.log(currentUser , 'OPEN_SHIFT_SUCCESS' , `Update shift id : ${id} from ${previousStatus} to OPEN`,manager) ;
    return {message : 'Open shift success.'} ; 
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
