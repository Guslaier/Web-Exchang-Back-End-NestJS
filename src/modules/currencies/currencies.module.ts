// currencies/currencies.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrenciesService } from './currencies.service';
import { Currency } from './entities/currency.entity';
import { SystemLogsModule } from '../system-logs/system-logs.module';
import { CurrenciesController } from './currencies.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Currency]),
    HttpModule, // เพื่อใช้ HttpService
    SystemLogsModule,
  ],
  controllers: [CurrenciesController],
  providers: [CurrenciesService],
  exports: [CurrenciesService],
})
export class CurrenciesModule {}