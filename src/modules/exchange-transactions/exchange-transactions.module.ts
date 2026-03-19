import { Module } from '@nestjs/common';
import { ExchangeTransactionsController } from './exchange-transactions.controller';
import { ExchangeTransactionsService } from './exchange-transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeTransaction } from './entities/exchange-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeTransaction])],
  controllers: [ExchangeTransactionsController],
  providers: [ExchangeTransactionsService],
  exports: [ExchangeTransactionsService],
  
})
export class ExchangeTransactionsModule {}