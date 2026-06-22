import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  forwardRef,
} from '@nestjs/common';
import {
  CreateExchangeTransactionDto,
  GetExchangeTransactionsFromShiftsDto,
  GetExchangeTransactionDto,
  LimitDto,
  SetStatusToPendingBodyDto,
  SetStatusDto,
  SetStatusToApproveBodyDto,
} from './dto/exchange-transaction.dto';
import { ShiftsService } from './../../modules/shifts/shifts.service';
import { TransactionsService } from './../../modules/transactions/transactions.service';
import { ExchangeRatesService } from './../../modules/exchange-rates/exchange-rates.service';
import { ExclusiveExchangeRatesService } from './../../modules/exclusive-exchange-rates/exclusive-exchange-rates.service';
import { SystemLogsService } from './../../modules/system-logs/system-logs.service';
import { CustomersService } from './../../modules/customers/customers.service';
import { CashCountsService } from './../../modules/cash-counts/cash-counts.service';
import { StocksService } from './../../modules/stocks/stocks.service';
import { CreateTransactionDto } from './../../modules/transactions/dto/transaction.dto';
import { UpdateStockByExchangeTransactionForCancel } from './../../modules/stocks/dto/stocks.dto';
import { InputValidator } from './helper/input-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, IsNull, Not } from 'typeorm';
import { ExchangeTransaction } from './entities/exchange-transaction.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { handleError } from '../../common/error/error';
import { SseService } from '../sse/sse.service';
import { DateRangeExchangeTransaction } from '../../types';

@Injectable()
export class ExchangeTransactionsService {
  constructor(
    private readonly shiftsService: ShiftsService,
    private readonly exchangeRateService: ExchangeRatesService,
    private readonly exclusiveExchangeRatesService: ExclusiveExchangeRatesService,
    private readonly customerService: CustomersService,
    private readonly systemLogsService: SystemLogsService,
    private readonly cashCountsService: CashCountsService,
    private readonly stocksService: StocksService,
    private readonly inputValidator: InputValidator,
    @InjectRepository(ExchangeTransaction)
    private readonly exchangeTransactionRepository: Repository<ExchangeTransaction>,
    private readonly transactionsService: TransactionsService,
    private readonly dataSource: DataSource,
    private readonly sseService: SseService,
  ) { }

