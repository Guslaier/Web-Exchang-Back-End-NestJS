import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransferTransaction } from '../transfer-transactions/entities/transfer-transaction.entity';
import { ExchangeTransaction } from '../exchange-transactions/entities/exchange-transaction.entity';
import { SharedTransactionsService } from './shared-transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransferTransaction, ExchangeTransaction]),
  ],
  providers: [SharedTransactionsService],
  exports: [SharedTransactionsService],
})
export class SharedTransactionsModule {}
