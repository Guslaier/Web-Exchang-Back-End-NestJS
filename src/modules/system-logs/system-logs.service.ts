import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SystemLog  } from './entities/system-log.entity'; // Assuming you have a SystemLog entity defined
import { CreateSystemLogDto , QueryDateDto } from './dto/system-log.dto'; // Assuming you have a DTO for creating system logs
import { InjectRepository } from '@nestjs/typeorm';
import { Between, QueryFailedError, Repository } from 'typeorm';
import { ErrorHttpStatusCode } from '@nestjs/common/utils/http-error-by-code.util';
@Injectable()
export class SystemLogsService {
    constructor(
        @InjectRepository(SystemLog)
        private readonly systemLogRepo : Repository<SystemLog> , 
    ){

    }

   async getAllByDate(currentUser : any , query : QueryDateDto ) {

        const logs = await this.systemLogRepo.find({
            where : {
                createdAt : Between(query.startDate , query.endDate)
            } , 
            order : {
                createdAt : 'ASC'
            }
        }) ; 

        if (!logs) {
            throw new NotFoundException("logs are not found.") ; 
        }

        return logs ; 

   }

   async createLog(currentUser : any , log : CreateSystemLogDto) {

        if (!currentUser.id) {
            throw new UnauthorizedException("you can't action.") ; 
        }

        if (currentUser.id != log.userId) {
            throw new ForbiddenException("this not your action.") ; 
        }

        try {
            const row =   this.systemLogRepo.create({
                userId : log.userId , 
                action : log.action , 
                details : log.details 
            }) ; 
            this.systemLogRepo.save(row) ; 
        }
        catch(err) {
            const error = err as any ; 
            if (error.code == '23503') {
                throw new  BadRequestException('There are no this user.') ; 
            }

            if (error.code == '23502') {
                throw new  BadRequestException('There are missing required field.') ; 
            }
        }
   }
}