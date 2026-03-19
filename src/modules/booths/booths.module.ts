import { Module } from '@nestjs/common';
import { BoothsController } from './booths.controller';
import { BoothsService } from './booths.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booth } from './entities/booth.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booth])],
  controllers: [BoothsController],
  providers: [BoothsService],
  exports: [BoothsService],
})


export class BoothsModule {}