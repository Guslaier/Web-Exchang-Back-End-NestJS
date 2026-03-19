import { Module } from '@nestjs/common';
import { ShiftThaiCashReportController } from './shift-thai-cash-report.controller';
import { ShiftThaiCashReportService } from './shift-thai-cash-report.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {ShiftThaiCashReport} from './entities/shift-thai-cash-report.entity';
@Module({
  imports: [TypeOrmModule.forFeature([ShiftThaiCashReport])],
  controllers: [ShiftThaiCashReportController],
  providers: [ShiftThaiCashReportService],
  exports: [ShiftThaiCashReportService],
  
})
export class ShiftThaiCashReportModule {}