import { Module } from '@nestjs/common';
import { TransferTransactionsController } from './transfer-transactions.controller';
import { TransferTransactionsService } from './transfer-transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransferTransaction } from './entities/transfer-transaction.entity';
import { BoothsModule } from '../booths/booths.module';
import { CurrenciesModule } from '../currencies/currencies.module';
import { CashCountsModule } from '../cash-counts/cash-counts.module';
import { SystemLogsModule } from '../system-logs/system-logs.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { Booth } from '../booths/entities/booth.entity';
import { Currency } from '../currencies/entities/currency.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransferTransaction, Booth, Currency, User]),
    BoothsModule,
    CurrenciesModule,
    CashCountsModule,
    SystemLogsModule,
    TransactionsModule,
  ],
  controllers: [TransferTransactionsController],
  providers: [TransferTransactionsService],
  exports: [TransferTransactionsService],
})
export class TransferTransactionsModule {}