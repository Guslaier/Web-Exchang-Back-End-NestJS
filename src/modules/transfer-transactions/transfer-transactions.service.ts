import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, IsNull } from 'typeorm';
import { TransferTransaction } from './entities/transfer-transaction.entity';
import {
  CreateTransferTransactionDto,
  TransferBoothToBoothDto,
  TransferCenterToBoothDto,
  CashCountDataDto,
  UpdateTransferTransactionDto,
} from './dto/transfer-transaction.dto';
import { BoothsService } from '../booths/booths.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { CashCountsService } from '../cash-counts/cash-counts.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Booth } from '../booths/entities/booth.entity';
import { Currency } from '../currencies/entities/currency.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TransferTransactionsService {
  private readonly logger = new Logger(TransferTransactionsService.name);

  constructor(
    @InjectRepository(TransferTransaction)
    private readonly transferTransactionRepository: Repository<TransferTransaction>,
    @InjectRepository(Booth)
    private readonly boothRepository: Repository<Booth>,
    private readonly dataSource: DataSource,
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

  async createMovement(user: any, createDto: CreateTransferTransactionDto, manager: EntityManager){
        const transaction = await this.transactionsService.create(manager, {
            type: 'TRANSFER',
            shiftId: null, // กำหนด shiftId เป็น null สำหรับ movement
        });

        const transferTransaction = manager?.getRepository(TransferTransaction).create({
            id: transaction.id,
            boothId: createDto.boothId,
            currencyCode: createDto.currencyCode,
            amount: createDto.amount,
            type: createDto.type,
            refBoothId: createDto.refBoothId,
            description: createDto.description,
            user_id: createDto.userId,
        });
        try {
                await manager?.getRepository(TransferTransaction).save(transferTransaction);
                await this.log(
                    user,
                    'CREATE_MOVEMENT',
                    `Created movement of ${createDto.amount} ${createDto.currencyCode} for booth ${createDto.boothId}`,
                    manager,
                );
                return transferTransaction;
            } catch (error) {
                await this.log(
                    user,
                    'CREATE_MOVEMENT_FAILED',
                    `Failed to create movement of ${createDto.amount} ${createDto.currencyCode} for booth ${createDto.boothId}`,
                    manager,
                );
                throw new InternalServerErrorException('Failed to create movement');
            }
  } 

  async transferBoothToBooth(user: any, transferDto: TransferBoothToBoothDto) {
    return await this.dataSource.transaction(async (manager) => {
        // Validate booths
        const sourceBooth = await manager.getRepository(Booth).findOne({ where: { id: transferDto.boothId, isActive: true } });
        if (!sourceBooth) {
            throw new NotFoundException(`Source booth with ID ${transferDto.boothId} not found or inactive`);
        }
        // ถ้าเป็นการโอนระหว่างบูธ ต้องตรวจสอบว่า refBoothId ไม่ใช่ null
        const targetBooth = await manager.getRepository(Booth).findOne({ where: { id: transferDto.refBoothId, isActive: true } });
        if (!targetBooth) {
            throw new NotFoundException(`Target booth with ID ${transferDto.refBoothId} not found or inactive`);
        }
        
        // เช็คว่าบูธต้นทางและปลายทางไม่เหมือนกัน
        if (transferDto.boothId === transferDto.refBoothId) {
            throw new BadRequestException('Source and target booths cannot be the same');
        }


        // Validate currency
        const currency = await manager.getRepository(Currency).findOne({ where: { code: transferDto.currencyCode } });
        if (!currency) {
            throw new NotFoundException(`Currency with code ${transferDto.currencyCode} not found`);
        }

        // Create transfer transaction
        const transferTransaction = await this.createMovement(user, {
            boothId: transferDto.boothId,   
            currencyCode: transferDto.currencyCode,
            amount: transferDto.amount,
            type: '',
            refBoothId: transferDto.refBoothId,
            description: transferDto.description,
            userId: transferDto.userId,
        }, manager);

        // Update cash counts for both booths
        await this.cashCountsService.updateCashCountForTransfer(
            manager,
            transferDto.boothId,
            transferDto.amount,
            transferDto.currencyCode,
            'OUTGOING',
        );  


        return transferTransaction;
    });
    }
}