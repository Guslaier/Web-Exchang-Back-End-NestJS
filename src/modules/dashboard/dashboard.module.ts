import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from '../shifts/entities/shift.entity';
import { ExchangeTransaction } from '../exchange-transactions/entities/exchange-transaction.entity';
import { TransferTransaction } from '../transfer-transactions/entities/transfer-transaction.entity';
import { Stock } from '../stocks/entities/stocks.entitiy';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { ExclusiveExchangeRate } from '../exclusive-exchange-rates/entities/exclusive-exchange-rate.entity';
import { EmployeePerformance } from '../reports/entities/employeePerfor.entity';
import { CashCount } from '../cash-counts/entities/cash-count.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shift,
      ExchangeTransaction,
      TransferTransaction,
      Stock,
      ExchangeRate,
      ExclusiveExchangeRate,
      EmployeePerformance,
      CashCount
    ])
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule { }
