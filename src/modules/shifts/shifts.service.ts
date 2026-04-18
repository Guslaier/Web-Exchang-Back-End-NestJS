import { Injectable, NotFoundException, InternalServerErrorException, ConflictException, Inject, BadRequestException, ForbiddenException } from '@nestjs/common';
import { BoothsService } from '../../modules/booths/booths.service';
import { NotFoundError, throwError } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { CannotAttachTreeChildrenEntityError, IsNull, Repository, DataSource, EntityManager, Between } from 'typeorm';
import { SystemLogsService } from '../../modules/system-logs/system-logs.service';
import { get } from 'http';
import { error } from 'console';
import Redis from 'ioredis';
import { QueryDateDto, QueryShiftId, SummaryData, UserIdDto } from './dto/shift.dto';
import { start } from 'repl';
import { isInstance, isUUID } from 'class-validator';
import { all } from 'axios';
import { weightSrvRecords } from 'ioredis/built/cluster/util';



@Injectable()
export class ShiftsService {
    constructor(
        private readonly boothService: BoothsService,
        @InjectRepository(Shift)
        private readonly shiftRepository: Repository<Shift>,
        private readonly systemLogsService: SystemLogsService,
        @Inject('REDIS_CLIENT')
        private readonly redisClient: Redis,
        private readonly dataSource: DataSource
    ) {

    }

    private async log(
        user: any,
        action: string,
        details: string,
        manager?: EntityManager
    ) {
        await this.systemLogsService.createLog(
            user,
            {
                userId: user?.id || null,
                action,
                details,
            },
        );
    }

    async getShifts(query : QueryDateDto) {
        if(!query.startDate || !query.endDate) {
            throw new BadRequestException('Specific range date required.') ; 
        }

        const start = new Date(query.startDate) ; 
        const end = new Date(query.endDate) ;

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {                     
            throw new BadRequestException('StartDate or EndDate in not in Date from.') ; 

        }

        start.setHours(0,0,0,0) ; 
        end.setHours(23,59,59,999) ;  
    
        try {
            // const rows =  await this.shiftRepository.find({
            //     where : { endTime : IsNull() , startTime : Between(start , end) } ,
            // })  ;

            return await this.shiftRepository.query(`select id , "boothId" , "userId" , total_receive , total_exchange , balance , status , "startTime" 
                from shifts   
                where ("startTime" between  $1 and $2)
                order by "startTime" asc`  , [start , end]) ;
        }
        catch(err) {
            console.log(err) ; 
            throw new InternalServerErrorException('Internal Server Error') ; 
        }
    }

    async getActiveShifts(query : QueryDateDto) {
        if(!query.startDate || !query.endDate) {
            throw new BadRequestException('Specific range date required.') ; 
        }

        const start = new Date(query.startDate) ; 
        const end = new Date(query.endDate) ;

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {                     
            throw new BadRequestException('StartDate or EndDate in not in Date from.') ; 

        }

        start.setHours(0,0,0,0) ; 
        end.setHours(23,59,59,999) ;  
    
        try {
            // const rows =  await this.shiftRepository.find({
            //     where : { endTime : IsNull() , startTime : Between(start , end) } ,
            // })  ;

            return await this.shiftRepository.query(`select booths.id , booths.name 
                from shifts join booths on booths.id = shifts."boothId"  
                where ("endTime" is null) and ("startTime" between  $1 and $2)
                order by booths.name asc`  , [start , end]) ;
        }
        catch(err) {
            console.log(err) ; 
            throw new InternalServerErrorException('Internal Server Error') ; 
        }
    }


    async openShift(currentUser: any , body : UserIdDto) {
        const userId = currentUser.role === 'EMPLOYEE'  ? currentUser.id : body.userId ;
        if (!userId) {
            await this.log(currentUser , 'OPEN_SHIFT_FAILED' , 'No employee id from admin or manager.'  ) ; 
            throw new BadRequestException('No employee id.') ; 
        }  

        const booth = await this.boothService.findBoothByShiftId(userId)  ; 
        const boothId = booth ? booth.id : null ;
        if(!boothId) {
            await this.log(currentUser , 'OPEN_SHIFT_FAILED' , 'Booth for employee not found.'  ) ; 
            throw new NotFoundException('Booth for employee not found.')  ; 
        }

        const shift = await this.getLastShiftByUserId(userId) ; 
        try {

            await this.dataSource.transaction( async (manager)=>{
                if(!shift) {
                    return this.create(currentUser , userId , boothId , manager) ;  
                }      

                const shiftRepo = manager.getRepository(Shift) ;
                const shiftQuery = shiftRepo.update(
                    {id : shift.id } ,
                     {status : 'OPEN' , endTime : null} 
                ) ; 
                const cache = this.getSummary(currentUser , {shiftId : shift.id} ) ;
                const logQuery = this.log(currentUser , 'OPEN_SHIFT_SUCCESS' , `updated shift id : ${shift.id}  to Open`, manager) ;  
                await Promise.all([shiftQuery , cache ,  logQuery]) ; 
            });
        } 
        catch(err) {
            const errMessage = err instanceof Error ? err.message : String(err) ; 
            await this.log(currentUser , 'OPEN_SHIFT_FAILED' , `open shift failed  err : ${errMessage}`) ; 
            throw new InternalServerErrorException('Internal server error.') ; 
        }   
        return {message : 'Open shift success.'} ; 
    }   

