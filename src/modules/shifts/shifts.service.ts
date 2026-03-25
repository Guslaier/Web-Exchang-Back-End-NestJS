import { Injectable, NotFoundException, InternalServerErrorException, ConflictException, Inject } from '@nestjs/common';
import { BoothsService } from '../../modules/booths/booths.service';
import { NotFoundError } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { CannotAttachTreeChildrenEntityError, IsNull, Repository, DataSource } from 'typeorm';
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
        return await this.dataSource.transaction(async () => {
            const booth = await this.boothService.findBoothByShiftId(currentUser.id);
            if (!booth) {
                await this.log(currentUser, "open shift FAILED", "not found booth for this employee");
                throw new NotFoundException("your booth work is not found.");
            }

            const boothId = booth.id;

            const activeShift = await this.getActiveShiftByUserId(currentUser.id);

            if (activeShift) {
                await this.log(currentUser, "open shift FAILED", `lastest shift ${activeShift.id} from this employee is not close.`);
                throw new ConflictException("you have not close your laset shift yet.");
            }

            const row = this.shiftRepository.create(({
                userId: currentUser.id,
                boothId: boothId,
            }))

            try {
                await this.log(currentUser, "open shift SUCCESS", ``);
                const savedShift = await this.shiftRepository.save(row);
                await this.createCacheSummaryShift(savedShift.id);
            }
            catch (err) {
                await this.log(currentUser, "open shift FAILED", `internal server error`);
                throw new InternalServerErrorException('error in internal server. please contact admin.');
            }

            return {
                message: "open shift success."
            }
        });
    }

    async setStatusToCLose(currentUser: any) {
        const activeShift = await this.getActiveShiftByUserId(currentUser.id);
        if (!activeShift) {
            await this.log(currentUser, "close shift FAILED", "active shift from this employee not found.");
            throw new NotFoundException('you active shift is not found.');
        }

        const cache = await this.redisClient.hgetall(activeShift.id);

        if (cache) {
            await this.setSummaryFromCache(activeShift.id);
        }

        await this.deleteCacheSummaryShift(activeShift.id);

        try {
            await this.shiftRepository.update(activeShift.id, { status: "close", endTime: new Date() });
            await this.log(currentUser, "close shift SUCCESS", "");
        }
        catch (err) {
            await this.log(currentUser, "close shift failed", "internal server error");
            throw new InternalServerErrorException('error in internal server. please contact admin.');
        }

        return {
            message: 'close shift successfuly.'
        };
    }

    private async getActiveShiftByUserId(userId: string) {
        return await this.shiftRepository.findOne({ where: { userId: userId, endTime: IsNull() } });
    }

    private async createCacheSummaryShift(shiftId: string) {
        try {
            await this.redisClient.hset(shiftId, {
                total_receive: 0,
                total_exchange: 0,
                balance: 0
            });
            await this.redisClient.expire(shiftId, 60 * 60 * 12);
            await this.log(null, 'CREATE_CACHE_SHIFT_SUCCESS', '');
        }
        catch (error) {
            await this.log(null, 'CREATE_CACHE_SHIFT_FAILED', '')
        }

    }

    private async deleteCacheSummaryShift(shiftId: string) {
        try {
            await this.redisClient.del(shiftId);
            await this.log(null, 'DELETE_CACHE_SHIFT_SUCCESS', '');
        }
        catch (error) {
            console.log(error);
            await this.log(null, 'DELETE_CACHE_SHIFT_FAILED', '');
        }
    }

    private async setSummaryFromCache(shiftId: string) {
        const summary = await this.redisClient.hgetall(shiftId);
        const total_receive = Number(summary.total_receive);
        const total_exchange = Number(summary.total_exchange);
        const balance = Number(summary.balance);

        try {
            await this.shiftRepository.update(shiftId, {
                total_receive: total_receive,
                total_exchange: total_exchange,
                balance: balance,
            });
            await this.log(null, 'UPDATE_SUMMARY_SHIFT_SUCCESS', `total receive : ${total_receive} , total exchange : ${total_exchange} , balance : ${balance}  `);
        }
        catch (error) {
            await this.log(null, 'UPDATE_SUMMARY_SHIFT_FAILED', '');
        }

    }

    async setTotalReceive() {

    }


}