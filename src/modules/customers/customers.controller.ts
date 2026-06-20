import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, GetCustomerDto, GetImgDto } from './dto/customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYEE', 'MANAGER', 'ADMIN')
  @Get()
  findOne(
    @CurrentUser() currentUser: any,
    @Query() query: GetCustomerDto,
  ) {
    return this.customersService.findById(currentUser, query.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYEE', 'MANAGER', 'ADMIN')
  @Get('image')
  getCustomerImage(
    @CurrentUser() currentUser: any,
    @Query() query: GetImgDto,
  ) {
    return this.customersService.getImg(currentUser, query.id);
  }
}
