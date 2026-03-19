import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { ExchangeTransactionsService } from './exchange-transactions.service';
import { CreateExchangeTransactionDto } from './dto/exchange-transaction.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('exchange-transactions')
export class ExchangeTransactionsController {
  constructor(private readonly exchangeTransactionsService: ExchangeTransactionsService) {}

  @Post()
  create(@Body() createExchangeTransactionDto: CreateExchangeTransactionDto) {
    return;
  }

  @Get()
  findAll() {
    return ;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return ;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return ;
  }
}