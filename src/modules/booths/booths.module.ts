import { Module } from '@nestjs/common';
import { BoothsController } from './booths.controller';
import { BoothsService } from './booths.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booth } from './entities/booth.entity';
import { User } from '../users/entities/user.entity';
import { SystemLogsModule } from '../system-logs/system-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booth, User]), SystemLogsModule],
  controllers: [BoothsController],
  providers: [BoothsService],
  exports: [BoothsService],
})


export class BoothsModule {}