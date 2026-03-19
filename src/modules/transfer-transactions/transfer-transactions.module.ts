import { Module } from '@nestjs/common';
import { TransferTransactionsController } from './transfer-transactions.controller';
import { TransferTransactionsService } from './transfer-transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransferTransaction } from './entities/transfer-transaction.entity'; 

@Module({
  imports: [TypeOrmModule.forFeature([TransferTransaction])],
  controllers: [TransferTransactionsController],
  providers: [TransferTransactionsService],
  exports: [TransferTransactionsService],
  
})
export class TransferTransactionsModule {}