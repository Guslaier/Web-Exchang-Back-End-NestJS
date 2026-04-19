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
} from './dto/transfer-transaction.dto';

@Controller('transfer-transactions')
export class TransferTransactionsController {
  constructor(
    private readonly transferTransactionsService: TransferTransactionsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Post('booth-to-booth')
  async transferBoothToBooth(
    @Body() transferBoothToBoothDto: TransferBoothToBoothDto,
    @CurrentUser() user: any,
  ) {
    return this.transferTransactionsService.transferBoothToBooth(user, transferBoothToBoothDto);
  
}
}