import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from '../shifts/entities/shift.entity';
import { SystemLogsModule } from '../system-logs/system-logs.module';
import { SseModule } from '../sse/sse.module';
import { SharedShiftsService } from './shared-shifts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Shift]),
    SystemLogsModule,
    SseModule,
  ],
  providers: [SharedShiftsService],
  exports: [SharedShiftsService],
})
export class SharedShiftsModule {}
