import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { TransferTransactionsService } from './transfer-transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('transfer-transactions')
export class TransferTransactionsController {
  constructor(private readonly transferTransactionsService: TransferTransactionsService) {}

  @Post()
  create() {
    return ;
  }

  @Get()
  findAll() {
    return ;
  }

  @Get(':boothId')
  findByBooth(@Param('boothId') boothId: number) {
    return ;
  }
}