    async setStatusToCLose(currentUser: any) {
        return await this.dataSource.transaction(async (manager) => {
            const activeShift = await this.getActiveShiftByUserId(currentUser.id);
            if (!activeShift) {
                await this.log(currentUser, "close shift FAILED", "active shift from this employee not found.", manager);
                throw new NotFoundException('you active shift is not found.');
            }

            await this.deleteCacheSummaryShift(activeShift.id, manager);

            const shiftRepo = manager.getRepository(Shift);


            try {
                await shiftRepo.update(activeShift.id, { status: "close", endTime: new Date() });
                await this.log(currentUser, "close shift SUCCESS", "", manager);
            }
            catch (err) {
                await this.log(currentUser, "close shift failed", "internal server error", manager);
                throw new InternalServerErrorException('error in internal server. please contact admin.');
            }

            return {
                message: 'close shift successfuly.'
            };
        });

    }

    async getActiveShiftByUserId(userId: string) {
        return await this.shiftRepository.findOne({ where: { userId: userId, endTime: IsNull() } });
    }

    private async createCacheSummaryShift(shiftId: string , empId : string , manager: EntityManager) {
        try {
            await this.redisClient.hset(shiftId, {
                total_receive: 0,
                total_exchange: 0,
                balance: 0 ,
                emp : empId
            });
            await this.redisClient.expire(shiftId, 60 * 60 * 12);
            await this.log(null, 'CREATE_CACHE_SHIFT_SUCCESS', '', manager);
        }
        catch (error) {
            await this.log(null, 'CREATE_CACHE_SHIFT_FAILED', '', manager)
        }

    }

    private async deleteCacheSummaryShift(shiftId: string, manager: EntityManager) {
        try {
            await this.redisClient.del(shiftId);
            await this.log(null, 'DELETE_CACHE_SHIFT_SUCCESS', '', manager);
        }
        catch (error) {
            await this.log(null, 'DELETE_CACHE_SHIFT_FAILED', '', manager);
        }
    }


    async setTotalReceive(boothId: string, amount: number) {

        if (amount < 0) {
            throw new BadRequestException(`amount of receive can't be under 0`)
        }

        const shift = await this.getActiveShiftByBoothId(boothId);
        if (!shift) {
            throw new NotFoundException(`active shift from Booth: ${boothId} not found.`);
        }

        const shiftId = shift.id;

        try {
            return await this.dataSource.transaction(async (manager) => {
                const shiftRepo = manager.getRepository(Shift);

                await shiftRepo.update(shiftId, {
                    total_receive: () => `total_receive + ${amount}`,
                    balance: () => `balance + ${amount}`,
                });

                const shiftExists = await this.redisClient.exists(shiftId);
                if (shiftExists) {
                    await this.redisClient.pipeline()
                        .hincrbyfloat(shiftId, 'total_receive', amount)
                        .hincrbyfloat(shiftId, 'balance', amount)
                        .exec();
                }

                this.log(null, 'UPDATE_TOTAL_RECEIVE_SUCCESS', `Shift: ${shiftId}, Amount: ${amount}`, manager);
            });
        } catch (err) {
            this.log(null, 'UPDATE_TOTAL_RECEIVE_FAILED', `Shift: ${shiftId}, Error: ${err}`);
            throw new InternalServerErrorException('Internal Server Error');
        }
    }

     async setTotalExchange(boothId: string, amount: number) {

        if (amount < 0) {
            throw new BadRequestException(`amount of receive can't be under 0`)
        }

        const shift = await this.getActiveShiftByBoothId(boothId);
        if (!shift) {
            throw new NotFoundException(`active shift from Booth: ${boothId} not found.`);
        }

        const shiftId = shift.id;

        try {
            return await this.dataSource.transaction(async (manager) => {
                const shiftRepo = manager.getRepository(Shift);

                await shiftRepo.update(shiftId, {
                    total_exchange: () => `total_exchange + ${amount}`,
                    balance: () => `balance + ${-amount}`,
                });

                const shiftExists = await this.redisClient.exists(shiftId);
                if (shiftExists) {
                    await this.redisClient.pipeline()
                        .hincrbyfloat(shiftId, 'total_exchange', amount)
                        .hincrbyfloat(shiftId, 'balance', (-amount))
                        .exec();
                }

                this.log(null, 'UPDATE_TOTAL_EXCHANGE_SUCCESS', `Shift: ${shiftId}, Amount: ${amount}`, manager);
            });
        } catch (err) {
            this.log(null, 'UPDATE_TOTAL_EXCHANGE_FAILED', `Shift: ${shiftId}, Error: ${err}`);
            throw new InternalServerErrorException('Internal Server Error');
        }
    }

