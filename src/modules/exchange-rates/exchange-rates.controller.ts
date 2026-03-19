import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import { CreateExchangeRateDto } from './dto/exchange-rate.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Post()
  create(@Body() createExchangeRateDto: CreateExchangeRateDto) {
    return ;
  }

  @Get()
  findAll() {
    return ;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return ;
  }

  @Post(':id')
  update(@Param('id') id: string) {
    return ;
  }
}