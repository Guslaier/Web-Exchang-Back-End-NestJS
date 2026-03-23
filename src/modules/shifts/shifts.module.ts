import { Module } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { BoothsModule } from '../../modules/booths/booths.module';
import { SystemLogsModule } from '../../modules/system-logs/system-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Shift]) , BoothsModule , SystemLogsModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
  
})
export class ShiftsModule {}