  // create

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
    body: CreateExchangeTransactionDto,
    customer_img?: Express.Multer.File,
    manager?: EntityManager,
    customerId?: string,
  ): Promise<any> {
    // validate input section


    const activeShift = await this.shiftsService.getLastShiftByUserId(
      currentUser.id,
    );
    if (!activeShift) {
      await this.log(
        currentUser,
        'CREATE_EXCHANGE_TRANSACTION_FAILED',
        'Failed to create exchange transaction due to no active shift found for the user',
      );
      throw new NotFoundException('No active shift found for the user');
    } else if (activeShift.status !== 'OPEN') {
      await this.log(
        currentUser,
        'CREATE_EXCHANGE_TRANSACTION_FAILED',
        `Failed to create exchange transaction due to no shift for this user is not in 'OPEN' status.`,
      );
      throw new ConflictException(
        `shift for this user is not in 'OPEN' status.`,
      );
    }

    const exchangeRateId = await this.exchangeRateService.findById(
      body.exchangeRatesId,
    );
    if (
      !exchangeRateId ||
      (exchangeRateId && exchangeRateId.name.includes('THB'))
    ) {
      await this.log(
        currentUser,
        'CREATE_EXCHANGE_TRANSACTION_FAILED',
        `Failed to create exchange transaction due to invalid exchangeRatesId: ${body.exchangeRatesId}`,
      );
      throw new NotFoundException('Exchange rate not found');
    }

    const numberFields = [body.foreignAmount, body.thaiBahtAmount];
    this.inputValidator.validateNumberFieldsPositive(numberFields);
    const exchangeRate: number = body.exchangeRate;

    if (Math.trunc((body.exchangeRate * body.foreignAmount)) !== Math.trunc(body.thaiBahtAmount)) {
      await this.log(
        currentUser,
        'CREATE_EXCHANGE_TRANSACTION_FAILED',
        `Failed to create exchange transaction due to mismatch in calculated exchange rate: ${exchangeRate} and provided exchange rate: ${body.exchangeRate} for proposed rate thai baht amount shouled be ${body.foreignAmount * body.exchangeRate}`,
      );
      throw new BadRequestException(
        `Mismatch in calculated exchange rate: ${exchangeRate} and provided exchange rate: ${body.exchangeRate} for proposed rate thai baht amount shouled be ${body.foreignAmount * body.exchangeRate}`,
      );
    }


    const exclusiveExchangeRates =
      await this.exclusiveExchangeRatesService.findByExchangeRate(
        body.exchangeRatesId,
      );
    let exclusiveExchangeRate: any = null;
    for (const exclusiveRate of exclusiveExchangeRates) {
      if (exclusiveRate?.booth_id === activeShift.boothId) {
        exclusiveExchangeRate = exclusiveRate;
        break;
      }
    }
    const isRateAllow =
      (body.type === 'SELL' &&
        Math.trunc(exchangeRate) >= Math.trunc(exchangeRateId.sell_rate)) ||
        (body.type === 'BUY' &&
          Math.trunc(exchangeRate) <=
          Math.trunc(exclusiveExchangeRate.buy_rate_max))
        ? true
        : false;

    if (!isRateAllow) {
      if (body.type === 'SELL') {
        await this.log(
          currentUser,
          'CREATE_EXCHANGE_TRANSACTION_FAILED',
          `Proposed sell exchange rate of ${exchangeRate} does not match the current sell rate of ${exchangeRateId.sell_rate}.`,
        );
        throw new BadRequestException(
          `Proposed sell exchange rate of ${exchangeRate} does not match the current sell rate of ${exchangeRateId.sell_rate}.`,
        );
      } else {
        await this.log(
          currentUser,
          'CREATE_EXCHANGE_TRANSACTION_FAILED',
          `Proposed buy exchange rate of ${exchangeRate} is not allowed. It must be between ${exclusiveExchangeRate.buy_rate} and ${exclusiveExchangeRate.buy_rate_max}.`,
        );
        throw new BadRequestException(
          `Proposed buy exchange rate of ${exchangeRate} is not allowed. It must be between ${exclusiveExchangeRate.buy_rate} and ${exclusiveExchangeRate.buy_rate_max}.`,
        );
      }
    }

    const {
      passportNo = '',
      fullName = '',
      nationality = '',
      phoneNumber = '',
      hotelName = '',
      roomNumber = '',
    } = body;
    const customerFields = [
      passportNo,
      fullName,
      nationality,
      phoneNumber,
      hotelName,
      roomNumber,
      customer_img?.filename ?? '',
    ];
    const insertCustomer =
      !customerId && this.inputValidator.validateCustomerFieldFilled(customerFields);

    const executeDbOperations = async (execManager: EntityManager) => {
      await this.stocksService.updateStockByExchangeTransaction(
        currentUser,
        {
          userId: currentUser.id,
          type: body.type,
          foreignRateId: body.exchangeRatesId,
          foreignCurrencyAmount: body.foreignAmount,
          totalThaiBahtAmount: Math.trunc(body.thaiBahtAmount),
        },
        execManager,
      );

      const createTransactionDto: CreateTransactionDto = {
        type: 'EXCHANGE',
        shiftId: activeShift.id,
      };
      const transaction = await this.transactionsService.create(
        execManager,
        createTransactionDto,
      );

      let customerIdToUse = customerId;
      if (!customerIdToUse && insertCustomer) {
        const customer = await this.customerService.create(
          execManager,
          transaction.id,
          passportNo,
          fullName,
          nationality,
          phoneNumber,
          hotelName,
          roomNumber,
          customer_img?.filename ?? '',
        );
        customerIdToUse = customer.id;
      }

      const exchangeTransRepo = execManager.getRepository(ExchangeTransaction);

      try {
        const createdExchangeTran = exchangeTransRepo.create({
          id: transaction.id,
          customerId: customerIdToUse || null,
          exchangeRateId: body.exchangeRatesId,
          exchangeRateName: exchangeRateId.name,
          foreignCurrencyAmount: body.foreignAmount,
          totalthaiBahtAmount: Math.trunc(body.thaiBahtAmount),
          exchangeRate: exchangeRate,
          isNegotiateRate:
            (body.type === 'BUY' &&
              Math.trunc(exchangeRate) !==
              Math.trunc(exclusiveExchangeRate.buy_rate)) ||
              (body.type === 'SELL' &&
                Math.trunc(exchangeRate) !==
                Math.trunc(exclusiveExchangeRate.sell_rate))
              ? true
              : false,
          note: body.note ? body.note : null,
          status: 'COMPLETED',
          type: body.type,
        });
        await exchangeTransRepo.save(createdExchangeTran);
        await this.log(
          currentUser,
          'CREATE_EXCHANGE_TRANSACTION_SUCCESS',
          `Created exchange transaction with ID: ${createdExchangeTran.id}`,
          execManager,
        );
        return createdExchangeTran;
      } catch (error) {
        await this.log(
          currentUser,
          'CREATE_EXCHANGE_TRANSACTION_FAILED',
          `Failed to create exchange transaction due to database error. Error: ${error instanceof Error ? error.message : String(error)}`,
          execManager,
        );
        throw new InternalServerErrorException(
          `Failed to create exchange transaction due to database error. Error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    // insert section
    try {
      let result;
      if (manager) {
        result = await executeDbOperations(manager);
      } else {
        await this.dataSource.transaction(async (newManager) => {
          result = await executeDbOperations(newManager);
        });
      }
      this.sseService.triggerRefreshBoothShiftId(activeShift.boothId , activeShift.id);
      return {
        message: 'Exchange transaction created successfully',
        data: result,
      };
    } catch (error) {
      handleError(
        error,
        'ExchangeTransactionsService.createExchangeTransaction',
      );
    }
  }

  // read

  async getTransactionsFromShift(
    currentUser: any,
    query: GetExchangeTransactionsFromShiftsDto | undefined,
  ) {
    const isEmployee = currentUser.role === 'EMPLOYEE' ? true : false;

    const shiftData = isEmployee
      ? await this.shiftsService.getLastShiftByUserId(currentUser.id)
      : null;
    if (shiftData && shiftData.status !== 'OPEN') {
      throw new ConflictException(`Shift is not in 'OPEN' status.`);
    }

    const shiftId = shiftData ? shiftData.id : query?.id;

    if (!shiftId) {
      throw new BadRequestException('No active shift found');
    }

    const exchangeTransactionQueries =
      await this.exchangeTransactionRepository.find({
        relations: {
          transaction: {
            shift: {
              user: true,
              booth: true,
            },
          },
        },
        where: {
          transaction: {
            shiftId: shiftId,
          },
        },
        select: {
          id: true,
          type: true,
          foreignCurrencyAmount: true,
          totalthaiBahtAmount: true,
          exchangeRate: true,
          isNegotiateRate: true,
          status: true,
          exchangeRateName: true,
          transaction: {
            id: true,
            createdAt: true,
            shift: {
              id: true,
              user: {
                id: true,
                username: true,
              },
              booth: {
                id: true,
                name: true,
              },
            },
          },
        },
        order: {
          transaction: {
            createdAt: 'ASC',
          },
        },
      });

    const exchangeTransactions = [];

    for (const exchangeTransaction of exchangeTransactionQueries) {
      const { transaction, ...restExchangeTransaction } = exchangeTransaction;
      const { createdAt, shift, ...restTransaction } = transaction;
      const { user, booth, ...restShift } = shift;

      exchangeTransactions.push({
        ...restExchangeTransaction,
        createdAt,
        employee: user.username,
        booth: booth.name,
      });
    }

    return exchangeTransactions;
  }

  async getForeignAmountExchangeRateAndStatusFromShiftId(id: string) {
    const exchangeTransactionData =
      await this.exchangeTransactionRepository.find({
        relations: {
          transaction: {
            shift: true,
          },
        },
        where: {
          transaction: {
            shiftId: id,
          },
        },
        select: {
          id: true,
          type: true,
          foreignCurrencyAmount: true,
          exchangeRate: true,
          status: true,
        },
      });

    return exchangeTransactionData;
  }

  async getTransactionDetail(
    currentUser: any,
    query: GetExchangeTransactionDto,
  ) {
    const isEmployee = currentUser.role === 'EMPLOYEE' ? true : false;

    if (isEmployee) {
      const activeShift = await this.shiftsService.getLastShiftByUserId(
        currentUser.id,
      );
      if (!activeShift) {
        throw new BadRequestException(
          'Active shift not found for the employee.',
        );
      } else if (activeShift.status !== 'OPEN') {
        throw new ConflictException('Shift is not open for employee.');
      }

      const exchangeTransaction =
        await this.exchangeTransactionRepository.findOne({
          relations: {
            transaction: true,
          },
          where: {
            id: query.id,
          },
          select: {
            transaction: {
              shiftId: true,
            },
          },
        });

      if (!exchangeTransaction) {
        throw new NotFoundException('Transaction not exchange transaction.');
      }

      if (!exchangeTransaction.transaction.shiftId) {
        throw new BadRequestException(
          'Transaction is not exchange transactions.',
        );
      }

      if (exchangeTransaction.transaction.shiftId !== activeShift.id) {
        throw new BadRequestException(
          "Transaction does not belong to the employee's active shift.",
        );
      }
    }

    const exchangeTransaction =
      await this.exchangeTransactionRepository.findOne({
        withDeleted: true,
        relations: {
          transaction: {
            shift: {
              user: true,
              booth: true,
            },
          },
          customer: true,
          employee: true,
          approver: true,
        },
        where: {
          id: query.id,
        },
        select: {
          id: true,
          type: true,
          customerId: true,
          foreignCurrencyAmount: true,
          totalthaiBahtAmount: true,
          exchangeRate: true,
          exchangeRateId: true,
          isNegotiateRate: true,
          note: true,
          voidReason: true,
          status: true,
          exchangeRateName: true,
          customer: {
            id: true,
            fullName: true,
            passportNo: true,
            hotelName: true,
            roomNumber: true,
            phoneNumber: true,
            passportImg: true,
          },
          transaction: {
            id: true,
            createdAt: true,
            shift: {
              id: true,
              user: {
                id: true,
                username: true,
              },
              booth: {
                id: true,
                name: true,
              },
            },
          },
          employee: {
            username: true,
          },
          approver: {
            username: true,
          },
        },
      });

    if (!exchangeTransaction) {
      throw new NotFoundException('Exchange transaction not found.');
    }

    const {
      transaction,
      customer,
      approver,
      employee,
      customerId,
      ...restExchangeTransaction
    } = exchangeTransaction;
    const { createdAt, shift, ...restTransaction } = transaction;

    const { user, booth, ...restShift } = shift;

    const { id, ...customerInfo } = customer
      ? customer
      : {
        id: null,
        fullName: null,
        passportNo: null,
        hotelName: null,
        roomNumber: null,
        phoneNumber: null,
        passportImg: null,
      };

    const exchangeTransactionDetail = {
      ...restExchangeTransaction,
      customerId: customerId || id || null,
      createdAt,
      shiftId: shift.id,
      employee: user.username,
      booth: booth.name,
      voidedBy: employee ? employee.username : null,
      approvedBy: approver ? approver.username : null,
    };

    console.log(exchangeTransactionDetail) ; 

    return exchangeTransactionDetail;
  }

  async getTransactions(currentUser: any, query: LimitDto) {
    const limit = query.limit || 5;
    const offset = query.offset || 0;

    const exchangeTransactionsQuery =
      await this.exchangeTransactionRepository.find({
        relations: {
          transaction: {
            shift: {
              user: true,
              booth: true,
            },
          },
        },
        where: {
          transaction: {
            shift: {
              endTime: IsNull(),
            },
          },
        },
        select: {
          id: true,
          type: true,
          foreignCurrencyAmount: true,
          totalthaiBahtAmount: true,
          exchangeRate: true,
          isNegotiateRate: true,
          status: true,
          exchangeRateName: true,
          transaction: {
            id: true,
            createdAt: true,
            shift: {
              id: true,
              user: {
                id: true,
                username: true,
              },
              booth: {
                id: true,
                name: true,
              },
            },
          },
        },
        order: {
          transaction: {
            createdAt: 'DESC',
          },
        },
        take: limit,
        skip: offset,
      });

    const exchangeTransactions = [];

    for (const exchangeTransaction of exchangeTransactionsQuery) {
      const { transaction, ...restExchangeTransaction } = exchangeTransaction;
      const { createdAt, shift, ...restTransaction } = transaction;
      const { user, booth, ...restShift } = shift;

      exchangeTransactions.push({
        ...restExchangeTransaction,
        createdAt,
        employee: user.username,
        booth: booth.name,
      });
    }

    return exchangeTransactions;
  }

  async getExchangeTransactionsByDateRange(
    from: Date,
    to: Date,
    page?: number,
  ): Promise<DateRangeExchangeTransaction[]> {
    const pageNum = page && page > 0 ? page : 1;
    const limit = 20;
    const offset = (pageNum - 1) * limit;

    from.setHours(0,0,0,0) ; 
    to.setHours(23,59,59,999) ;

    const rows = await this.dataSource.query(
      `
      SELECT 
        t.id AS "transactionId",
        et.id AS "exchangeTransactionId",
        et."customerId" AS "customerId",
        et."exchangeRateId" AS "exchangeRateId",
        s.id AS "shiftId",
        u.id AS "userId",
        u.username AS "userName" , 
        b.id AS "boothId",
        b.name as "boothName" , 
        t."createdAt" AS "createdAt",
        et.type AS "type",
        et."foreignCurrencyAmount" AS "foreignCurrencyAmount",
        et."totalthaiBahtAmount" AS "totalthaiBahtAmount",
        et."exchangeRate" AS "exchangeRate",
        et.status AS "status",
        et."exchangeRateName" AS "exchangeRateName"
      FROM transactions t
      JOIN exchange_transactions et ON t.id = et.id
      JOIN shifts s ON t."shiftId" = s.id
      JOIN users u ON s."userId" = u.id
      JOIN booths b ON s."boothId" = b.id
      WHERE t.type = 'EXCHANGE' AND  t."createdAt" BETWEEN $1 AND $2
      ORDER BY t."createdAt" DESC
      LIMIT $3 OFFSET $4
      `,
      [from, to, limit, offset],
    );

    return rows.map((row : any) => ({
      transactionId: row.transactionId,
      exchangeTransactionId: row.exchangeTransactionId,
      customerId: row.customerId,
      exchangeRateId: row.exchangeRateId,
      shiftId: row.shiftId,
      userId: row.userId,
      userName: row.userName,
      boothId: row.boothId,
      boothName: row.boothName,
      createdAt: row.createdAt,
      type: row.type,
      foreignCurrencyAmount: row.foreignCurrencyAmount !== null ? Number(row.foreignCurrencyAmount) : null,
      totalthaiBahtAmount: row.totalthaiBahtAmount !== null ? Number(row.totalthaiBahtAmount) : null,
      exchangeRate: row.exchangeRate !== null ? Number(row.exchangeRate) : null,
      status: row.status,
      exchangeRateName: row.exchangeRateName,
    }));
  }

  async countExchangeTransactionsByDateRange(from: Date, to: Date): Promise<number> {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    const result = await this.dataSource.query(
      `
      SELECT COUNT(*)::int AS "count"
      FROM transactions t
      JOIN exchange_transactions et ON t.id = et.id
      WHERE t.type = 'EXCHANGE' 
        AND t."createdAt" BETWEEN $1 AND $2 
      `,
      [from, to],
    );

    return result[0]?.count ?? 0;
  }

  // update

  async setStatusByEmployee(
    currentUser: any,
    param: SetStatusDto,
    body: SetStatusToPendingBodyDto,
  ) {
    const activeShift = await this.shiftsService.getLastShiftByUserId(
      currentUser.id,
    );
    if (!activeShift) {
      await this.log(
        currentUser,
        'SET_EXCHANGE_TRANSACTION_PENDING_FAILED',
        `Failed to set exchange transaction with ID: ${param.id} Cause Active shift not found for the employee.`,
      );
      throw new NotFoundException('Active shift not found for the employee.');
    } else if (activeShift.status !== 'OPEN') {
      await this.log(
        currentUser,
        'SET_EXCHANGE_TRANSACTION_PENDING_FAILED',
        `Failed to set exchange transaction with ID: ${param.id} Cause Shift is not in 'OPEN' status.`,
      );
      throw new ConflictException(`Shift is not in 'OPEN' status.`);
    }

    const exchangeTransaction =
      await this.exchangeTransactionRepository.findOne({
        relations: {
          transaction: true,
        },
        where: {
          id: param.id,
          transaction: {
            shiftId: activeShift.id,
          },
        },
      });

    if (!exchangeTransaction) {
      await this.log(
        currentUser,
        'SET_EXCHANGE_TRANSACTION_PENDING_FAILED',
        `Failed to set exchange transaction with ID: ${param.id} Cause Exchange transaction not found for the active shift.`,
      );
      throw new ForbiddenException(
        'Exchange transaction not found for the active shift.',
      );
    }

    try {
      this.dataSource.transaction(async (manager) => {
        const exchangeTransRepo = manager.getRepository(ExchangeTransaction);

        const exchangeTransactionUpdateQuery = exchangeTransRepo.update(
          { id: param.id, status: 'COMPLETED' },
          {
            status: 'PENDING',
            voidReason: body.voidReason,
            voidedBy: currentUser.id,
          },
        );
        const logInsertQuery = this.log(
          currentUser,
          'SET_EXCHANGE_TRANSACTION_PENDING_SUCCESS',
          `Set exchange transaction with ID: ${param.id} to pending status with reason: ${body.voidReason}`,
          manager,
        );

        const [updateResult, logInsertResult] = await Promise.all([
          exchangeTransactionUpdateQuery,
          logInsertQuery,
        ]);

        if (updateResult.affected === 0) {
          await this.log(
            currentUser,
            'SET_EXCHANGE_TRANSACTION_PENDING_FAILED',
            `Failed to set exchange transaction with ID: ${param.id} to pending status. Exchange transaction not found or already processed.`,
          );
          throw new NotFoundException(
            'Exchange transaction not found or already processed.',
          );
        }
      });
      this.sseService.triggerRefreshBoothShiftId(activeShift.boothId , activeShift.id);
      return {
        message: `Exchange transaction with ID: ${param.id} has been set to pending status`,
      };
    } catch (error) {
      handleError(error, 'ExchangeTransactionsService.setStatusByEmployee');
    }
  }

  async setStatusByNonEmployee(
    currentUser: any,
    param: SetStatusDto,
    body: SetStatusToApproveBodyDto,
  ) {
    const exchangeTransaction =
      await this.exchangeTransactionRepository.findOne({
        where: {
          id: param.id,
          status: 'PENDING',
        },
      });

    if (!exchangeTransaction) {
      await this.log(
        currentUser,
        'SET_EXCHANGE_TRANSACTION_APPROVE_FAILED',
        `Failed to set exchange transaction with ID: ${param.id} cause Pending exchange transaction not found or already processed.`,
      );
      throw new NotFoundException(
        'Pending exchange transaction not found or already processed.',
      );
    }

    try {
       const exchangeTransaction = await this.getTransactionDetail(
            currentUser,
            { id: param.id },
      );

      await this.dataSource.transaction(async (manager) => {
        const exchangeTransRepo = manager.getRepository(ExchangeTransaction);
        const deletedAtValue = body.status === 'VOIDED' ? new Date() : null;

        const exchangeTransactionUpdateQuery = exchangeTransRepo.update(
          { id: param.id, status: 'PENDING' },
          {
            status: body.status,
            approvedBy: currentUser.id,
            deletedAt: deletedAtValue,
          },
        );
        const logInsertQuery = this.log(
          currentUser,
          'SET_EXCHANGE_TRANSACTION_APPROVE_SUCCESS',
          `Set exchange transaction with ID: ${param.id} to ${body.status} status`,
          manager,
        );

        const [updateResult, logInsertResult] = await Promise.all([
          exchangeTransactionUpdateQuery,
          logInsertQuery,
        ]);

        if (updateResult.affected === 0) {
          await this.log(
            currentUser,
            'SET_EXCHANGE_TRANSACTION_APPROVE_FAILED',
            `Failed to set exchange transaction with ID: ${param.id} cause Pending exchange transaction not found or already processed.`,
          );
          throw new NotFoundException(
            'Pending exchange transaction not found or already processed.',
          );
        }

        if (body.status === 'VOIDED') {
          const updateStockForCancel: UpdateStockByExchangeTransactionForCancel =
          {
            id: param.id,
            type: exchangeTransaction.type,
            shiftId: exchangeTransaction.shiftId,
            exchangeRateId: exchangeTransaction.exchangeRateId,
            foreignCurrencyAmount: exchangeTransaction.foreignCurrencyAmount as number,
            totalthaiBahtAmount: exchangeTransaction.totalthaiBahtAmount as number ,
          };
          await this.stocksService.updateStockByExchangeTransactionForCancel(
            currentUser,
            updateStockForCancel,
            manager,
          );
        }
      });
      this.sseService.triggerRefreshShiftId(exchangeTransaction.shiftId);
      return {
        message: `Exchange transaction with ID: ${param.id} has been set to ${body.status} status`,
      };
    } catch (error) {
      handleError(error, 'ExchangeTransactionsService.setStatusByNonEmployee');
    }
  }

  //ทำการสร้างexchange transaction แบบ bulk
  async createExchangeTransactionBulk(
    currentUser: any,
    body: CreateExchangeTransactionDto[],
    customer_img?: Express.Multer.File,
  ) {
    if (!body || body.length === 0) {
      throw new BadRequestException('No transaction data provided for bulk creation');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        let customerId: string | undefined = undefined;
        const results = [];

        for (let i = 0; i < body.length; i++) {
          const item = body[i];

          const res: any = await this.create(
            currentUser,
            item,
            i === 0 ? customer_img : undefined,
            manager,
            customerId,
          );

          if (i === 0 && res?.data?.customerId) {
            customerId = res.data.customerId;
          }

          results.push(res);
        }

        return {
          message: 'Bulk exchange transactions created successfully',
          data: results,
        };
      });
    } catch (error) {
      handleError(error, 'ExchangeTransactionsService.createExchangeTransactionBulk');
    }
  }
}
