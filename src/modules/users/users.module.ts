import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RedisModule } from '../redis/redis.module';
import { SystemLogsModule } from '../system-logs/system-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RedisModule,SystemLogsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}