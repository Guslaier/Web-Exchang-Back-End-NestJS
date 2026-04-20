import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  EntityManager,
  IsNull,
  MoreThanOrEqual,
  In,
} from 'typeorm';
import { TransferTransaction } from './entities/transfer-transaction.entity';
import {
  CreateTransferTransactionDto,
  TransferBoothToBoothDto,
  TransferCenterToBoothDto,
  UpdateTransferTransactionDto,
  CreateCashCountTransferDto,
} from './dto/transfer-transaction.dto';
import { BoothsService } from '../booths/booths.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { CashCountsService } from '../cash-counts/cash-counts.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Booth } from '../booths/entities/booth.entity';
import { Currency } from '../currencies/entities/currency.entity';
import { User } from '../users/entities/user.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { CashCount } from '../cash-counts/entities/cash-count.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TranType } from 'index';
import { i, number, re, sum, to } from 'mathjs';
import { ShiftsService } from '../shifts/shifts.service';
import { CreateCashCountDto } from '../cash-counts/dto/cash-count.dto';

@Injectable()
export class TransferTransactionsService {
  private readonly logger = new Logger(TransferTransactionsService.name);

  constructor(
    @InjectRepository(TransferTransaction)
    private readonly transferTransactionRepository: Repository<TransferTransaction>,
    @InjectRepository(Booth)
    private readonly boothRepository: Repository<Booth>,
    private readonly dataSource: DataSource,
    @Inject(ShiftsService)
    private readonly shiftsService: ShiftsService,
    @Inject(BoothsService)
    private readonly boothsService: BoothsService,
    @Inject(CurrenciesService)
    private readonly currenciesService: CurrenciesService,
    @Inject(CashCountsService)
    private readonly cashCountsService: CashCountsService,
    @Inject(SystemLogsService)
    private readonly systemLogsService: SystemLogsService,
    @Inject(TransactionsService)
    private readonly transactionsService: TransactionsService,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
  ) {}

