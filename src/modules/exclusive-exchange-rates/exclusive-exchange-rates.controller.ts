import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ExclusiveExchangeRatesService } from './exclusive-exchange-rates.service';
import { CreateExclusiveExchangeRateDto } from './dto/exclusive-exchange-rate.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('exclusive-exchange-rates')
export class ExclusiveExchangeRatesController {
  constructor(private readonly exclusiveExchangeRatesService: ExclusiveExchangeRatesService) {}

  @Post()
  create(@Body() createExclusiveExchangeRateDto: CreateExclusiveExchangeRateDto) {
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