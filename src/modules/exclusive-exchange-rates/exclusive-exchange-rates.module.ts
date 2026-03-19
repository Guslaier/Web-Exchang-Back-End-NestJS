import { Module } from '@nestjs/common';
import { ExclusiveExchangeRatesController } from './exclusive-exchange-rates.controller';
import { ExclusiveExchangeRatesService } from './exclusive-exchange-rates.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExclusiveExchangeRate } from './entities/exclusive-exchange-rate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExclusiveExchangeRate])],
  controllers: [ExclusiveExchangeRatesController],
  providers: [ExclusiveExchangeRatesService],
  exports: [ExclusiveExchangeRatesService],
  
})
export class ExclusiveExchangeRatesModule {}