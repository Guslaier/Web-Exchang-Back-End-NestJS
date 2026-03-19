import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return ;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return ;
  }
}