import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SystemLogsService } from '../../modules/system-logs/system-logs.service';
import { CurrenciesService } from '../../modules/currencies/currencies.service';
import { CashCount } from './entities/cash-count.entity';
import { CreateCashCountDto, GetCashCountDto } from './dto/cash-count.dto';
import { EntityManager, Repository } from 'typeorm';
import { string } from 'mathjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransferTransaction } from '../transfer-transactions/entities/transfer-transaction.entity';
import { In } from 'typeorm';
// Assuming you have an entity for cash count

@Injectable()
export class CashCountsService {
  constructor(
    private readonly systemLogsService: SystemLogsService,
    private readonly currenciesService: CurrenciesService,
    @InjectRepository(CashCount)
    private readonly cashCountRepository: Repository<CashCount>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    @InjectRepository(TransferTransaction)
    private readonly transferTransactionRepository: Repository<TransferTransaction>,
  ) {}

  private async log(
    user: any,
    action: string,
    details: string,
    manager?: EntityManager,
  ) {
    await this.systemLogsService.createLog(
      user,
      {
        userId: user?.id || null,
        action,
        details,
      },
      manager, // ส่งต่อ manager เพื่อให้อยู่ใน Transaction เดียวกัน
    );
  }

  async create(
    currentUser: any,
    cashCountData: CreateCashCountDto,
    manager: EntityManager,
  ) {
    try {
      if (cashCountData.denominations.length !== cashCountData.amounts.length) {
        await this.log(
          currentUser,
          'CREATE_CASH_COUNT_FAILED',
          'Denominations and amounts length mismatch',
          manager,
        );
        throw new BadRequestException(
          'Denominations and amounts length mismatch',
        );
      }

      const currencyId = cashCountData.currencyId
        ? cashCountData.currencyId
        : await this.currenciesService.getTHBCurrency();

      const cashCountArr: any[] = [];

      for (let i = 0; i < cashCountData.denominations.length; i++) {
        const denomination = cashCountData.denominations[i].denomination;
        const amount = cashCountData.amounts[i].amount;
        const cashCountObj = {
          transactionId: cashCountData.transactionId,
          currencyId: currencyId,
          denomination: denomination,
          amount: amount,
        };
        cashCountArr.push(cashCountObj);
      }

      const cashCountRepo = manager.getRepository(CashCount);

      const rows = await cashCountRepo.create(cashCountArr);

      await cashCountRepo.save(rows);

      await this.log(
        currentUser,
        'CREATE_CASH_COUNT_SUCCESS',
        `Created cash count for transaction ${cashCountData.transactionId} with total amount ${cashCountData.amounts.reduce((sum, a) => sum + a.amount, 0)}`,
        manager,
      );
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      await this.log(
        currentUser,
        'CREATE_CASH_COUNT_FAILED',
        `Failed to create cash count: ${err}`,
        manager,
      );
      throw new InternalServerErrorException('Failed to create cash count');
    }
  }

  async getCashCountsByTransactionId(getCashCountDto: GetCashCountDto) {
    const cashCount = await this.cashCountRepository.find({
      relations: {
        currency: true,
      },
      where: { transactionId: getCashCountDto.transactionId },
      select: {
        denomination: true,
        amount: true,
        currency: {
          code: true,
        },
      },
    });

    if (cashCount.length === 0) {
      throw new NotFoundException(
        'No cash counts found for the given transaction ID.',
      );
    }

    const THBCashCounts = cashCount.filter((cc) => cc.currency.code === 'THB');
    const foreignCashCounts = cashCount.filter(
      (cc) => cc.currency.code !== 'THB',
    );

    return {
      THB: THBCashCounts,
      foreign: foreignCashCounts,
    };
  }
  async getcashCountfromShiftByCurrency(
    shiftId: string,
    currencyId: string,
  ) {
    console.log(`Getting cash count for shift ${shiftId} and currency ${currencyId}`);
   let CashCountFullData: Record<string, number> = {};
    const cashCountsExchangeTransaction =
      await this.transactionsRepository.find({
        relations: [
          'exchangetransaction',
          'exchangetransaction.cashCounts',
        ],
        where: {
          shiftId,
          type: 'EXCHANGE',
          exchangetransaction: {
            status: In(['COMPLETED', 'PENDING','COMPLETE_CONFIC']),
            cashCounts: {
              currencyId: currencyId,

            },
          },
        },
        select: {
          type: true,
          exchangetransaction: {
            type: true,
            cashCounts: {
              amount: true,
              denomination: true,
            },
          },
        },
      });

    console.log('Cash counts from exchange transactions:', cashCountsExchangeTransaction);
    let THB = (currencyId == (await this.currenciesService.getCurrencyByCode("THB")).id ? -1 : 1)
    let totalExchangedAmount: number = cashCountsExchangeTransaction.reduce((total: number, transaction: any)  => {
        const exchangeType = transaction.exchangetransaction.type;
        const cashCounts = transaction.exchangetransaction.cashCounts || [];

        if (exchangeType === 'BUY') {
          cashCounts.reduce((sum: number, cashCount: any) => {
            if (!CashCountFullData[cashCount.denomination as string]) {
              CashCountFullData[cashCount.denomination as string] = 0;
            }
            CashCountFullData[cashCount.denomination as string] += THB * Number(cashCount.amount);
          }, 0);
        } else if (exchangeType === 'SELL') {
          cashCounts.reduce((sum: number, cashCount: any) => {
            if (!CashCountFullData[cashCount.denomination as string]) {
              CashCountFullData[cashCount.denomination as string] = 0;
            }
            CashCountFullData[cashCount.denomination as string] -= THB * Number(cashCount.amount);
          }, 0);
        }
        return total;
      },
      0,
    );

  
    const transferTransactions = await this.transferTransactionRepository.find({
      where: {
        shiftId,
        status: In(['PENDING', 'COMPLETED','COMPLETE_CONFIC']),
        currencyCode: (await this.currenciesService.findOne(currencyId)).code,
      },
      relations: ["cashCounts"],
      select: {
        amount: true,
        type: true,
        cashCounts: {
          amount: true,
          denomination: true,
        },
      },
    });

    transferTransactions.reduce((total: number, transaction: any)  => {
        const exchangeType = transaction.type;
        const cashCounts = transaction.cashCounts || [];

        if (exchangeType === 'CASH_IN' || exchangeType === 'TRANSFER_IN') {
          cashCounts.reduce((sum: number, cashCount: any) => {
            if (!CashCountFullData[cashCount.denomination as string]) {
              CashCountFullData[cashCount.denomination as string] = 0;
            }
            CashCountFullData[cashCount.denomination as string] += Number(cashCount.amount);
          }, 0);
        } else if (exchangeType === 'CASH_OUT' || exchangeType === 'TRANSFER_OUT') {
          cashCounts.reduce((sum: number, cashCount: any) => {
            console.log('Processing CASH_OUT:', {
              denomination: cashCount.denomination,
              amount: cashCount.amount,
            });
            if (!CashCountFullData[cashCount.denomination as string]) {
              CashCountFullData[cashCount.denomination as string] = 0;
            }
            CashCountFullData[cashCount.denomination as string] -= Number(cashCount.amount);
          }, 0);
        }
        return total;
      },
      0,
    );

    const total = Object.entries(CashCountFullData).reduce((sum, [denomination, amount]) => {
      return sum + Number(denomination) * Number(amount);
    }, 0);

    return {
      totalExchangedAmount: total,
      cashCountDetails: CashCountFullData,
    };
  }
}
