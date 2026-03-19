import { Module } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { ShiftsController } from './shifts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Shift])],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
  
})
export class ShiftsModule {}