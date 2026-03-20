import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemLog  } from './entities/system-log.entity'; // Assuming you have a SystemLog entity defined
import { CreateSystemLogDto , QueryDate } from './dto/system-log.dto'; // Assuming you have a DTO for creating system logs
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
@Injectable()
export class SystemLogsService {
    constructor(
        @InjectRepository(SystemLog)
        private readonly systemLogRepo : Repository<SystemLog> , 
    ){

    }

   async getAllByDate(currentUser : any , query : QueryDate ) {
        const allowedRoles = ["ADMIN" , "MANAGER"] ; 
        if(!allowedRoles.includes(currentUser.role)) {
            throw new ForbiddenException("you are not allowed to request for logs.") ; 
        }

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
}