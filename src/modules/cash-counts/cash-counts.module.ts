import { Module } from '@nestjs/common';
import { CashCountsService } from './cash-counts.service';
import { CashCountsController } from './cash-counts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashCount } from './entities/cash-count.entity';
import { SystemLogsModule } from '../../modules/system-logs/system-logs.module';
import { CurrenciesModule } from '../../modules/currencies/currencies.module';

@Module({
  imports: [TypeOrmModule.forFeature([CashCount]) , SystemLogsModule , CurrenciesModule],
  controllers: [CashCountsController],
  providers: [CashCountsService],
  exports: [CashCountsService],
})
export class CashCountsModule {}