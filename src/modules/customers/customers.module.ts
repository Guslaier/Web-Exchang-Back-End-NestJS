import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { SystemLogsModule } from '../system-logs/system-logs.module';

@Module({
  imports: [TypeOrmModule.forFeature([Customer]) , SystemLogsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
  
})
export class CustomersModule {}