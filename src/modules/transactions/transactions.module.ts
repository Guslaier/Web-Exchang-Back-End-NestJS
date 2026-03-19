import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransferTransaction } from '../transfer-transactions/entities/transfer-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TransferTransaction])],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}