import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Shift } from '../shifts/entities/shift.entity';
import { ExchangeTransaction } from '../exchange-transactions/entities/exchange-transaction.entity';
import { TransferTransaction } from '../transfer-transactions/entities/transfer-transaction.entity';
import { Stock } from '../stocks/entities/stocks.entitiy';
import { ExchangeRate } from '../exchange-rates/entities/exchange-rate.entity';
import { ExclusiveExchangeRate } from '../exclusive-exchange-rates/entities/exclusive-exchange-rate.entity';
import { EmployeePerformance } from '../reports/entities/employeePerfor.entity';
import { CashCount } from '../cash-counts/entities/cash-count.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(ExchangeTransaction) private exchangeRepo: Repository<ExchangeTransaction>,
    @InjectRepository(TransferTransaction) private transferRepo: Repository<TransferTransaction>,
    @InjectRepository(Stock) private stockRepo: Repository<Stock>,
    @InjectRepository(ExchangeRate) private exchangeRateRepo: Repository<ExchangeRate>,
    @InjectRepository(ExclusiveExchangeRate) private exclusiveRateRepo: Repository<ExclusiveExchangeRate>,
    @InjectRepository(EmployeePerformance) private employeePerfRepo: Repository<EmployeePerformance>,
    @InjectRepository(CashCount) private cashCountRepo: Repository<CashCount>,
  ) {}

  async getSummary(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. Daily & Shift Overview
    const activeShifts = await this.shiftRepo.find({
      where: { status: 'OPEN' },
      relations: ['user', 'booth'],
      select: {
        id: true,
        startTime: true,
        cash_advance: true,
        balance_check: true,
        status: true,
        user: { id: true, username: true },
        booth: { id: true, name: true }
      }
    });

    const activeShiftIds = activeShifts.map(s => s.id);

    const exchangeTransactions = await this.exchangeRepo.find({
      where: { updatedAt: Between(startOfDay, endOfDay) },
    });

    const transferTransactions = await this.transferRepo.find({
      where: { createdAt: Between(startOfDay, endOfDay) }
    });

    let totalBuyTHB = 0;
    let totalSellTHB = 0;
    let totalBuyForeign = 0;
    let totalSellForeign = 0;

    let exCompleted = 0;
    let exPending = 0;
    let exVoided = 0;

    exchangeTransactions.forEach(tx => {
      if (tx.status === 'COMPLETED') exCompleted++;
      if (tx.status === 'PENDING') exPending++;
      if (tx.status === 'VOIDED' || tx.status === 'CANCELLED') exVoided++;

      if (tx.status === 'COMPLETED') {
        if (tx.type === 'BUY') {
          totalBuyTHB += Number(tx.totalthaiBahtAmount || 0);
          totalBuyForeign += Number(tx.foreignCurrencyAmount || 0);
        } else if (tx.type === 'SELL') {
          totalSellTHB += Number(tx.totalthaiBahtAmount || 0);
          totalSellForeign += Number(tx.foreignCurrencyAmount || 0);
        }
      }
    });

    const overview = {
      activeShifts,
      transactions: {
        totals: {
          buy: { thb: totalBuyTHB, foreign: totalBuyForeign },
          sell: { thb: totalSellTHB, foreign: totalSellForeign }
        },
        statusCount: {
          completed: exCompleted,
          pending: exPending,
          voided: exVoided,
          transferTotal: transferTransactions.length
        }
      }
    };

    // 2. Currency Stock Status
    const stocks = await this.stockRepo.find();
    
    let cashCounts: CashCount[] = [];
    if (activeShiftIds.length > 0) {
      cashCounts = await this.cashCountRepo.find({
        where: { transaction: { shiftId: In(activeShiftIds) } },
        relations: ['transaction']
      });
    }

    // 3. Live Exchange Rates
    const exchangeRates = await this.exchangeRateRepo.find({ relations: ['currency'] });
    const exclusiveRates = await this.exclusiveRateRepo.find({ relations: ['exchangeRate', 'booth'] });

    // 4. Employee Performance (Current Month)
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const employeePerformance = await this.employeePerfRepo.find({
      where: { reportMonth: startOfMonth },
      relations: ['user'],
      select: {
        id: true,
        totalBalanceCheck: true,
        totalCashAdvance: true,
        reportMonth: true,
        user: { id: true, username: true }
      }
    });

    return {
      overview,
      stocks: {
        balances: stocks,
        cashCounts
      },
      exchangeRates: {
        standard: exchangeRates,
        exclusive: exclusiveRates
      },
      employeePerformance
    };
  }
}
