import { BadRequestException, Injectable , InternalServerErrorException} from "@nestjs/common";
import {UpdateStockByExchangeTransactionDto , UpdateStockByTransferTransactionDto} from './dto/stocks.dto';
import { Stock } from './entities/stocks.entitiy' ;
import {ShiftsService} from './../shifts/shifts.service';
import {ExchangeRatesService} from './../exchange-rates/exchange-rates.service' ;
import {SystemLogsService} from './../system-logs/system-logs.service' ;
import {EntityManager, In, Repository} from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { isThisTypeNode } from "typescript";


@Injectable()
export class StocksService {
    constructor(
        private readonly shiftsService: ShiftsService,
        private readonly exchangeRatesService: ExchangeRatesService,
        private readonly systemLogsService: SystemLogsService ,
        @InjectRepository(Stock) 
        private readonly stockRepository: Repository<Stock>,
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
          manager,
        );
    }
     
    // create

    async create(shiftId: string | undefined , exchangeRateId: string | undefined , manager : EntityManager) {
        const stockRepo = manager.getRepository(Stock) ;
        const stockCreate = stockRepo.create({
            shiftId,
            exchangeRateId,
        });
        return await manager.save(stockCreate);
    }

    // read

    async getStock(shiftId: string | undefined , exchangeRateId: string | undefined) {
        return await this.stockRepository.findOne({ where: { shiftId :  shiftId, exchangeRateId :  exchangeRateId } });
    }

    checkBalance( exchangedStock : Stock | null, exchangeAmount : number) {
        return exchangedStock && exchangedStock.total_balance >= exchangeAmount ;
    }

    // update

    async updateStockByExchangeTransaction( user: any , updateStockDto: UpdateStockByExchangeTransactionDto , manager: EntityManager ) {
        const promiseShift = this.shiftsService.getLastShiftByUserId(updateStockDto.userId);
        const promiseExchangeRate = this.exchangeRatesService.findByTHBCurency();

        const [shift, thaiExchangeRate] = await Promise.all([promiseShift, promiseExchangeRate]);   
        
        const updateRecieveRateId  = updateStockDto.type === 'BUY' ? updateStockDto.foreignRateId :  thaiExchangeRate?.id  ; 
        const updateExchangeRateId = updateStockDto.type === 'BUY' ? thaiExchangeRate?.id : updateStockDto.foreignRateId  ;
        const updateRecieveAmount = updateStockDto.type === 'BUY' ? updateStockDto.foreingCurrencyAmount :  updateStockDto.totalThaiBahtAmount  ;
        const updateExchangeAmount = updateStockDto.type === 'BUY' ? updateStockDto.totalThaiBahtAmount :  updateStockDto.foreingCurrencyAmount  ;

        const promiseGetReceivedStock = await this.getStock(shift?.id  , updateRecieveRateId) ; 
        const promiseGetExchangedStock = await this.getStock(shift?.id  , updateExchangeRateId) ;

        const [receivedStock, exchangedStock] = await Promise.all([promiseGetReceivedStock, promiseGetExchangedStock]);
        if(!receivedStock) {
            const savedStock = await this.create(shift?.id , updateRecieveRateId , manager) ;
            if(!savedStock) {
                this.log(user, 'CREATE_EXCHANGE_TRANSACTION_FAILED', `Failed to create stock for shift ${shift?.id} and exchange rate ${updateRecieveRateId}`, manager);
                throw new InternalServerErrorException(`Failed to create stock for shift ${shift?.id} and exchange rate ${updateRecieveRateId}`);
            }
        }
        
        const isExchangeOverBalance = !this.checkBalance(exchangedStock , updateExchangeAmount) ;
        console.log('isExchangeOverBalance: ', isExchangeOverBalance);
        if(isExchangeOverBalance) {
            this.log(user, 'CREATE_EXCHANGE_TRANSACTION_FAILED', `Failed cause the exchange amount ${updateExchangeAmount} exceeds the available balance ${exchangedStock?.total_balance} for shift ${shift?.id} and exchange rate ${updateExchangeRateId}.`, manager);
            throw new BadRequestException(`Failed cause the exchange amount ${updateExchangeAmount} exceeds the available balance ${exchangedStock?.total_balance} for shift ${shift?.id} and exchange rate ${updateExchangeRateId}.`);
         }

        const updateReceiveQuery = await this.updateTotalReceive(shift?.id , updateRecieveRateId , updateRecieveAmount , manager) ;
        if(updateReceiveQuery.affected === 0) {
            this.log(user, 'CREATE_EXCHANGE_TRANSACTION_FAILED', `Failed cause cannot find shift ${shift?.id} and exchangerateId  ${updateRecieveRateId} to update in stock.`, manager);
            throw new BadRequestException(`Failed cause cannot find shift ${shift?.id} and exchangerateId  ${updateRecieveRateId} to update in stock.`);
        }

        const updateExchangeQuery = await this.updateTotalExchanged(shift?.id , updateExchangeRateId , updateExchangeAmount , manager) ;
        if(updateExchangeQuery.affected === 0) {
            this.log(user, 'CREATE_EXCHANGE_TRANSACTION_FAILED', `Failed cause cannot find shift ${shift?.id} and exchangerateId  ${updateExchangeRateId} to update in stock.`, manager);
            throw new BadRequestException(`Failed cause cannot find shift ${shift?.id} and exchangerateId  ${updateExchangeRateId} to update in stock.`);
        }
    }   

    async updateStockByTransferTransaction( user: any , updateStockDto: UpdateStockByTransferTransactionDto , manager: EntityManager ) {
        const isSenderExist = updateStockDto.sender ? true : false ;
        const promiseSenderShift = isSenderExist ? this.shiftsService.getLastShiftByBoothId(updateStockDto.sender ?? undefined) : Promise.resolve(null) ;
        const promiseReceiverShift = this.shiftsService.getLastShiftByBoothId(updateStockDto.receiver ?? undefined) ;

        const [senderShift, receiverShift] = await Promise.all([promiseSenderShift, promiseReceiverShift]);

        if (!receiverShift || (isSenderExist && !senderShift)) { 
            this.log(user, 'CREATE_TRANSFER_TRANSACTION_FAILED', `Failed cause cannot find active shift for sender or receiver.`, manager);
            throw new BadRequestException(`Failed cause cannot find active shift for sender or receiver.`);
        }

        if (isSenderExist) {
            const stockSender = await this.getStock(senderShift?.id , updateStockDto.exchangeRateId) ;
            if(!stockSender) {
                this.log(user, 'CREATE_TRANSFER_TRANSACTION_FAILED', `Failed cause cannot find stock for sender's shift ${senderShift?.id} and exchange rate ${updateStockDto.exchangeRateId} in stock.`, manager);
                throw new BadRequestException(`Failed cause cannot find stock for sender's shift ${senderShift?.id} and exchange rate ${updateStockDto.exchangeRateId} in stock.`);
            } 
            const isOverBalance = !this.checkBalance(stockSender , updateStockDto.transferAmount) ;
            if(isOverBalance) {
                this.log(user, 'CREATE_TRANSFER_TRANSACTION_FAILED', `Failed cause the transfer amount ${updateStockDto.transferAmount} exceeds the available balance ${stockSender?.total_balance} for sender's shift ${senderShift?.id} and exchange rate ${updateStockDto.exchangeRateId}.`, manager);
                throw new BadRequestException(`Failed cause the transfer amount ${updateStockDto.transferAmount} exceeds the available balance ${stockSender?.total_balance} for sender's shift ${senderShift?.id} and exchange rate ${updateStockDto.exchangeRateId}.`);
            }
            await this.updateTotalExchanged(senderShift?.id , updateStockDto.exchangeRateId , updateStockDto.transferAmount , manager) ;           
        }

        const stockReceiver = await this.getStock(receiverShift?.id , updateStockDto.exchangeRateId) ;
        if(!stockReceiver) {
            const savedStock = await this.create(receiverShift?.id , updateStockDto.exchangeRateId , manager) ;
            if(!savedStock) {
                this.log(user, 'CREATE_TRANSFER_TRANSACTION_FAILED', `Failed to create stock for receiver's shift ${receiverShift?.id} and exchange rate ${updateStockDto.exchangeRateId}`, manager);
                throw new InternalServerErrorException(`Failed to create stock for receiver's shift ${receiverShift?.id} and exchange rate ${updateStockDto.exchangeRateId}`);
            }
        }
        await this.updateTotalReceive(receiverShift?.id , updateStockDto.exchangeRateId , updateStockDto.transferAmount , manager) ;
    }

    async updateTotalReceive(shiftId : string | undefined , updateRecieveRateId : string | undefined , updateRecieveAmount : number , manager: EntityManager) {
        const stockRepo = manager.getRepository(Stock) ;
        const updateQuery =  await stockRepo.update({ shiftId: shiftId , exchangeRateId : updateRecieveRateId } , { total_received : () => `total_received + ${updateRecieveAmount}` , total_balance : () => `total_balance + ${updateRecieveAmount}` }) ;
        return updateQuery;
    }

    async updateTotalExchanged(shiftId : string | undefined , updateExchangeRateId : string | undefined , updateExchangeAmount : number , manager: EntityManager) {
        const stockRepo = manager.getRepository(Stock) ;
        const updateQuery =  await stockRepo.update({ shiftId: shiftId , exchangeRateId : updateExchangeRateId } , { total_exchanged : () => `total_exchanged + ${updateExchangeAmount}` , total_balance : () => `total_balance - ${updateExchangeAmount}` }) ;
        return updateQuery;
    }




}