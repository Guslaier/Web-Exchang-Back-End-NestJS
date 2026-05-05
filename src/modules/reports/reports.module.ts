import { Module } from "@nestjs/common";
import { ReportsController} from './reports.controller' ; 
import { ReportsService } from './reports.service' ; 
import { ShiftsModule } from './../shifts/shifts.module' ;
// import { Tra} 

@Module({
    imports :[ShiftsModule] ,
    controllers : [ReportsController] , 
    providers : [ReportsService] , 
    exports :[ReportsService] ,
})
export class ReportsModule {}