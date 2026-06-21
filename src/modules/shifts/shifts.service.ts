import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  Inject,
  BadRequestException,
  ForbiddenException,
  ConsoleLogger,
  forwardRef,
} from '@nestjs/common';
import { BoothsService } from '../../modules/booths/booths.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { EmployeePerformance } from '../reports/entities/employeePerfor.entity';
import {
  IsNull,
  Repository,
  DataSource,
  EntityManager,
  Between,
  Not,
  In,
} from 'typeorm';
import { SystemLogsService } from '../../modules/system-logs/system-logs.service';
import { CashCountsService } from './../../modules/cash-counts/cash-counts.service';
import { TransactionsService } from './../../modules/transactions/transactions.service';
import { SseService } from './../../modules/sse/sse.service';
import Redis from 'ioredis';
import { SharedTransactionsService } from '../shared-transactions/shared-transactions.service';
import { SharedShiftsService } from '../shared-shifts/shared-shifts.service';
import {
  QueryDateDto,
  QueryShiftId,
  ShiftIdDto,
  BoothIdDto,
  ShiftAuditBody,
  ShiftAuditParam,
} from './dto/shift.dto';
import { isUUID } from 'class-validator';
import { handleError } from '../../common/error/error';
import { ShiftDetail } from './../../types/index';

@Injectable()
export class ShiftsService {
  constructor(
    @Inject(forwardRef(() => BoothsService))
    private readonly boothService: BoothsService,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    private readonly systemLogsService: SystemLogsService,
    private readonly cashCountServicee: CashCountsService,
    private readonly transactionService: TransactionsService,
    private readonly sseService: SseService,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
    private readonly dataSource: DataSource,
    private readonly sharedTransactionsService: SharedTransactionsService,
    private readonly sharedShiftsService: SharedShiftsService,
  ) { }

  // create

  private async log(
    user: any,
    action: string,
    details: string,
    manager?: EntityManager,
  ) {
    await this.systemLogsService.createLog(user, {
      userId: user?.id || null,
      action,
      details,
    });
  }

  async create(
    currentUser: any,
    userId: string,
    boothId: string,
    manager: EntityManager,
    today = true,
  ) {
    const shiftRepo = manager.getRepository(Shift);
    const now = new Date();
    const startTime = today
      ? now
      : new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        8,
        0,
        0,
        0,
      );
    const status = 'CLOSE';
    const row = shiftRepo.create({
      userId: userId,
      boothId: boothId,
      startTime: startTime,
      status: status,
    });

