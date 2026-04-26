import { BadRequestException, Injectable , InternalServerErrorException, NotFoundException} from "@nestjs/common";
import {UpdateStockByExchangeTransactionDto , UpdateStockByExchangeTransactionForCancel, UpdateStockByTransferTransactionDto, UpdateStockByTransferTransactionForCancel} from './dto/stocks.dto';
import { Stock } from './entities/stocks.entitiy' ;
import {ShiftsService} from './../shifts/shifts.service';
import {ExchangeRatesService} from './../exchange-rates/exchange-rates.service' ;
import {SystemLogsService} from './../system-logs/system-logs.service' ;
import {EntityManager, Repository} from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

    
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

    async getStock(shiftId: string | undefined , exchangeRateId: string | undefined, manager?: EntityManager) {
        if (manager) {
            return await manager.getRepository(Stock).findOne({ where: { shiftId :  shiftId, exchangeRateId :  exchangeRateId } });
        }
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

        const promiseGetReceivedStock = await this.getStock(shift?.id  , updateRecieveRateId, manager) ; 
        const promiseGetExchangedStock = await this.getStock(shift?.id  , updateExchangeRateId, manager) ;

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
            throw new BadRequestException(`Failed cause the exchange amount ${updateExchangeAmount} exceeds the available balance ${exchangedStock?.total_balance} for shift ${shift?.id} and exchange rate ${(await this.exchangeRatesService.findById(updateExchangeRateId as string)).name}.`);
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

    async updateStockByExchangeTransactionForCancel( user: any ,  exchangeTransaction: UpdateStockByExchangeTransactionForCancel , manager: EntityManager ) {
        const thaiExchangeRate = await this.exchangeRatesService.findByTHBCurency() ;

        if(!thaiExchangeRate){
            this.log(user, 'CANCEL_EXCHANGE_TRANSACTION_FAILED', `Failed cause cannot find Thai exchange rate to update stock for cancelling exchange transaction with id ${exchangeTransaction.id}.`, manager);
            throw new NotFoundException(`Failed cause cannot find Thai exchange rate to update stock for cancelling exchange transaction with id ${exchangeTransaction.id}.`);
        }

        console.log('thaiExchangeRate: ', thaiExchangeRate);
        console.log('exchangeTransaction: ', exchangeTransaction);

        const updateRecieveRateId  = exchangeTransaction.type === 'BUY' ? thaiExchangeRate?.id :  exchangeTransaction.exchangeRateId  ; 
        const updateExchangeRateId = exchangeTransaction.type === 'BUY' ? exchangeTransaction.exchangeRateId : thaiExchangeRate?.id  ;
        const updateRecieveAmount = exchangeTransaction.type === 'BUY' ? exchangeTransaction.totalthaiBahtAmount :  exchangeTransaction.foreignCurrencyAmount  ;
        const updateExchangeAmount = exchangeTransaction.type === 'BUY' ? exchangeTransaction.foreignCurrencyAmount :  exchangeTransaction.totalthaiBahtAmount  ;

        console.log('updateRecieveRateId: ', updateRecieveRateId);
        console.log('updateExchangeRateId: ', updateExchangeRateId);

        const shiftId = exchangeTransaction.shiftId ;

        const promiseGetReceivedStock =  this.getStock(shiftId  , updateRecieveRateId, manager) ; 
        const promiseGetExchangedStock = this.getStock(shiftId  , updateExchangeRateId, manager) ;

        const [receivedStock, exchangedStock] = await Promise.all([promiseGetReceivedStock, promiseGetExchangedStock]);

        if(!receivedStock || !exchangedStock) {
            this.log(user, 'CANCEL_EXCHANGE_TRANSACTION_FAILED', `Failed cause cannot find stock to update for cancelling exchange transaction with id ${exchangeTransaction.id}.`, manager);
            throw new NotFoundException(`Failed cause cannot find stock to update for cancelling exchange transaction with id ${exchangeTransaction.id}.`);
        }

        const isExchangeOverBalance = !this.checkBalance(exchangedStock , updateExchangeAmount) ;
        if(isExchangeOverBalance) {
            this.log(user, 'CANCEL_EXCHANGE_TRANSACTION_FAILED', `Failed cause the exchange amount ${updateExchangeAmount} exceeds the available balance ${exchangedStock?.total_balance} for shift ${shiftId} and exchange rate ${updateExchangeRateId}.`, manager);
            throw new BadRequestException(`Failed cause the exchange amount ${updateExchangeAmount} exceeds the available balance ${exchangedStock?.total_balance} for shift ${shiftId} and exchange rate ${(await this.exchangeRatesService.findById(updateExchangeRateId as string)).name}.`);
     }

        const updateReceiveQuery = await this.updateTotalReceiveForCancel(shiftId , updateRecieveRateId , updateRecieveAmount , manager) ;
        if(updateReceiveQuery.affected === 0) {
            this.log(user, 'CANCEL_EXCHANGE_TRANSACTION_FAILED', `Failed cause cannot find shift ${shiftId} and exchangerateId  ${updateRecieveRateId} to update in stock.`, manager);
            throw new BadRequestException(`Failed cause cannot find shift ${shiftId} and exchangerateId  ${updateRecieveRateId} to update in stock.`);
        }

        const updateExchangeQuery = await this.updateTotalExchangedForCancel(shiftId , updateExchangeRateId , updateExchangeAmount , manager) ;
        if(updateExchangeQuery.affected === 0) {
            this.log(user, 'CANCEL_EXCHANGE_TRANSACTION_FAILED', `Failed cause cannot find shift ${shiftId} and exchangerateId  ${updateExchangeRateId} to update in stock.`, manager);
            throw new BadRequestException(`Failed cause cannot find shift ${shiftId} and exchangerateId  ${updateExchangeRateId} to update in stock.`);
        }

    }

    async updateStockByTransferTransaction( user: any , updateStockDto: UpdateStockByTransferTransactionDto , manager: EntityManager ) {
        const isSenderExist = updateStockDto.sender ? true : false ;
        const isReceiverExist = updateStockDto.receiver ? true : false ;
        const promiseSenderShift = isSenderExist ? this.shiftsService.getLastShiftByBoothId(updateStockDto.sender ?? undefined) : Promise.resolve(null) ;
        const promiseReceiverShift = isReceiverExist ? this.shiftsService.getLastShiftByBoothId(updateStockDto.receiver ?? undefined) : Promise.resolve(null) ;

        // ดึงข้อมูล shift ของ sender และ receiver พร้อมกันเพื่อเพิ่มประสิทธิภาพ
        const [senderShift, receiverShift] = await Promise.all([promiseSenderShift, promiseReceiverShift]);

        // ห้ามเป็น null ทั้งคู่ เพราะถ้าไม่มี shift ของฝ่ายใดฝ่ายหนึ่งแปลว่าไม่สามารถทำธุรกรรมได้
        if (!isSenderExist && !isReceiverExist) {
            this.log(user, 'CREATE_TRANSFER_TRANSACTION_FAILED', `Failed cause both sender and receiver are not provided.`, manager);
            throw new BadRequestException(`Failed cause both sender and receiver are not provided.`);
        }


        //กรณี BtoCenter จะเอาออกจากสต็อกของสาขาแล้วไปเข้าสต็อกกลาง จะเป็นค่าnull
        if(isSenderExist == true && isReceiverExist == false) {
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
            return await this.updateTotalExchanged(senderShift?.id , updateStockDto.exchangeRateId , updateStockDto.transferAmount , manager) ;
        }


        // กรณี BtoB จะเอาออกจากสต็อกของสาขาแล้วไปเข้าสต็อกของอีกสาขาหนึ่ง
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

        // ถ้ามี receiver ให้ทำการอัพเดตสต็อกของ receiver ด้วย ไม่ว่าจะเป็นกรณี BtoB หรือ CenterToB
        const stockReceiver = await this.getStock(receiverShift?.id , updateStockDto.exchangeRateId) ;
        if(!stockReceiver) {
            const savedStock = await this.create(receiverShift?.id , updateStockDto.exchangeRateId , manager) ;
            if(!savedStock) {
                this.log(user, 'CREATE_TRANSFER_TRANSACTION_FAILED', `Failed to create stock for receiver's shift ${receiverShift?.id} and exchange rate ${updateStockDto.exchangeRateId}`, manager);
                throw new InternalServerErrorException(`Failed to create stock for receiver's shift ${receiverShift?.id} and exchange rate ${updateStockDto.exchangeRateId}`);
            }
        }
        return await this.updateTotalReceive(receiverShift?.id , updateStockDto.exchangeRateId , updateStockDto.transferAmount , manager) ;
    }

    async updateTotalReceive(shiftId : string | undefined , updateRecieveRateId : string | undefined , updateRecieveAmount : number , manager: EntityManager) {
        const stockRepo = manager.getRepository(Stock) ;
        const updateQuery =  await stockRepo.update({ shiftId: shiftId , exchangeRateId : updateRecieveRateId } , { total_received : () => `total_received + ${updateRecieveAmount}` , total_balance : () => `total_balance + ${updateRecieveAmount}` }) ;
        return updateQuery;
    }

     async updateTotalReceiveForCancel(shiftId : string | undefined , updateRecieveRateId : string | undefined , updateRecieveAmount : number , manager: EntityManager) {
        const stockRepo = manager.getRepository(Stock) ;
        const updateQuery =  await stockRepo.update({ shiftId: shiftId , exchangeRateId : updateRecieveRateId } , { total_exchanged : () => `total_exchanged - ${updateRecieveAmount}` , total_balance : () => `total_balance + ${updateRecieveAmount}` }) ;
        return updateQuery;
    }


    async updateTotalExchanged(shiftId : string | undefined , updateExchangeRateId : string | undefined , updateExchangeAmount : number , manager: EntityManager) {
        const stockRepo = manager.getRepository(Stock) ;
        const updateQuery =  await stockRepo.update({ shiftId: shiftId , exchangeRateId : updateExchangeRateId } , { total_exchanged : () => `total_exchanged + ${updateExchangeAmount}` , total_balance : () => `total_balance - ${updateExchangeAmount}` }) ;
        return updateQuery;
    }

    
    async updateTotalExchangedForCancel(shiftId : string | undefined , updateExchangeRateId : string | undefined , updateExchangeAmount : number , manager: EntityManager) {
        const stockRepo = manager.getRepository(Stock) ;
        const updateQuery =  await stockRepo.update({ shiftId: shiftId , exchangeRateId : updateExchangeRateId } , { total_received : () => `total_received - ${updateExchangeAmount}` , total_balance : () => `total_balance - ${updateExchangeAmount}` }) ;
        return updateQuery;
    }

    
async updateStockByTransferTransactionForCancel( user: any , updateStockDto: UpdateStockByTransferTransactionForCancel , manager: EntityManager ) {
        const isSenderExist = updateStockDto.sender_shift ? true : false ;
        const isReceiverExist = updateStockDto.receiver_shift ? true : false ;
        const promiseSenderShift = isSenderExist ? this.shiftsService.getShiftById(updateStockDto?.sender_shift ?? undefined) : Promise.resolve(null) ;
        const promiseReceiverShift = isReceiverExist ? this.shiftsService.getShiftById(updateStockDto?.receiver_shift ?? undefined) : Promise.resolve(null) ;

        // ดึงข้อมูล shift ของ sender และ receiver พร้อมกันเพื่อเพิ่มประสิทธิภาพ
        const [senderShift, receiverShift] = await Promise.all([promiseSenderShift, promiseReceiverShift]);

        // ห้ามเป็น null ทั้งคู่ เพราะถ้าไม่มี shift ของฝ่ายใดฝ่ายหนึ่งแปลว่าไม่สามารถทำธุรกรรมได้
        if (!isSenderExist && !isReceiverExist) {
            this.log(user, 'CREATE_TRANSFER_TRANSACTION_FAILED', `Failed cause both sender and receiver are not provided.`, manager);
            throw new BadRequestException(`Failed cause both sender and receiver are not provided.`);
        }


        //กรณี BtoCenter จะเอาออกจากสต็อกของสาขาแล้วไปเข้าสต็อกกลาง จะเป็นค่าnull
        if(isSenderExist == true && isReceiverExist == false) {
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
            return await this.updateTotalExchanged(senderShift?.id , updateStockDto.exchangeRateId , updateStockDto.transferAmount , manager) ;
        }


        // กรณี BtoB จะเอาออกจากสต็อกของสาขาแล้วไปเข้าสต็อกของอีกสาขาหนึ่ง
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

        // ถ้ามี receiver ให้ทำการอัพเดตสต็อกของ receiver ด้วย ไม่ว่าจะเป็นกรณี BtoB หรือ CenterToB
        const stockReceiver = await this.getStock(receiverShift?.id , updateStockDto.exchangeRateId) ;
        if(!stockReceiver) {
            const savedStock = await this.create(receiverShift?.id , updateStockDto.exchangeRateId , manager) ;
            if(!savedStock) {
                this.log(user, 'CREATE_TRANSFER_TRANSACTION_FAILED', `Failed to create stock for receiver's shift ${receiverShift?.id} and exchange rate ${updateStockDto.exchangeRateId}`, manager);
                throw new InternalServerErrorException(`Failed to create stock for receiver's shift ${receiverShift?.id} and exchange rate ${updateStockDto.exchangeRateId}`);
            }
        }
        return await this.updateTotalReceive(receiverShift?.id , updateStockDto.exchangeRateId , updateStockDto.transferAmount , manager) ;
    }



}