    async getActiveShiftByBoothId(boothId: string) {
        return await this.shiftRepository.findOne({ where: { boothId: boothId, endTime: IsNull() } });
    }

    async setCloseDaily (shiftId : string , data : SummaryData , currentUser : any ) {
        if (!isUUID(shiftId)){
            await this.log(currentUser , 'SET_CLOSE_DAILY_FAILED' , 'Id is not correct format.') ; 
            throw new BadRequestException('Id is not correct format.') ; 
        }

      const shift =  await this.shiftRepository.findOne({
        where : {id : shiftId }
      }) ; 

      if (!shift) {
          await this.log(currentUser , 'SET_CLOSE_DAILY_FAILED' , 'Could not find shift from shift id.') ; 
          throw new NotFoundException('Could not find shift from shift id.') ; 
      }

      if (shift.status != 'close') {
        const errorCause = shift.status == 'OPEN' ? 'it still active.' : 'it has been summarized.' ; 
        await this.log(currentUser ,  'SET_CLOSE_DAILY_FAILED' , `This shift cannot be summerize casue ${errorCause}`) ;
        throw new ConflictException(`This shift cannot be summerize casue ${errorCause}`) ;
      }

      const balanceCheck = data?.balanceCheck ? data.balanceCheck : 0  ; 
      const cashAdvance = data?.cashAdvance ? data.cashAdvance : 0 ; 



      
      if (cashAdvance < 0) {
        await this.log(currentUser , 'SET_CLOSE_DAILY_FAILED' , 'Cash advacne cannot be negative.') ;
        throw new BadRequestException('Cash advacne cannot be negative.')  ; 
      }

      try {
        return await this.dataSource.transaction( async (manager)=>{
            const shiftRepo = manager.getRepository(Shift) ; 
            await shiftRepo.update(shiftId , {
                balance_check : balanceCheck , 
                cash_advance : cashAdvance , 
                status : 'SUMMARIZED' , 
            }) ; 
            await this.log(currentUser , 'SET_CLOSE_DAILY_SUCCESS' , '' ,  manager) ; 
        }) ;
      }
      catch (err) {
        await this.log(null , 'SET_CLOSE_DAILY_FAILED' , `Internal Server Error : ${err}`) ;
        throw new InternalServerErrorException('Internal Server Error.') ;  

      }

    }

    async getSummary(currentUser : any , query : QueryShiftId) {
        const shiftId = query?.shiftId ? query.shiftId : "" ; 
        console.log(shiftId) ;
        if (!isUUID(shiftId)) {
            throw new BadRequestException('No shift id or worng shift id format.') ; 
        }

        const exist = await this.redisClient.hexists(shiftId , 'emp') ;
        
        if(!exist) {
            const shift = await this.shiftRepository.findOne({where : {id : shiftId}}) ; 
            if(!shift) {
                throw new NotFoundException('Shift not found.')
            }
            await this.redisClient.hset(shiftId, {
                total_receive: shift.total_receive,
                total_exchange: shift.total_exchange,
                balance: shift.balance , 
                emp : shift.userId
            });
        }

        const cache = await this.redisClient.hgetall(shiftId) ;
        if (currentUser.role == "EMPLOYEE" && currentUser.id != cache.emp) {
            throw new ForbiddenException('This is not your shift.') ; 
        } 
        return cache ; 

    }

    async getLastShiftByUserId(userId : string) {
        const fromDate = new Date() ; 
        const toDate = new Date() ; 
        fromDate.setHours(0,0,0,0) ; 
        toDate.setHours(23,59,59,999) ;

        const shiftQuery =  this.shiftRepository.find({
            where : { userId : userId , startTime : Between(fromDate , toDate) } ,
            order : { createdAt : 'DESC' } ,
            take : 1
        }) ; 
        const shifts = await shiftQuery ; 
        return shifts.length > 0 ? shifts[0] : null ;
            
    }

    async create(currentUser : any ,userId : string , boothId : string , manager : EntityManager) {
        const shiftRepo = manager.getRepository(Shift) ;
        const row = shiftRepo.create(({
            userId: userId,
            boothId: boothId,
        })) ;

        try {
            const savedShift = await shiftRepo.save(row) ;
            const cache = this.createCacheSummaryShift(savedShift.id , userId , manager) ;
            const logQuery = this.log(currentUser , 'OPEN_SHIFT_SUCCESS' , `shift created  id : ${savedShift.id}` , manager  ) ; 
            await Promise.all([cache , logQuery]) ; 
            return {message : 'open shift success.'} ; 
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err) ;
            await this.log(currentUser, "OPEN_SHIFT_FAILED", `internal server error: ${errorMessage}` , manager); 
            throw new InternalServerErrorException('error in internal server. please contact admin.') ; 
        }
    }

}