    try {
      const savedShift = await shiftRepo.save(row);
      const shiftData = await shiftRepo.findOne({ where: { id: savedShift.id }, relations: ['user', 'booth'] });
      const boothName = shiftData?.booth?.name || 'Unknown Booth';
      const userName = shiftData?.user?.username || 'Unknown User';
      const logQuery = await this.log(
        currentUser,
        'OPEN_SHIFT_SUCCESS',
        `Shift at ${boothName} (Booth ID: ${boothId}) was opened by ${userName} (User ID: ${userId}) (Shift ID: ${savedShift.id})`,
        manager,
      );
      this.sseService.triggerRefreshBoothShiftId(boothId, savedShift.id);
      return savedShift;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        `internal server error: ${errorMessage}`,
        manager,
      );
      throw new InternalServerErrorException(
        'error in internal server. please contact admin.',
      );
    }
  }

  async openShift(currentUser: any, body: BoothIdDto) {
    return await this.dataSource.transaction(async (manager) => {
      return await this.sharedShiftsService.openShift(manager, currentUser, body);
    });
  }

  // read

  async getShifts(query: QueryDateDto) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Specific range date required.');
    }

    const start = new Date(query.startDate);
    const end = new Date(query.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'StartDate or EndDate in not in Date from.',
      );
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    try {
      return await this.shiftRepository.query(
        `select id , "boothId" , "userId" , total_receive , total_exchange , balance , status , "startTime" 
                from shifts   
                where ("startTime" between  $1 and $2)
                order by "startTime" asc`,
        [start, end],
      );
    } catch (err) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getShiftsByStatus(status: string, from: Date, to: Date) {
    const shiftsData = await this.shiftRepository.find({
      relations: {
        user: true,
        booth: true,
      },
      where: {
        status: status,
        startTime: Between(from, to),
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        balance_check: true,
        cash_advance: true,
        booth: {
          id: true,
          name: true,
        },
        user: {
          id: true,
          username: true,
        },
      },
    });

    return shiftsData;
  }

  async getActiveShifts(query: QueryDateDto) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Specific range date required.');
    }

    const start = new Date(query.startDate);
    const end = new Date(query.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException(
        'StartDate or EndDate in not in Date from.',
      );
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    try {
      return await this.shiftRepository.query(
        `select booths.id , booths.name 
                from shifts join booths on booths.id = shifts."boothId"  
                where ("endTime" is null) and ("startTime" between  $1 and $2)
                order by booths.name asc`,
        [start, end],
      );
    } catch (err) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getShiftDashboardSummary(query: QueryDateDto) {
    if (!query.startDate || !query.endDate) {
      throw new BadRequestException('Specific range date required.');
    }

    const start = new Date(query.startDate);
    const end = new Date(query.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('StartDate or EndDate in not in Date form.');
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    try {
      const summary = await this.shiftRepository
        .createQueryBuilder('shift')
        .select('shift.status', 'status')
        .addSelect('COUNT(shift.id)', 'count')
        .where('shift.startTime BETWEEN :start AND :end', { start, end })
        .groupBy('shift.status')
        .getRawMany();

      const result = {
        total: 0,
        OPEN: 0,
        CLOSE: 0,
        AWAITINGAUDIT: 0,
        COMPLETED: 0,
      };

      for (const row of summary) {
        const count = parseInt(row.count, 10) || 0;
        result.total += count;
        if (result.hasOwnProperty(row.status)) {
          result[row.status as keyof typeof result] = count;
        }
      }

      return result;
    } catch (err) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getUnresolvedPreviousShiftsCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const count = await this.shiftRepository
        .createQueryBuilder('shift')
        .where('shift.startTime < :today', { today })
        .andWhere('shift.status != :status', { status: 'COMPLETED' })
        .getCount();
      return { count };
    } catch (err) {
      throw new InternalServerErrorException('Internal Server Error');
    }
  }

  async getLastShiftByUserId(userId: string) {
    return this.sharedShiftsService.getLastShiftByUserId(this.dataSource.manager, userId);
  }

  async getLastShiftByBoothId(boothId: string | undefined, required = true, manager?: EntityManager) {
    if (!boothId) {
      if (required) {
        throw new BadRequestException('Booth ID is required.');
      } else {
        return null;
      }
    }

    const fromDate = new Date();
    const toDate = new Date();
    fromDate.setHours(0, 0, 0, 0);
    toDate.setDate(toDate.getDate() + 1);
    toDate.setHours(23, 59, 59, 999);

    const repo = manager ? manager.getRepository(Shift) : this.shiftRepository;
    const shifts = await repo.find({
      where: { boothId: boothId, startTime: Between(fromDate, toDate) },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (shifts.length === 0) {
      if (required) {
        throw new NotFoundException('No shift found for this booth today.');
      } else {
        return null;
      }
    }

    return shifts.length > 0 ? shifts[0] : null;
  }

  async getNonOpenPreviousShiftByBoothId(boothId: string) {
    const shiftDatas = await this.shiftRepository.query(
      `
            select s.id , u."username" , b.name , s.cash_advance  , s.balance_check  , s."startTime"  , s."endTime" 
            from shifts s 
            join users u on s."userId" = u.id 
            join booths b on s."boothId" = b.id
            where s.status = 'COMPLETED' and b.id = $1
            order by s."startTime" desc limit 1 
        `,
      [boothId],
    );

    return shiftDatas ? shiftDatas[0] : null;
  }

  async getShiftById(shiftId: string | undefined) {
    if (!shiftId || !isUUID(shiftId)) {
      throw new BadRequestException('Shift ID is not in correct format.');
    }

    const shift = await this.shiftRepository.findOne({
      where: { id: shiftId },
      relations: ['booth', 'user']
    });

    return shift;
  }

  async getShiftWithCloseStatusOrFail(user: any, id: string, message: string) {
    const shiftData = await this.getShiftById(id);
    if (!shiftData) {
      await this.log(
        user,
        `${message}_FAILED`,
        `Shift with ID: ${id} not found for the requested operation.`,
      );
      throw new NotFoundException('Shift not found.');
    }

    const boothName = shiftData.booth?.name || 'Unknown Booth';

    if (shiftData.status !== 'CLOSE' && shiftData.status !== 'AWAITINGAUDIT') {
      await this.log(
        user,
        `${message}_FAILED`,
        `Shift at ${boothName} (Shift ID: ${id}) is not in CLOSE or AWAITINGAUDIT status.`,
      );
      throw new ConflictException(`Shift at ${boothName} is not in close or awaiting audit status`);
    }

    return shiftData;
  }

  async getCashCountFromPreviousShift(boothId: string) {
    const shiftData = await this.getNonOpenPreviousShiftByBoothId(boothId);
    const cashCountData = shiftData
      ? await this.cashCountServicee.getCashCountByShiftId(shiftData.id)
      : [];
    return cashCountData;
  }

  async getCurrentShiftDetails(
    boothId: string | null,
    shiftId: string | null
  ) {
    const boothData = await this.boothService.findBoothCurrentShift(
      boothId,
      shiftId
    );

    if (!boothData) {
      return null;
    }

    const shiftDetail = new ShiftDetail(
      boothData.boothid ?? boothId,
      boothData.name,
      boothData.location,
      true,
      boothData.userid,
      boothData.username,
    );

    shiftDetail.setShiftData(
      boothData.shiftid ?? null,
      boothData.status ?? null,
      boothData.cash_advance ?? null,
      boothData.balance_check ?? null,
      boothData.startTime ?? null,
    );

    if (shiftId) {
      const [transferTransactions, cashCounts, exchangeTransactions] =
        await Promise.all([
          this.sharedTransactionsService.getAmountTypeStatusByShiftId(shiftId),
          this.cashCountServicee.getCashCountByShiftId(shiftId),
          this.sharedTransactionsService.getForeignAmountExchangeRateAndStatusFromShiftId(
            shiftId,
          ),
        ]);

      shiftDetail.setCashcount(cashCounts);
      shiftDetail.setTrafer(transferTransactions);
      shiftDetail.setExchange(exchangeTransactions);
    }

    return shiftDetail;
  }

  async getBulkCurrentShiftDetails(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    
    // Get all booth/shift pairs
    const outerJoins = await this.boothService.findBoothShiftOuterJoin(fromDate, toDate);

    if (!outerJoins || outerJoins.length === 0) {
      return [];
    }

    // Fetch details for each booth/shift concurrently
    const shiftDetailsPromises = outerJoins.map(async (item: any) => {
      const shiftDetail = await this.getCurrentShiftDetails(item.boothID, item.shiftID);
      if (!shiftDetail) {
         const booth = await this.boothService.findOne(item.boothID);
         const minimalDetail = new ShiftDetail(item.boothID, booth.name, booth.location, true, null, null);
         // Ensure we include boothID, so the frontend can identify it!
         // Wait, ShiftDetail does not have boothID field? Let's add it below if it's missing in frontend, or frontend uses name.
         // Actually, frontend ShiftCard needs boothId. 
         // ShiftDetail class in types/index.ts has shiftid, userid, name, username, location.
         // Wait, where is boothId? Let's check ShiftDetail.
         return minimalDetail;
      }
      return shiftDetail;
    });

    const shiftDetailsList = await Promise.all(shiftDetailsPromises);
    return shiftDetailsList.filter(s => s !== null);
  }

  // update

  async setStatusToOpen(
    currentUser: any,
    id: string,
    previousStatus: string,
    manager: EntityManager,
  ) {
    const shiftRepo = manager.getRepository(Shift);
    const updateResult = await shiftRepo.update({ id: id }, { status: 'OPEN' });
    if (updateResult.affected == 0) {
      const shiftData = await shiftRepo.findOne({ where: { id }, relations: ['booth'] });
      const boothName = shiftData?.booth?.name || 'Unknown Booth';
      await this.log(
        currentUser,
        'OPEN_SHIFT_FAILED',
        `Can't set status for shift at ${boothName} (Shift ID: ${id}) to OPEN.`,
        manager,
      );
      throw new NotFoundException(`Can't set status for shift at ${boothName} to OPEN.`);
    }

    const shiftData = await shiftRepo.findOne({ where: { id }, relations: ['booth'] });
    const boothName = shiftData?.booth?.name || 'Unknown Booth';
    await this.log(
      currentUser,
      'OPEN_SHIFT_SUCCESS',
      `Update shift at ${boothName} (Shift ID: ${id}) from ${previousStatus} to OPEN`,
      manager,
    );
    this.sseService.triggerRefreshShiftId(id);
    return { message: 'Open shift success.' };
  }

  async setStatusToCLose(currentUser: any, body: ShiftIdDto) {
    return await this.dataSource.transaction(async (manager) => {
      return await this.sharedShiftsService.setStatusToCLose(manager, currentUser, body);
    });
  }

  async updateAuditShift(user: any, id: string, paras: ShiftAuditBody) {
    const shiftData = await this.getShiftWithCloseStatusOrFail(
      user,
      id,
      'AUDIT_SHIFT',
    );
    const boothName = shiftData.booth?.name || 'Unknown Booth';
    const pendingTransId = await this.transactionService.getPendingTransId(id);

    if (pendingTransId && pendingTransId.length != 0) {
      await this.log(
        user,
        'AUDIT_SHIFT_FAILED',
        `Can't audit shift at ${boothName} (Shift ID: ${id}) because it still has ${pendingTransId.length} pending exchange transaction(s).`,
      );
      throw new ConflictException(
        `Can't audit shift at ${boothName} because it still has ${pendingTransId.length} pending exchange transaction(s).`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const transactionData = await this.transactionService.create(manager, {
        type: 'CLOSE_SHIFT_CASH_COUNT',
        shiftId: id,
      });

      const transactionId = transactionData.id;
      const denominations = paras.cashCountData.denominations;
      const amounts = paras.cashCountData.amounts;
      const cashCountData = await this.cashCountServicee.create(
        user,
        {
          transactionId: transactionId,
          denominations: denominations,
          amounts: amounts,
        },
        manager,
      );

      const shiftRepo = manager.getRepository(Shift);
      const updateresult = await shiftRepo.update(
        { id: id, status: In(['CLOSE', 'AWAITINGAUDIT']) },
        {
          status: 'COMPLETED',
          balance_check: paras.balanceCheck,
          cash_advance: paras.cashAdvance,
        },
      );
      if (updateresult.affected == 0) {
        await this.log(
          user,
          'AUDIT_SHIFT_FAILED',
          `Can't audit shift at ${boothName} (Shift ID: ${id}) maybe someone just changed status to 'OPEN'.`,
        );
        throw new ConflictException(
          `Can't audit shift at ${boothName} maybe someone just changed status to 'OPEN'.`,
        );
      }

      await this.updateEmployeePerformance(manager, shiftData.userId);

      await this.log(
        user,
        'AUDIT_SHIFT_SUCCESS',
        `Shift at ${boothName} (Shift ID: ${id}) has been audited.`,
      );
    });
    this.sseService.triggerRefreshShiftId(id);
    return { message: 'Audit shift success.' };
  }

  async getShiftsByUserIdAndMonth(userId: string, month: number, year: number) {
    const fromDate = new Date(year, month - 1, 1);
    const toDate = new Date(year, month, 0, 23, 59, 59, 999);
    return await this.shiftRepository.find({
      where: {
        userId: userId,
        startTime: Between(fromDate, toDate),
        status: 'COMPLETED',
      },
    });
  }

  async softDelete(user: any, id: string, manager?: EntityManager) {

    const transaction = (manager ? manager : this.dataSource).transaction(async (txManager) => {
      // ลบข้อมูล
      const shiftRepo = txManager.getRepository(Shift);

      const updateResult = await shiftRepo.softDelete({ id: id, status: Not("COMPLETED") });

      // เช็คว่าถูกลบไหม

      if (updateResult.affected == 0) {
        const shift = await shiftRepo.findOne({ where: { id: id }, relations: ['booth'] });
        const boothName = shift?.booth?.name || 'Unknown Booth';
        if (!shift) {
          await this.log(user, `DELETED_SHIFT_FAILED`, `Shift ID: ${id} not found in database.`, txManager);
          throw new NotFoundException('Deleted Failed Shift Not Found In Database.');
        }
        await this.log(user, `DELETED_SHIFT_FAILED`, `Shift at ${boothName} (Shift ID: ${id}) is already COMPLETED.`, txManager);
        throw new ConflictException('COMPLETED Shift cannot be deleted.');
      }

      const shift = await shiftRepo.findOne({ where: { id: id }, withDeleted: true, relations: ['booth'] });
      const boothName = shift?.booth?.name || 'Unknown Booth';
      await this.log(user, `DELETED_SHIFT_SUCCESS`, `Shift at ${boothName} (Shift ID: ${id}) has been deleted in database.`, txManager);

    });
    try {
      return await transaction;
    }
    catch (err) {
      handleError(err, 'Deleted Shift');
    }
  }

  private async saveCalculatedPerformance(
    manager: EntityManager,
    userId: string,
    year: number,
    month: number,
  ) {
    const reportMonth = new Date(year, month - 1, 1);

    const fromDate = new Date(year, month - 1, 1);
    const toDate = new Date(year, month, 0, 23, 59, 59, 999);

    const shiftRepo = manager.getRepository(Shift);
    const shifts = await this.getShiftsByUserIdAndMonth(userId, month, year);

    const totalBalanceCheck = shifts.reduce(
      (sum, shift) => Number(sum) + Number(shift.balance_check || 0),
      0,
    );
    const totalCashAdvance = shifts.reduce(
      (sum, shift) => Number(sum) + Number(shift.cash_advance || 0),
      0,
    );

    const performanceRepo = manager.getRepository(EmployeePerformance);
    let performance = await performanceRepo.findOne({
      where: { userId, reportMonth },
    });

    if (performance) {
      performance.totalBalanceCheck = totalBalanceCheck;
      performance.totalCashAdvance = totalCashAdvance;
    } else {
      performance = performanceRepo.create({
        userId,
        reportMonth,
        totalBalanceCheck,
        totalCashAdvance,
      });
    }

    return await performanceRepo.save(performance);
  }

  async updateEmployeePerformance(manager: EntityManager, userId: string) {
    const now = new Date();
    return this.saveCalculatedPerformance(
      manager,
      userId,
      now.getFullYear(),
      now.getMonth() + 1,
    );
  }
}
