import { Module, forwardRef } from '@nestjs/common';
import { BoothsController } from './booths.controller';
import { BoothsService } from './booths.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booth } from './entities/booth.entity';
import { User } from '../users/entities/user.entity';
import { SystemLogsModule } from '../system-logs/system-logs.module';
import { ExclusiveExchangeRatesModule } from '../exclusive-exchange-rates/exclusive-exchange-rates.module';
import { TransferTransactionsModule } from '../transfer-transactions/transfer-transactions.module' ;
import { Shift } from '../shifts/entities/shift.entity';
import { SseModule } from '../sse/sse.module';
import { SharedShiftsModule } from '../shared-shifts/shared-shifts.module';
import { StocksModule } from '../stocks/stocks.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booth, User, Shift]),
    SystemLogsModule,
    ExclusiveExchangeRatesModule,
    SseModule,
    SharedShiftsModule,
    forwardRef(() => StocksModule),
    forwardRef(() => TransferTransactionsModule),
  ],
  controllers: [BoothsController],
  providers: [BoothsService],
  exports: [BoothsService],
})
export class BoothsModule {}
