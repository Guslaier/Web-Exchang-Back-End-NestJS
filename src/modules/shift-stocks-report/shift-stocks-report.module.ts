import { Module } from '@nestjs/common';
import { ShiftStocksReportController } from './shift-stocks-report.controller';
import { ShiftStocksReportService } from './shift-stocks-report.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftStocksReport } from './entities/shift-stocks-report.entity';

@Module({
  imports: [ TypeOrmModule.forFeature([ShiftStocksReport])],
  controllers: [ShiftStocksReportController],
  providers: [ShiftStocksReportService],
  exports: [ShiftStocksReportService],
  
})
export class ShiftStocksReportModule {}