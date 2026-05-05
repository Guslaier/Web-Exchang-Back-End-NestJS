import { Injectable } from "@nestjs/common";
import { PutShiftBody } from './dto/report.dto' ; 
import { ShiftsService } from './../shifts/shifts.service'

@Injectable() 
export class ReportsService {
    constructor(
        private readonly shiftService : ShiftsService ; 
    ) 
    {}
    //helper
    //create
    //read
    //update
    async updateAuditShift(user : any , id : string , paras : PutShiftBody) {
        // 1.ตรวจสอบกะ
            // 1.1 กะไม่มีอยู่จริง ปฏิเสธ
            // 1.2 กะไม่มีสถานะเป็น 'CLOSE' ปฏิเสธ
        const shiftData = await this.shiftService.getShiftWithCloseStatusOrFail(user , id , 'AUDIT_SHIFT') ;
        
        // 2.บันทึกธุรกรรม 
        
        
    }
    //delete

}