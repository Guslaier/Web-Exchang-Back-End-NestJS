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
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransferTransactionsController {
  constructor(private readonly transferTransactionsService: TransferTransactionsService) {}

  /**
   * Create a new internal movement
   */
  @Post('movements')
  @Roles('ADMIN', 'MANAGER')
  async createMovement(
    @CurrentUser() user: any,
    @Body() createDto: CreateTransferTransactionDto,
  ) {
    const result = await this.transferTransactionsService.createMovement(user, createDto);
    return {
      success: result,
      message: 'Movement created successfully',
    };
  }

  /**
   * Transfer between booths
   */
  @Post('booth-to-booth')
  @Roles('ADMIN', 'MANAGER')
  async transferBoothToBooth(
    @CurrentUser() user: any,
    @Body() transferDto: TransferBoothToBoothDto,
  ) {
    const result = await this.transferTransactionsService.transferBoothToBooth(
      user,
      transferDto,
    );
    return {
      success: result,
      message: 'Booth-to-booth transfer completed successfully',
    };
  }

  /**
   * Transfer from center to booth
   */
  @Post('center-to-booth')
  @Roles('ADMIN', 'MANAGER')
  async transferCenterToBooth(
    @CurrentUser() user: any,
    @Body() transferDto: TransferCenterToBoothDto,
  ) {
    const result = await this.transferTransactionsService.transferCenterToBooth(
      user,
      transferDto,
    );
    return {
      success: result,
      message: 'Center-to-booth transfer completed successfully',
    };
  }

  /**
   * Create a transfer transaction
   */
  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(
    @CurrentUser() user: any,
    @Body() createDto: CreateTransferTransactionDto,
  ) {
    const transfer = await this.transferTransactionsService.create(user, createDto);
    return {
      success: true,
      data: transfer,
      message: 'Transfer transaction created successfully',
    };
  }

  /**
   * Get all transfer transactions
   */
  @Get('all')
  @Roles('ADMIN', 'MANAGER', 'EMPLOYEE')
  async findAll() {
    const transfers = await this.transferTransactionsService.get_transfers();
    return {
      success: true,
      data: transfers,
      count: transfers.length,
    };
  }

  /**
   * Get transfers for a specific booth
   */
  @Get('booth/:boothId')
  async findByBooth(@Param('boothId') boothId: string) {
    const transfers = await this.transferTransactionsService.get_transfers_per_Booth(boothId);
    return {
      success: true,
      data: transfers,
      count: transfers.length,
    };
  }

  /**
   * Get all booth-to-booth transfers
   */
  @Get('booth-transfers')
  async getBoothToBoothTransfers() {
    const transfers =
      await this.transferTransactionsService.get_transfers_Booth_To_Booth();
    return {
      success: true,
      data: transfers,
      count: transfers.length,
    };
  }

  /**
   * Get cash inventory for a booth
   */
  @Get('inventory/:boothId')
  async getCashInventory(@Param('boothId') boothId: string) {
    const inventory = await this.transferTransactionsService.get_CashInventory(boothId);
    return {
      success: true,
      data: {
        boothId,
        inventory,
      },
    };
  }

  /**
   * Get total received amount for a shift
   */
  @Get('total-receive/:shiftId')
  async getTotalReceive(@Param('shiftId') shiftId: string) {
    const total = await this.transferTransactionsService.get_totalReceive(shiftId);
    return {
      success: true,
      data: {
        shiftId,
        totalReceived: total,
      },
    };
  }

  /**
   * Get a single transfer transaction by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const transfer = await this.transferTransactionsService.findOne(id);
    return {
      success: true,
      data: transfer,
    };
  }

  /**
   * Update a transfer transaction
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateTransferTransactionDto,
  ) {
    const transfer = await this.transferTransactionsService.update(user, id, updateDto);
    return {
      success: true,
      data: transfer,
      message: 'Transfer transaction updated successfully',
    };
  }

  /**
   * Delete a transfer transaction
   */
  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    await this.transferTransactionsService.remove(user, id);
    return {
      success: true,
      message: 'Transfer transaction deleted successfully',
    };
  }
}