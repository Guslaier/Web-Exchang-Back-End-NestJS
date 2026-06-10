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
  ) { }

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

  async getMetrics(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const buyMetrics = await this.exchangeRepo.createQueryBuilder('et')
      .select('COALESCE(SUM(et.totalthaiBahtAmount), 0)', 'totalBuyTHB')
      .where('et.type = :type', { type: 'BUY' })
      .andWhere('et.status = :status', { status: 'COMPLETED' })
      .andWhere('et.updatedAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .getRawOne();

    const sellMetrics = await this.exchangeRepo.createQueryBuilder('et')
      .select('COALESCE(SUM(et.totalthaiBahtAmount), 0)', 'totalSellTHB')
      .where('et.type = :type', { type: 'SELL' })
      .andWhere('et.status = :status', { status: 'COMPLETED' })
      .andWhere('et.updatedAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .getRawOne();

    const transferCount = await this.transferRepo.createQueryBuilder('tt')
      .where('tt.createdAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .getCount();

    const activeShiftsCount = await this.shiftRepo.createQueryBuilder('s')
      .where('s.status = :status', { status: 'OPEN' })
      .getCount();

    return {
      totalBuyTHB: Number(buyMetrics.totalBuyTHB),
      totalSellTHB: Number(sellMetrics.totalSellTHB),
      todayTransfers: transferCount,
      activeShiftsCount: activeShiftsCount,
    };
  }

  async getActiveShifts() {
    return await this.shiftRepo.createQueryBuilder('s')
      .select([
        's.id as id',
        's.startTime as "startTime"',
        's.balance_check as "balance_check"',
        's.cash_advance as "cash_advance"',
        'u.username as "employeeName"',
        'b.name as "boothName"'
      ])
      .leftJoin('s.user', 'u')
      .leftJoin('s.booth', 'b')
      .where('s.status = :status', { status: 'OPEN' })
      .andWhere('s.deletedAt IS NULL')
      .getRawMany();
  }

  async getPendingAlerts() {
    const pendingCount = await this.exchangeRepo.createQueryBuilder('et')
      .where('et.status = :status', { status: 'PENDING' })
      .getCount();

    return { pendingCount };
  }

  async getAnalytics(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Hourly Trend
    const hourlyTrend = await this.exchangeRepo.createQueryBuilder('et')
      .select('EXTRACT(HOUR FROM et.updatedAt)', 'time')
      .addSelect("SUM(CASE WHEN et.type = 'BUY' THEN et.totalthaiBahtAmount ELSE 0 END)", 'buyVolume')
      .addSelect("SUM(CASE WHEN et.type = 'SELL' THEN et.totalthaiBahtAmount ELSE 0 END)", 'sellVolume')
      .where('et.status = :status', { status: 'COMPLETED' })
      .andWhere('et.updatedAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .groupBy('EXTRACT(HOUR FROM et.updatedAt)')
      .orderBy('EXTRACT(HOUR FROM et.updatedAt)', 'ASC')
      .getRawMany();

    // Top Currencies
    const topCurrencies = await this.exchangeRepo.createQueryBuilder('et')
      .select('et.exchangeRateName', 'currency')
      .addSelect('SUM(et.totalthaiBahtAmount)', 'totalAmount')
      .addSelect('COUNT(*)', 'transactionCount')
      .where('et.status = :status', { status: 'COMPLETED' })
      .andWhere('et.updatedAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .groupBy('et.exchangeRateName')
      .orderBy('SUM(et.totalthaiBahtAmount)', 'DESC')
      .getRawMany();

    // Booth Performance
    const boothPerformance = await this.exchangeRepo.createQueryBuilder('et')
      .select('b.name', 'boothName')
      .addSelect('COUNT(et.id)', 'totalTransactions')
      .addSelect('COALESCE(SUM(et.totalthaiBahtAmount), 0)', 'netVolume')
      .innerJoin('et.transaction', 't')
      .innerJoin('t.shift', 's')
      .innerJoin('s.booth', 'b')
      .where('et.status = :status', { status: 'COMPLETED' })
      .andWhere('et.updatedAt BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .groupBy('b.name')
      .orderBy('COALESCE(SUM(et.totalthaiBahtAmount), 0)', 'DESC')
      .getRawMany();

    // Calculate percentages for top currencies
    const grandTotalAmount = topCurrencies.reduce((sum, c) => sum + Number(c.totalAmount), 0);
    const topCurrenciesWithPercentage = topCurrencies.map(c => ({
      currency: c.currency,
      totalAmount: Number(c.totalAmount),
      transactionCount: Number(c.transactionCount),
      percentage: grandTotalAmount > 0 ? (Number(c.totalAmount) / grandTotalAmount) * 100 : 0
    }));

    return {
      hourlyTrend: hourlyTrend.map(h => {
        // Format time as "08:00"
        const hourNum = Number(h.time);
        const formattedTime = `${hourNum.toString().padStart(2, '0')}:00`;
        return {
          time: formattedTime,
          buyVolume: Number(h.buyVolume),
          sellVolume: Number(h.sellVolume)
        };
      }),
      topCurrencies: topCurrenciesWithPercentage,
      boothPerformance: boothPerformance.map(b => ({
        boothName: b.boothName,
        netVolume: Number(b.netVolume),
        totalTransactions: Number(b.totalTransactions)
      }))
    };
  }
}
