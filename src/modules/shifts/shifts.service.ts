import { Injectable, NotFoundException , InternalServerErrorException, ConflictException } from '@nestjs/common';
import { BoothsService } from '../../modules/booths/booths.service';
import { NotFoundError } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { IsNull, Repository } from 'typeorm';
import {SystemLogsService } from '../../modules/system-logs/system-logs.service';



@Injectable()
export class ShiftsService {
    constructor(
        private readonly boothService : BoothsService , 
        @InjectRepository(Shift)
        private readonly shiftRepository : Repository<Shift> ,
        private readonly systemLogsService : SystemLogsService ,  
    ){

    }
    
    private async log(
    user: any,
    action: string,
    details: string,
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

    
    async openShift (currentUser : any) {
        const booth = await this.boothService.findBoothByShiftId(currentUser.id)  ;
        if(!booth) {
            await this.log(currentUser , "open shift FAILED" , "not found booth for this employee") ; 
            throw new NotFoundException("your booth work is not found.") ; 
        }

        const boothId = booth.id ; 

        const activeShift = await this.getActiveShiftByUserId(currentUser.id)  ; 

        if(activeShift) {
            await this.log(currentUser , "open shift FAILED" , `lastest shift ${activeShift.id} from this employee is not close.` ) ; 
            throw new ConflictException("you have not close your laset shift yet.") ; 
        }

        const row = this.shiftRepository.create(({
            userId : currentUser.id , 
            boothId : boothId  , 
        }))

        try {
            await this.log(currentUser , "open shift SUCCESS" , ``) ; 
            const savedShift = await this.shiftRepository.save(row) ; 
        }
        catch(err) {
            await this.log(currentUser , "open shift FAILED" , `internal server error`) ; 
            throw new InternalServerErrorException('error in internal server. please contact admin.') ; 
        }

        return {
            message : "open shift success."
        }

    }

    private async getActiveShiftByUserId (userId : string) {
            return  await this.shiftRepository.findOne({where : {userId : userId , endTime : IsNull()}}) ; 
    }
    
}