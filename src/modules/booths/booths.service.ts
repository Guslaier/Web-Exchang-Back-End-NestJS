import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { CreateBoothDto, UpdateBoothDto } from './dto/booth.dto';
import { Booth } from './entities/booth.entity';
import { User } from '../users/entities/user.entity';
import {
  DataSource,
  Not,
  Repository,
  EntityManager,
  MoreThanOrEqual,
  IsNull,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { ExclusiveExchangeRatesService } from '../exclusive-exchange-rates/exclusive-exchange-rates.service';
import { TransferTransactionsService } from '../transfer-transactions/transfer-transactions.service' ;
import { Shift } from '../shifts/entities/shift.entity';
import { handleError } from '../../common/error/error';
import { SseService } from '../sse/sse.service';
import { to } from 'mathjs';
import { SharedShiftsService } from '../shared-shifts/shared-shifts.service';
import { StocksService } from '../stocks/stocks.service';
import Redis from 'ioredis';
import { Stock } from '../stocks/entities/stocks.entitiy';
import { Transaction } from '../transactions/entities/transaction.entity';

@Injectable()
export class BoothsService {
  constructor(
    @InjectRepository(Booth)
    private readonly boothRepository: Repository<Booth>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => SystemLogsService))
    private readonly systemLogsService: SystemLogsService,
    @Inject(forwardRef(() => ExclusiveExchangeRatesService))
    private readonly exclusiveRateService: ExclusiveExchangeRatesService,
    @InjectRepository(Shift)
    private readonly shift: Repository<Shift>,
    @Inject(forwardRef(() => SseService))
    private readonly sseService: SseService,
    @Inject(forwardRef(() => SharedShiftsService))
    private readonly sharedShiftsService: SharedShiftsService,
    @Inject(forwardRef(() => TransferTransactionsService))
    private readonly tranferService : TransferTransactionsService ,
    @Inject(forwardRef(() => StocksService))
    private readonly stocksService: StocksService,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
  ) { }

  /**
   * Helper สำหรับบันทึก Log โดยรองรับ Transaction manager
   */
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

  // สร้างบูธใหม่
  async create(user: any, createBoothDto: CreateBoothDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const boothRepo = manager.getRepository(Booth);

        const existingBooth = await boothRepo.findOne({
          where: { name: createBoothDto.name },
        });

        if (existingBooth) {
          await this.log(
            user,
            'CREATE_BOOTH_FAILED',
            `Duplicate name: ${createBoothDto.name}`,
            manager,
          );
          throw new ConflictException('Booth name already exists');
        }

        const booth = boothRepo.create({
          name: createBoothDto.name || `Booth-${Date.now()}`,
          location: createBoothDto.location,
        });

        const savedBooth = await boothRepo.save(booth);

        // สร้าง ExclusiveExchangeRate สำหรับบูธใหม่
        await this.exclusiveRateService.generateExclusivesForBooth(
          user,
          manager,
          savedBooth.id,
        );
        await this.log(
          user,
          'CREATE_BOOTH_SUCCESS',
          `Created booth: ${savedBooth.name}`,
          manager,
        );
        this.sseService.triggerRefreshSignal();
        return savedBooth;
      });
    } catch (error) {
      handleError(error, 'BoothsService.create');
    }
  }

  // ดึงข้อมูลบูธทั้งหมด (ไม่ต้อง Transaction เพราะแค่ Read)
  async findAll() {
    return await this.boothRepository.find();
  }

  // หาบูธตัวเดียวด้วย ID
  async findOne(id: string) {
    const booth = await this.boothRepository.findOne({ where: { id } });
    if (!booth) throw new NotFoundException('Booth not found');
    return booth;
  }

  async findBoothCurrentShift(boothId ?: string  | null , shiftId ?: string | null  ) {
    if (shiftId) {
      const boothData = await this.boothRepository.query(
        `select b.id as boothId , s.id as shiftId , u.id as userId , b.name  , u.username , b.location , s.status , s.cash_advance , s.balance_check, s."startTime"
        from shifts s 
        join booths b on s."boothId" = b.id
        join users u on s."userId" = u.id
        where s.id = $1 and s."deletedAt" is null`,
        [shiftId],
      );
      return boothData[0];
    } else {
      if (!boothId) {
        throw new BadRequestException('boothId is required when shiftId is not provided');
      }
      const boothData = await this.boothRepository.query(
        `select b.id as boothId , u.id as userId , b.name  , u.username , b.location 
        from booths b
        left join users u on b."currentShiftId" = u.id
        where b.id = $1 and b."deletedAt" is null and b."isActive" = true`,
        [boothId],
      );
      return boothData[0];
    }
  }

  async getBoothIfExist(id: string) {
    const boothData = await this.findOne(id);
    return boothData;
  }

  async findBoothShiftOuterJoin(from?: Date, to?: Date) {
    try {
      let query: string;
      const params = [];

      if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);

        query = `
          SELECT b.id AS "boothID", s.id AS "shiftID" , s.status, b."currentShiftId"
          FROM booths b
          FULL OUTER JOIN (
            SELECT * FROM shifts 
            WHERE "startTime" BETWEEN $1 AND $2 AND "deletedAt" IS NULL
          ) s ON b.id = s."boothId" AND b."currentShiftId" = s."userId" and s."deletedAt" is null
          WHERE b."deletedAt" IS NULL
          ORDER BY b.name ASC
        `;
        params.push(fromDate, toDate);
      } else {
        query = `
          SELECT b.id AS "boothID", s.id AS "shiftID", b."currentShiftId"
          FROM booths b
          FULL OUTER JOIN shifts s 
            ON b.id = s."boothId" AND b."currentShiftId" = s."userId" AND s."deletedAt" IS NULL
          WHERE b."deletedAt" IS NULL
          ORDER BY b.name ASC
        `;
      }

      return await this.boothRepository.query(query, params);
    } catch (error) {
      handleError(error, 'BoothsService.findBoothShiftOuterJoin');
    }
  }

  // อัปเดตข้อมูลบูธ
  async update(user: any, id: string, updateBoothDto: UpdateBoothDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const boothRepo = manager.getRepository(Booth);
        const booth = await boothRepo.findOne({ where: { id } });
        if (!booth) throw new NotFoundException('Booth not found');

        if (updateBoothDto.name && updateBoothDto.name !== booth.name) {
          const existing = await boothRepo.findOne({
            where: { name: updateBoothDto.name },
          });
          if (existing) {
            await this.log(
              user,
              'UPDATE_BOOTH_FAILED',
              `Name conflict: ${updateBoothDto.name}`,
              manager,
            );
            throw new ConflictException('Booth name already exists');
          }
        }

        await boothRepo.update(id, updateBoothDto);
        await this.log(
          user,
          'UPDATE_BOOTH_SUCCESS',
          `Updated booth id: ${id}`,
          manager,
        );

        this.sseService.triggerRefreshSignal();
        return await boothRepo.findOne({ where: { id } });
      });
    } catch (error) {
      handleError(error, 'BoothsService.update');
    }
  }

  // ลบบูธ (Soft Delete + เปลี่ยนชื่อกันซ้ำ)
  async remove(user: any, id: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const boothRepo = manager.getRepository(Booth);
        const booth = await boothRepo.findOne({ where: { id } });
        if (!booth) throw new NotFoundException('Booth not found');

        if (booth.currentShiftId) {
          await this.log(
            user,
            'DELETE_BOOTH_FAILED',
            `Active shift exists: ${id}`,
            manager,
          );
          throw new ForbiddenException(
            'Cannot delete booth with an active shift',
          );
        }

        const mutatedName = `${booth.name}_deleted_${Date.now()}`;
        await boothRepo.update(id, { name: mutatedName });
        const result = await boothRepo.softDelete(id);

        if (result.affected === 0) throw new Error('DELETE_FAILED');

        await this.log(
          user,
          'DELETE_BOOTH_SUCCESS',
          `Deleted booth id: ${id}`,
          manager,
        );
        this.sseService.triggerRefreshSignal();
        return { message: 'Booth removed successfully' };
      });
    } catch (error) {
      handleError(error, 'BoothsService.remove');
    }
  }

  // ปิดการใช้งานบูธ
  async setDeActive(user: any, id: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const boothRepo = manager.getRepository(Booth);
        const booth = await boothRepo.findOne({ where: { id } });
        if (!booth) throw new NotFoundException('Booth not found');

        if (booth.currentShiftId) {
          await this.log(
            user,
            'DEACTIVATE_FAILED',
            `Booth ${id} is 'busy'`,
            manager,
          );
          throw new ForbiddenException(
            'Cannot deactivate booth while open or busy',
          );
        }

        if (!booth.isActive) {
          await this.log(
            user,
            'DEACTIVATE_FAILED',
            `Booth ${id} is already inactive`,
            manager,
          );
          throw new BadRequestException('Already inactive');
        }

        await boothRepo.update(id, { isActive: false });
        await this.log(
          user,
          'DEACTIVATE_SUCCESS',
          `Deactivated booth: ${id}`,
          manager,
        );
        this.sseService.triggerRefreshSignal();
        return { message: 'Booth deactivated successfully' };
      });
    } catch (error) {
      handleError(error, 'BoothsService.setDeActive');
    }
  }

  // เปิดการใช้งานบูธ
  async setReActive(user: any, id: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const boothRepo = manager.getRepository(Booth);
        const booth = await boothRepo.findOne({ where: { id } });
        if (!booth) throw new NotFoundException('Booth not found');

        if (booth.isActive) {
          await this.log(
            user,
            'REACTIVATE_FAILED',
            `Booth ${id} is already active`,
            manager,
          );
          throw new BadRequestException('Already active');
        }

        await boothRepo.update(id, { isActive: true });
        await this.log(
          user,
          'REACTIVATE_SUCCESS',
          `Reactivated booth: ${id}`,
          manager,
        );
        this.sseService.triggerRefreshSignal();
        return { message: 'Booth reactivated successfully' };
      });
    } catch (error) {
      handleError(error, 'BoothsService.setReActive');
    }
  }

  // ปิดกะเก่า เปิดกะใหม่ และคัดลอกสต็อกสำหรับบูธ
  async closeOldAndOpenNewShift(
    user: any,
    boothId: string,
    newEmpId: string,
  ) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const boothRepo = manager.getRepository(Booth);
        const booth = await boothRepo.findOne({ where: { id: boothId } });
        if (!booth) throw new NotFoundException('Booth not found');

        const oldEmployeeId = booth.currentShiftId;

        if (oldEmployeeId) {
          const oldShift = await this.sharedShiftsService.getLastShiftByUserId(manager, oldEmployeeId);

          // ดึงข้อมูลสต็อกของกะเก่า
          const oldStocks = oldShift
            ? await this.stocksService.getStockShift(oldShift.id)
            : [];

          // ปิดกะเก่า
          if (oldShift) {
            const firstCashCount = await manager.getRepository(Transaction).findOne({
              where: {
                shiftId: oldShift.id,
                type: 'FIRST_SHIFT_CASH_COUNT' as any,
              },
            });

            if (!firstCashCount) {
              await this.tranferService.runCreateFirstShiftCashCount(
                user,
                {
                  transferDto: {
                    boothId: boothId,
                    amount: 0,
                    type: 'CASH_IN',
                    status: 'COMPLETED',
                  },
                  cashCountDto: [{ denominations: '1', amounts: 0 }],
                },
                manager,
              );
            }

            await manager.getRepository(Shift).update(oldShift.id, { status: 'AWAITINGAUDIT', endTime: new Date() });
            this.sseService.triggerRefreshShiftId(oldShift.id);
          }

          // อัปเดตพนักงานใหม่ให้กับบูธ
          await boothRepo.update(boothId, { currentShiftId: newEmpId });

          // เปิดกะสำหรับพนักงานใหม่
          const newShift = await this.sharedShiftsService.openShift(manager, user, { boothId });
          const newShiftId = (newShift && 'id' in newShift)
            ? (newShift as any).id
            : (await this.sharedShiftsService.getLastShiftByUserId(manager, newEmpId))?.id;

          // อัปเดตสต็อกให้กับกะใหม่โดยอิงจากยอดกะเก่า
          if (newShiftId && oldStocks && oldStocks.length > 0) {
            const THBId = await this.stocksService.getTHBIdCache();
            for (const item of oldStocks) {
              if (item.exchangeRateId === THBId) {
                await this.tranferService.runCreateFirstShiftCashCount(
                  user,
                  {
                    transferDto: {
                      boothId: boothId,
                      amount: item.total_balance as number,
                      type: 'CASH_IN',
                      status: 'COMPLETED',
                    },
                    cashCountDto: [{ denominations: '1', amounts: item.total_balance }],
                  },
                  manager,
                );
                continue ; 
              }
              await this.tranferService.transferCenterToBooth(
                user,
                {
                  boothId: boothId,
                  amount: item.total_balance as number,
                  exchangeRateId: item.exchangeRateId as string,
                  type: 'CASH_IN',
                  status: 'COMPLETED',
                },
                manager,
              );
            }
          }
        } else {
          // ถ้าไม่มีพนักงานเก่า แค่อัปเดตพนักงานใหม่ให้กับบูธ (ไม่ต้องเปิดกะงานใหม่)
          await boothRepo.update(boothId, { currentShiftId: newEmpId });
        }

        await this.log(
          user,
          'SHIFT_TRANSITION_SUCCESS',
          `Shift transition successful for Booth: ${boothId} from ${oldEmployeeId || 'none'} to ${newEmpId}`,
          manager,
        );
        this.sseService.triggerRefreshSignal();
        return { message: 'Shift transitioned successfully' };
      });
    } catch (error) {
      handleError(error, 'BoothsService.closeOldAndOpenNewShift');
    }
  }

  // จัดการพนักงานเข้ากะ
  async setCurrentShift(user: any, id: string, shiftId: string | null) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const boothRepo = manager.getRepository(Booth);
        const userRepo = manager.getRepository(User);

        const booth = await boothRepo.findOne({ where: { id } });
        if (!booth) throw new NotFoundException('Booth not found');

        // เคลียร์พนักงานออก
        if (shiftId === null) {
          if (booth.currentShiftId === null)
            throw new BadRequestException('No shift to clear');

          await boothRepo.update(id, { currentShiftId: null });
          await this.log(
            user,
            'CLEAR_SHIFT_SUCCESS',
            `Cleared shift at booth: ${id}`,
            manager,
          );
          this.sseService.triggerRefreshSignal();
          return { message: 'Current shift cleared successfully' };
        }

        // ถ้าshift ในวันนั้นมีการเปิดกะอยู่แล้ว จะไม่อนุญาตให้ทำการ assign พนักงานเข้ากะที่บูธนั้น
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const activeShift = await manager.getRepository(Shift).findOne({
          where: {
            id: shiftId,
            userId: booth.currentShiftId as string,
            status: Not('COMPLETED'),
            createdAt: MoreThanOrEqual(todayStart),
          },
        });

        if (activeShift) {
          if (activeShift.status == 'OPEN') {
            await this.log(
              user,
              'ASSIGN_SHIFT_FAILED',
              `No active shift found for shiftId: ${shiftId}`,
              manager,
            );
            throw new BadRequestException(
              'No active shift found for the given shiftId',
            );
          }
        }

        const worker = await userRepo.findOne({ where: { id: shiftId } });
        if (!worker) throw new NotFoundException('Worker not found');
        if (!worker.isActive || worker.role !== 'EMPLOYEE')
          throw new ForbiddenException('Invalid worker');

        if (booth.currentShiftId === shiftId)
          throw new BadRequestException('Already assigned');

        const otherBooth = await boothRepo.findOne({
          where: { currentShiftId: shiftId, id: Not(id) },
        });

        if (otherBooth) {
          await this.log(
            user,
            'ASSIGN_SHIFT_FAILED',
            `Worker ${worker.username} (${shiftId}) already at Booth: ${otherBooth.name} (${otherBooth.id})`,
            manager,
          );
          throw new ConflictException(`Worker ${worker.username} already at Booth: ${otherBooth.name}`);
        }

        // อัปเดตพนักงานใหม่ให้กับบูธโดยตรง
        await boothRepo.update(id, { currentShiftId: shiftId });

        await this.log(
          user,
          'ASSIGN_SHIFT_SUCCESS',
          `Worker ${worker.username} (${shiftId}) -> Booth ${booth.name} (${id})`,
          manager,
        );
        this.sseService.triggerRefreshSignal();
        return { message: 'User assigned to booth successfully' };
      });
    } catch (error) {
      handleError(error, 'BoothsService.setCurrentShift');
    }
  }

  async findBoothByShiftId(shiftId: string) {
    if (!shiftId) return null;
    const booth = await this.boothRepository.findOne({
      where: { currentShiftId: shiftId },
    });
    const shift = await this.shift.findOne({ where: { id: shiftId } });
    return {
      id: booth?.id || null,
      boothName: booth?.name || null,
      location: booth?.location || null,
      IsOpen: shift?.status === 'OPEN' ? true : false,
    };
  }

  async getBoothAndShiftCurrentByUser(user: any) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const shift = await this.shift.findOne({
      where: { userId: user.id, status: Not('COMPLETED'), startTime: MoreThanOrEqual(todayStart) },
    });
    const booth = await this.boothRepository.findOne({
      where: { currentShiftId: user.id },
    });
    return {
      booth,
      shift,
    }
  }
}
