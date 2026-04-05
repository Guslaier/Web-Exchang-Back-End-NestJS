import { Injectable } from '@nestjs/common';
import { SystemLogsService } from '../../modules/system-logs/system-logs.service';
import { EntityManager } from 'typeorm';
// Assuming you have an entity for cash count

@Injectable()
export class CashCountsService {

    constructor(
        protected readonly systemLogsService: SystemLogsService,
    ) {

    }
    
    private async log(user: any, action: string, details: string, manager?: EntityManager) {
            await this.systemLogsService.createLog(
              user,
              {
                userId: user?.id || null,
                action,
                details,
              },
              manager, // ส่งต่อ manager เพื่อให้อยู่ใน Transaction เดียวกัน
            );
    }
    
}