import { Module } from '@nestjs/common';
import { CashCountsService } from './cash-counts.service';
import { CashCountsController } from './cash-counts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashCount } from './entities/cash-count.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashCount])],
  controllers: [CashCountsController],
  providers: [CashCountsService],
  exports: [CashCountsService],
})
export class CashCountsModule {}