  /**
   * Helper method to log actions
   */
  private async log(
    user: any,
    action: string,
    details: string,
    manager?: EntityManager,
  ) {
    try {
      await this.systemLogsService.createLog(
        user,
        {
          userId: user?.id || null,
          action,
          details,
        },
        manager,
      );
    } catch (error) {
      this.logger.error(
        `Failed to log action ${action}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async createMovement(
    user: any,
    createDto: CreateTransferTransactionDto,
    manager: EntityManager,
  ) {
    const transaction = await this.transactionsService.create(manager, {
      type: 'TRANSFER',
      shiftId: null, // กำหนด shiftId เป็น null สำหรับ movement
    });

    const transferTransaction = manager
      .getRepository(TransferTransaction)
      .create({
        id: transaction.id, // ใช้ ID เดียวกับ Transaction
        userId: createDto.userId,
        boothId: createDto.boothId,
        shiftId: createDto.shiftId,
        refBoothId: createDto.refBoothId,
        refShiftId: createDto.refShiftId,
        currencyCode: createDto.currencyCode,
        amount: createDto.amount,
        type: createDto.type,
        description: createDto.description,
        status: createDto.status,
      });
    try {
      await manager
        ?.getRepository(TransferTransaction)
        .save(transferTransaction);
      await this.log(
        user,
        'CREATE_MOVEMENT',
        `Created movement of ${createDto.amount} ${createDto.currencyCode} for booth ${createDto.boothId}`,
        manager,
      );
      return transferTransaction;
    } catch (error) {
      try {
        await this.log(
          user,
          'CREATE_MOVEMENT_FAILED',
          `Failed to create movement of ${createDto.amount} ${createDto.currencyCode} for booth ${createDto.boothId}`,
          manager,
        );
      } catch (logError) {
        this.logger.error(
          `Failed to log movement creation failure: ${logError instanceof Error ? logError.message : String(logError)}`,
        );
      }
      throw new InternalServerErrorException('Failed to create movement');
    }
  }

  // โอนระหว่างบูธที่มีสกุลเงินเป็น THB โดยตรวจสอบยอดแลกเงินและยอดโอนในกะนั้นๆ เพื่อป้องกันการโอนเกินยอดที่มีอยู่ในกะนั้น
  async transferBoothToBoothWithCurrencyTHB(
    user: any,
    transferDto: TransferBoothToBoothDto,
    sourceActiveShift: Shift,
    targetActiveShift: Shift,
    manager: EntityManager,
  ) {
    // ตรวจสอบยอดเงินในกะของบูธต้นทาง
    const balanceCheck = sourceActiveShift.balance || 0;
    if (balanceCheck < transferDto.amount) {
      throw new BadRequestException(
        `Insufficient balance in source booth. Available: ${balanceCheck}, Required: ${transferDto.amount}`,
      );
    }

    let denominations = transferDto.cashCountData.map((item) => ({
      denomination: item.denomination,
    }));
    let amounts = transferDto.cashCountData.map((item) => ({
      amount: item.amount,
    }));
    const sumCashCount = transferDto.cashCountData.reduce((acc, item) => {
      return acc + Number(item.amount) * Number(item.denomination);
    }, 0);

    if (sumCashCount !== transferDto.amount) {
      throw new BadRequestException(
        `Total cash count amount (${sumCashCount}) does not match transfer amount (${transferDto.amount})`,
      );
    }

    const cashCountCheckBycheck = await this.cashCountsService.getcashCountfromShiftByCurrency(sourceActiveShift.id, (await this.currenciesService.getCurrencyByCode(transferDto.currencyCode)).id as unknown as string);
    transferDto.cashCountData.forEach((item) => {
      if (!cashCountCheckBycheck.cashCountDetails[item.denomination] || cashCountCheckBycheck.cashCountDetails[item.denomination] < item.amount) {
        throw new BadRequestException(`Insufficient cash count for denomination ${item.denomination}`);
      }
    });

    const transferTransactionFormainBooth = await this.createMovement(
      user,
      {
        userId: user.id,
        boothId: transferDto.boothId,
        shiftId: sourceActiveShift.id,
        refBoothId: transferDto.refBoothId,
        refShiftId: targetActiveShift.id,
        currencyCode: transferDto.currencyCode,
        amount: transferDto.amount,
        type: 'TRANSFER_OUT',
        description: transferDto.description,
        status: 'COMPLETED',
      },
      manager,
    );


    const transferTransactionForTargetBooth = await this.createMovement(
      user,
      {
        userId: user.id,
        boothId: transferDto.refBoothId,
        shiftId: targetActiveShift.id,
        refBoothId: transferDto.boothId,
        refShiftId: sourceActiveShift.id,
        currencyCode: transferDto.currencyCode,
        amount: transferDto.amount,
        type: 'TRANSFER_IN',
        description: transferDto.description,
        status: 'COMPLETED',
      },
      manager,
    );

    let currencyId =
      (await this.currenciesService.getTHBCurrency()) as unknown as string;
    const cashCountData_mainBooth: CreateCashCountDto = {
      transactionId: transferTransactionFormainBooth.id,
      currencyId,
      denominations,
      amounts,
    };

    const cashCountData_targetBooth: CreateCashCountDto = {
      transactionId: transferTransactionForTargetBooth.id,
      currencyId,
      denominations,
      amounts,
    };

    await this.cashCountsService.create(user, cashCountData_mainBooth, manager);
    await this.cashCountsService.create(
      user,
      cashCountData_targetBooth,
      manager,
    );

    await this.shiftsService.setTotalExchange(
      transferDto.boothId,
      transferDto.amount,
      manager,
    );
    await this.shiftsService.setTotalReceive(
      transferDto.refBoothId,
      transferDto.amount,
      manager,
    );

    return {
      message: `Successfully transferred`,
      transactionId: transferTransactionFormainBooth.id,
      fromBooth: transferDto.boothId,
      transactionIdForTargetBooth: transferTransactionForTargetBooth.id,
      toBooth: transferDto.refBoothId,
      amount: transferDto.amount,
      currency: transferDto.currencyCode,
      balanceAfterTransfer: balanceCheck - transferDto.amount,
      cashCounts: cashCountData_mainBooth.amounts.map((item, index) => ({
        denomination: cashCountData_mainBooth.denominations[index].denomination,
        amount: item.amount,
      })),
    };
  }

  async transferBoothToBooth(user: any, transferDto: TransferBoothToBoothDto) {
    if (transferDto.amount <= 0) {
      throw new BadRequestException(
        'Transfer amount must be greater than zero',
      );
    }
    return await this.dataSource.transaction(async (manager) => {
      // Validate booths
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const sourceBooth = await manager
        .getRepository(Booth)
        .findOne({ where: { id: transferDto.boothId, isActive: true } });
      if (!sourceBooth) {
        throw new NotFoundException(
          `Source booth with ID ${transferDto.boothId} not found or inactive`,
        );
      }

      // ถ้า boothId ไม่มีการเปิดกะอยู่ จะไม่อนุญาตให้ทำรายการโอนระหว่างบูธ
      const activeShift = await manager.getRepository(Shift).findOne({
        where: {
          boothId: transferDto.boothId,
          endTime: IsNull(),
        },
      });

      if (!activeShift) {
        throw new BadRequestException(
          `Source booth with ID ${transferDto.boothId} does not have an active shift`,
        );
      }
      //ถ้าเป็นการโอนระหว่างบูธ ต้องตรวจสอบว่า refBoothId ไม่ใช่ null
      const targetBooth = await manager
        .getRepository(Booth)
        .findOne({ where: { id: transferDto.refBoothId, isActive: true } });
      if (!targetBooth) {
        throw new NotFoundException(
          `Target booth with ID ${transferDto.refBoothId} not found or inactive`,
        );
      }
      // ถ้า targetBoothId ไม่มีการเปิดกะอยู่ จะไม่อนุญาตให้ทำรายการโอนระหว่างบูธ
      const targetActiveShift = await manager.getRepository(Shift).findOne({
        where: { boothId: transferDto.refBoothId, endTime: IsNull() },
      });
      if (!targetActiveShift) {
        throw new BadRequestException(
          `Target booth with ID ${transferDto.refBoothId} does not have an active shift`,
        );
      }

      // เช็คว่าบูธต้นทางและปลายทางไม่เหมือนกัน
      if (transferDto.boothId === transferDto.refBoothId) {
        throw new BadRequestException(
          'Source and target booths cannot be the same',
        );
      }

      // Validate currency
      const currency = await manager
        .getRepository(Currency)
        .findOne({ where: { code: transferDto.currencyCode } });
      if (!currency) {
        throw new NotFoundException(
          `Currency with code ${transferDto.currencyCode} not found`,
        );
      }

      // ถ้าเป็นการโอนระหว่างบูธที่มีสกุลเงินเป็น THB จะต้องใช้วิธีการโอนแบบเฉพาะที่ตรวจสอบยอดแลกเงินและยอดโอนในกะนั้นๆ เพื่อป้องกันการโอนเกินยอดที่มีอยู่ในกะนั้น
      if (transferDto.currencyCode == 'THB') {
        return this.transferBoothToBoothWithCurrencyTHB(
          user,
          transferDto,
          activeShift,
          targetActiveShift,
          manager,
        );
      }

      // ตรวจสอบว่ามีการทำรายการแลกเงินที่เกี่ยวข้องกับสกุลเงินนี้ในกะนั้นหรือไม่ ถ้ามีจะไม่อนุญาตให้ทำการโอนระหว่างบูธ==============================
      const checkCashCount = await manager.getRepository(Transaction).find({
        relations: [
          'exchangetransaction',
          'exchangetransaction.exchangeRateFK.currency',
        ],
        where: {
          shiftId: activeShift.id,
          type: 'EXCHANGE',
          exchangetransaction: {
            status: In(['COMPLETED', 'PENDING']),
            exchangeRateFK: { currency: { code: transferDto.currencyCode } },
          },
        },
        select: {
          id: true,
          shiftId: true,
          type: true,
          exchangetransaction: {
            id: true,
            foreignCurrencyAmount: true,
            type: true,
            exchangeRateFK: {
              currency: {
                code: true,
              },
            },
          },
        },
      });

      const totalExchangedAmount = checkCashCount.reduce(
        (total, transaction) => {
          total +=
            transaction.exchangetransaction.type === 'BUY'
              ? Number(transaction.exchangetransaction.foreignCurrencyAmount) ||
                0
              : -Number(
                  transaction.exchangetransaction.foreignCurrencyAmount,
                ) || 0;
          return total;
        },
        0,
      );
      //============================================================================================================================

      //รวมค่าเลฃงินจา terfer-transaction ที่มีสถานะเป็น PENDING หรือ COMPLETED ในกะนั้นที่เกี่ยวข้องกับสกุลเงินนี้ ถ้าผลรวมมากกว่าจำนวนเงินที่ต้องการโอน จะไม่อนุญาตให้ทำการโอนระหว่างบูธ
      const transferTransactions = await manager
        .getRepository(TransferTransaction)
        .find({
          where: {
            shiftId: activeShift.id,
            currencyCode: transferDto.currencyCode,
            status: In(['PENDING', 'COMPLETED']),
          },
        });
      const totalTransferredAmount = transferTransactions.reduce(
        (total, tran) => {
          if (tran.type === 'TRANSFER_OUT') {
            total -= number(tran.amount || 0);
          } else if (tran.type === 'TRANSFER_IN') {
            total += number(tran.amount || 0);
          }
          return total;
        },
        0,
      );

      console.log('Total exchanged amount:', totalExchangedAmount);
      let countSummary = totalExchangedAmount + totalTransferredAmount;

      // ตรวจสอบว่าจำนวนเงินที่ต้องการโอนมากกว่าจำนวนเงินที่แลกในกะนั้นหรือไม่ ถ้ามากกว่าจะไม่อนุญาตให้ทำการโอนระหว่างบูธ
      if (countSummary < transferDto.amount) {
        throw new BadRequestException(
          `Cannot transfer ${transferDto.amount} ${transferDto.currencyCode} because total exchanged amount in active shift is only ${countSummary} ${transferDto.currencyCode}`,
        );
      }

      const transferTransactionFormainBooth = await this.createMovement(
        user,
        {
          boothId: transferDto.boothId,
          shiftId: activeShift.id,
          refBoothId: transferDto.refBoothId,
          refShiftId: targetActiveShift.id,
          amount: transferDto.amount,
          currencyCode: transferDto.currencyCode,
          type: 'TRANSFER_OUT',
          description: transferDto.description,
          userId: user?.id || null,
          status: 'COMPLETED',
        },
        manager,
      );

      const cashCountData_mainBooth: CreateCashCountDto = {
        transactionId: transferTransactionFormainBooth.id,
        currencyId: currency.id,
        denominations: [{ denomination: '1' }],
        amounts: [{ amount: transferDto.amount }],
      };

      const transferTransactionForTargetBooth = await this.createMovement(
        user,
        {
          boothId: transferDto.refBoothId,
          shiftId: targetActiveShift.id,
          refBoothId: transferDto.boothId,
          refShiftId: activeShift.id,
          amount: transferDto.amount,
          currencyCode: transferDto.currencyCode,
          type: 'TRANSFER_IN',
          description: transferDto.description,
          userId: user.id,
          status: 'COMPLETED',
        },
        manager,
      );

      const cashCountData_targetBooth: CreateCashCountDto = {
        transactionId: transferTransactionForTargetBooth.id,
        currencyId: currency.id,
        denominations: [{ denomination: '1' }],
        amounts: [{ amount: transferDto.amount }],
      };

      await this.cashCountsService.create(user, cashCountData_mainBooth, manager);
      await this.cashCountsService.create(
        user,
        cashCountData_targetBooth,
        manager,
      );
      return {
        message: 'Successfully transferred',
        transactionId: transferTransactionFormainBooth.id,
        fromBooth: transferDto.boothId,
        transactionIdForTargetBooth: transferTransactionForTargetBooth.id,
        toBooth: transferDto.refBoothId,
        amount: transferDto.amount,
        currency: transferDto.currencyCode,
        balanceAfterTransfer: countSummary - transferDto.amount, // บอกยอดคงเหลือในกะหลังโอน
      };
    });
  }

  async transferCenterToBooth(
    user: any,
    transferDto: TransferCenterToBoothDto,
  ) {
    return await this.dataSource.transaction(async (manager) => {
      if (transferDto.amount <= 0) {
        throw new BadRequestException(
          'Transfer amount must be greater than zero',
        );
      }

      const targetBooth = await manager
        .getRepository(Booth)
        .findOne({ where: { id: transferDto.boothId, isActive: true } });
      if (!targetBooth) {
        throw new NotFoundException(
          `Target booth with ID ${transferDto.boothId} not found or inactive`,
        );
      }

      const targetActiveShift = await manager.getRepository(Shift).findOne({
        where: { boothId: transferDto.boothId, endTime: IsNull() },
      });
      if (!targetActiveShift) {
        throw new BadRequestException(
          `Target booth with ID ${transferDto.boothId} does not have an active shift`,
        );
      }
      const currency = await manager
        .getRepository(Currency)
        .findOne({ where: { code: transferDto.currencyCode } });
      if (!currency) {
        throw new NotFoundException(
          `Currency with code ${transferDto.currencyCode} not found`,
        );
      }

      let denominations = transferDto.cashCountData.map((item) => ({
        denomination: item.denomination,
      }));
      let amounts = transferDto.cashCountData.map((item) => ({
        amount: item.amount,
      }));


      const sumCashCount = transferDto.cashCountData.reduce((acc, item) => {
        return acc + Number(item.amount) * Number(item.denomination);
      }, 0);

      if (sumCashCount !== transferDto.amount) {
        throw new BadRequestException(
          `Total cash count amount (${sumCashCount}) does not match transfer amount (${transferDto.amount})`,
        );
      }
      
      if (transferDto.type === 'CASH_IN') {
        return await this.tnfCtoB_CashIn(
          user,
          transferDto,
          targetActiveShift,
          currency,
          amounts,
          denominations,
          manager,
        );
      } else if (transferDto.type === 'CASH_OUT') {
        return await this.tnfCtoB_CashOut(
          user,
          transferDto,
          targetActiveShift,
          currency,
          amounts,
          denominations,
          manager,
        );
      }
    });
  }

  async tnfCtoB_CashIn(
    user: any,
    transferDto: TransferCenterToBoothDto,
    targetActiveShift: Shift,
    currency: Currency,
    amounts: { amount: number }[],
    denominations: { denomination: string }[],
    manager: EntityManager,
  ) {

    const transferTransactionForTargetBooth = await this.createMovement(
      user,
      {
        boothId: transferDto.boothId,
        shiftId: targetActiveShift.id,
        amount: transferDto.amount,
        currencyCode: transferDto.currencyCode,
        type: 'CASH_IN',
        description: transferDto.description,
        userId: user.id,
        status: 'COMPLETED',
      },
      manager,
    );

    const cashCountData_targetBooth: CreateCashCountDto = {
      transactionId: transferTransactionForTargetBooth.id,
      currencyId: currency.id,
      denominations,
      amounts,
    };
    await this.cashCountsService.create(
      user,
      cashCountData_targetBooth,
      manager,
    );

    await this.shiftsService.setTotalReceive(
      transferDto.boothId,
      transferDto.amount,
      manager,
    );

    return {
      message: 'Successfully transferred from Center to Booth',
      transactionId: transferTransactionForTargetBooth.id,
      toBooth: transferDto.boothId,
      amount: transferDto.amount,
      currency: transferDto.currencyCode,
      cashCounts: cashCountData_targetBooth.amounts.map((item, index) => ({
        denomination:
          cashCountData_targetBooth.denominations[index].denomination,
        amount: item.amount,
      })),
    };
  }

  async tnfCtoB_CashOut(
    user: any,
    transferDto: TransferCenterToBoothDto,
    targetActiveShift: Shift,
    currency: Currency,
    amounts: { amount: number }[],
    denominations: { denomination: string }[],
    manager: EntityManager,
  ) {
    const cashCountCheckBycheck = await this.cashCountsService.getcashCountfromShiftByCurrency(targetActiveShift.id, (await this.currenciesService.getCurrencyByCode(transferDto.currencyCode)).id as unknown as string);
    transferDto.cashCountData.forEach((item) => {
      if (!cashCountCheckBycheck.cashCountDetails[item.denomination] || cashCountCheckBycheck.cashCountDetails[item.denomination] < item.amount) {
        throw new BadRequestException(`Insufficient cash count for denomination ${item.denomination}`);
      }
    });
    const transferTransactionForTargetBooth = await this.createMovement(
      user,
      {
        boothId: transferDto.boothId,
        shiftId: targetActiveShift.id,
        amount: transferDto.amount,
        currencyCode: transferDto.currencyCode,
        type: 'CASH_OUT',
        description: transferDto.description,
        userId: user.id,
        status: 'COMPLETED',
      },
      manager,
    );

    const cashCountData_targetBooth: CreateCashCountDto = {
      transactionId: transferTransactionForTargetBooth.id,
      currencyId: currency.id,
      denominations,
      amounts,
    };
    await this.cashCountsService.create(
      user,
      cashCountData_targetBooth,
      manager,
    );

    await this.shiftsService.setTotalExchange(
      transferDto.boothId,
      transferDto.amount,
      manager,
    );

    return {
      message: 'Successfully transferred from Booth to Center',
      transactionId: transferTransactionForTargetBooth.id,
      fromBooth: transferDto.boothId,
      amount: transferDto.amount,
      currency: transferDto.currencyCode,
      cashCounts: cashCountData_targetBooth.amounts.map((item, index) => ({
        denomination:
          cashCountData_targetBooth.denominations[index].denomination,
        amount: item.amount,
      })),
    };
  }

  

}