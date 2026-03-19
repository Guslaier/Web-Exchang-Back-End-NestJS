import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/currency.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Post()
  create(@Body() createCurrencyDto: CreateCurrencyDto) {
    return ;
  }

  @Get()
  findAll(){
    return ;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return ;
  }
}