import { Injectable, NotFoundException, InternalServerErrorException, ConflictException, Inject, BadRequestException } from '@nestjs/common';
import { BoothsService } from '../../modules/booths/booths.service';
import { NotFoundError } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { CannotAttachTreeChildrenEntityError, IsNull, Repository, DataSource, EntityManager } from 'typeorm';
import { SystemLogsService } from '../../modules/system-logs/system-logs.service';
import { get } from 'http';
import { error } from 'console';
import Redis from 'ioredis';



@Injectable()
export class ShiftsService {
    constructor(
        private readonly boothService: BoothsService,
        @InjectRepository(Shift)
        private readonly shiftRepository: Repository<Shift>,
        private readonly systemLogsService: SystemLogsService,
        @Inject('REDIS_CLIENT')
        private readonly redisClient: Redis,
        private readonly dataSource: DataSource
    ) {

    }

    private async log(
        user: any,
        action: string,
        details: string,
        manager?: EntityManager
    ) {
        await this.systemLogsService.createLog(
            user,
            {
                userId: user?.id || null,
                action,
                details,
            },
        );
    }


    async openShift(currentUser: any) {
        return await this.dataSource.transaction(async (manager) => {
            const booth = await this.boothService.findBoothByShiftId(currentUser.id);
            if (!booth) {
                await this.log(currentUser, "open shift FAILED", "not found booth for this employee", manager);
                throw new NotFoundException("your booth work is not found.");
            }

            const boothId = booth.id;

            const activeShift = await this.getActiveShiftByUserId(currentUser.id);

            if (activeShift) {
                await this.log(currentUser, "open shift FAILED", `lastest shift ${activeShift.id} from this employee is not close.`, manager);
                throw new ConflictException("you have not close your laset shift yet.");
            }

            const shiftRepo = manager.getRepository(Shift);
            const row = await shiftRepo.create(({
                userId: currentUser.id,
                boothId: boothId,
            }))

            try {
                await this.log(currentUser, "open shift SUCCESS", ``, manager);
                const savedShift = await shiftRepo.save(row);
                await this.createCacheSummaryShift(savedShift.id, manager);
            }
            catch (err) {
                await this.log(currentUser, "open shift FAILED", `internal server error`, manager);
                throw new InternalServerErrorException('error in internal server. please contact admin.');
            }

            return {
                message: "open shift success."
            }
        });
    }

    async setStatusToCLose(currentUser: any) {
        return await this.dataSource.transaction(async (manager) => {
            const activeShift = await this.getActiveShiftByUserId(currentUser.id);
            if (!activeShift) {
                await this.log(currentUser, "close shift FAILED", "active shift from this employee not found.", manager);
                throw new NotFoundException('you active shift is not found.');
            }

            await this.deleteCacheSummaryShift(activeShift.id, manager);

            const shiftRepo = manager.getRepository(Shift);


            try {
                await shiftRepo.update(activeShift.id, { status: "close", endTime: new Date() });
                await this.log(currentUser, "close shift SUCCESS", "", manager);
            }
            catch (err) {
                await this.log(currentUser, "close shift failed", "internal server error", manager);
                throw new InternalServerErrorException('error in internal server. please contact admin.');
            }

            return {
                message: 'close shift successfuly.'
            };
        });

    }

    private async getActiveShiftByUserId(userId: string) {
        return await this.shiftRepository.findOne({ where: { userId: userId, endTime: IsNull() } });
    }

    private async createCacheSummaryShift(shiftId: string, manager: EntityManager) {
        try {
            await this.redisClient.hset(shiftId, {
                total_receive: 0,
                total_exchange: 0,
                balance: 0
            });
            await this.redisClient.expire(shiftId, 60 * 60 * 12);
            await this.log(null, 'CREATE_CACHE_SHIFT_SUCCESS', '', manager);
        }
        catch (error) {
            await this.log(null, 'CREATE_CACHE_SHIFT_FAILED', '', manager)
        }

    }

    private async deleteCacheSummaryShift(shiftId: string, manager: EntityManager) {
        try {
            await this.redisClient.del(shiftId);
            await this.log(null, 'DELETE_CACHE_SHIFT_SUCCESS', '', manager);
        }
        catch (error) {
            await this.log(null, 'DELETE_CACHE_SHIFT_FAILED', '', manager);
        }
    }


    async setTotalReceive(boothId: string, amount: number) {

        if (amount < 0) {
            throw new BadRequestException(`amount of receive can't be under 0`)
        }

        const shift = await this.getActiveShiftByBoothId(boothId);
        if (!shift) {
            throw new NotFoundException(`active shift from Booth: ${boothId} not found.`);
        }

        const shiftId = shift.id;

        try {
            return await this.dataSource.transaction(async (manager) => {
                const shiftRepo = manager.getRepository(Shift);

                await shiftRepo.update(shiftId, {
                    total_receive: () => `total_receive + ${amount}`,
                    balance: () => `balance + ${amount}`,
                });

                const shiftExists = await this.redisClient.exists(shiftId);
                if (shiftExists) {
                    await this.redisClient.pipeline()
                        .hincrbyfloat(shiftId, 'total_receive', amount)
                        .hincrbyfloat(shiftId, 'balance', amount)
                        .exec();
                }

                this.log(null, 'UPDATE_TOTAL_RECEIVE_SUCCESS', `Shift: ${shiftId}, Amount: ${amount}`, manager);
            });
        } catch (err) {
            this.log(null, 'UPDATE_TOTAL_RECEIVE_FAILED', `Shift: ${shiftId}, Error: ${err}`);
            throw new InternalServerErrorException('Internal Server Error');
        }
    }

     async setTotalExchange(boothId: string, amount: number) {

        if (amount < 0) {
            throw new BadRequestException(`amount of receive can't be under 0`)
        }

        const shift = await this.getActiveShiftByBoothId(boothId);
        if (!shift) {
            throw new NotFoundException(`active shift from Booth: ${boothId} not found.`);
        }

        const shiftId = shift.id;

        try {
            return await this.dataSource.transaction(async (manager) => {
                const shiftRepo = manager.getRepository(Shift);

                await shiftRepo.update(shiftId, {
                    total_exchange: () => `total_exchange + ${amount}`,
                    balance: () => `balance + ${-amount}`,
                });

                const shiftExists = await this.redisClient.exists(shiftId);
                if (shiftExists) {
                    await this.redisClient.pipeline()
                        .hincrbyfloat(shiftId, 'total_exchange', amount)
                        .hincrbyfloat(shiftId, 'balance', (-amount))
                        .exec();
                }

                this.log(null, 'UPDATE_TOTAL_EXCHANGE_SUCCESS', `Shift: ${shiftId}, Amount: ${amount}`, manager);
            });
        } catch (err) {
            this.log(null, 'UPDATE_TOTAL_EXCHANGE_FAILED', `Shift: ${shiftId}, Error: ${err}`);
            throw new InternalServerErrorException('Internal Server Error');
        }
    }

    private async getActiveShiftByBoothId(boothId: string) {
        return await this.shiftRepository.findOne({ where: { boothId: boothId, endTime: IsNull() } });
    }

}