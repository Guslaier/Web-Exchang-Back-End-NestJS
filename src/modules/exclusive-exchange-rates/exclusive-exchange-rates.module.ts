import { forwardRef, Module } from '@nestjs/common';
import { ExclusiveExchangeRatesController } from './exclusive-exchange-rates.controller';
import { ExclusiveExchangeRatesService } from './exclusive-exchange-rates.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExclusiveExchangeRate } from './entities/exclusive-exchange-rate.entity';
import { SystemLogsModule } from '../system-logs/system-logs.module';
import { Booth } from '../booths/entities/booth.entity';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExclusiveExchangeRate, Booth, ExchangeRate]),
    SystemLogsModule,
  ],
  controllers: [ExclusiveExchangeRatesController],
  providers: [ExclusiveExchangeRatesService],
  exports: [ExclusiveExchangeRatesService],
})
export class ExclusiveExchangeRatesModule {}
