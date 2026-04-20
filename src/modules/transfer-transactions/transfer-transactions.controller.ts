import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Patch,
  Delete,
  UseFilters,
  Inject,
} from '@nestjs/common';
import { TransferTransactionsService } from './transfer-transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateTransferTransactionDto,
  TransferBoothToBoothDto,
  TransferCenterToBoothDto,
  UpdateTransferTransactionDto,
  CreateCashCountTransferDto,
} from './dto/transfer-transaction.dto';
import { get } from 'http';
import { CurrenciesService } from '../currencies/currencies.service';
import { In } from 'typeorm';
import { CashCountsService } from '../cash-counts/cash-counts.service';

@Controller('transfer-transactions')
export class TransferTransactionsController {
  constructor(
    private readonly transferTransactionsService: TransferTransactionsService,
    @Inject(CurrenciesService)
    private readonly currenciesService: CurrenciesService,
    @Inject(CashCountsService)
    private readonly cashCountsService: CashCountsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Post('booth-to-booth')
  async transferBoothToBooth(
    @Body() transferBoothToBoothDto: TransferBoothToBoothDto,
    @CurrentUser() user: any,
  ) {
    return this.transferTransactionsService.transferBoothToBooth(
      user,
      transferBoothToBoothDto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Post('center-to-booth')
  async transferCenterToBooth(
    @Body() transferCenterToBoothDto: TransferCenterToBoothDto,
    @CurrentUser() user: any,
  ) {
    return this.transferTransactionsService.transferCenterToBooth(
      user,
      transferCenterToBoothDto,
    );
  
  }

  @Get('/sum')
  async getTransferTransactionById(@Body() body: {id: string,currencyCode: string}) {
    return this.cashCountsService.getcashCountfromShiftByCurrency(body.id,(await this.currenciesService.getCurrencyByCode(body.currencyCode)).id as unknown as string);
  }
}
