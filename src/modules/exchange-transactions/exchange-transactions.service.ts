import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateExchangeTransactionDto , GetExchangeTransactionsFromShiftsDto } from './dto/exchange-transaction.dto';
import { ShiftsService } from './../../modules/shifts/shifts.service';
import { TransactionsService } from './../../modules/transactions/transactions.service';
import { ExchangeRatesService } from './../../modules/exchange-rates/exchange-rates.service';
import { SystemLogsService } from './../../modules/system-logs/system-logs.service';
import { CustomersService } from './../../modules/customers/customers.service';
import { CashCountsService } from './../../modules/cash-counts/cash-counts.service';
import { CreateCashCountDto } from './../../modules/cash-counts/dto/cash-count.dto';
import { CreateTransactionDto } from './../../modules/transactions/dto/transaction.dto';
import { InputValidator } from './helper/input-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository , DataSource , EntityManager} from 'typeorm';
import { ExchangeTransaction } from './entities/exchange-transaction.entity';
import { re } from 'mathjs';


@Injectable()
export class ExchangeTransactionsService {

    constructor(
        @Inject(ShiftsService)
        private readonly shiftsService: ShiftsService , 
        private readonly exchangeRateService : ExchangeRatesService ,
        private readonly customerService : CustomersService , 
        private readonly systemLogsService : SystemLogsService ,
        private readonly cashCountsService : CashCountsService ,
        private readonly inputValidator : InputValidator , 
        @InjectRepository(ExchangeTransaction)
        private readonly exchangeTransactionRepository : Repository<ExchangeTransaction> , 
        private readonly transactionsService : TransactionsService , 
        private readonly dataSource : DataSource ,  
    )   {

        }

     private async log(user: any, action: string, details: string, manager?: EntityManager) {
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

    async create(currentUser: any, body: CreateExchangeTransactionDto, customer_img ?: Express.Multer.File) {
        
        // validate input section
        
        const activeShift = await this.shiftsService.getActiveShiftByUserId(currentUser.id);
        if (!activeShift) {
            throw new BadRequestException('No active shift found for the user');
        }

        const exchangeRateId = await this.exchangeRateService.findById(body.exchangeRatesId);
        if (!exchangeRateId) {
            throw new BadRequestException('Exchange rate not found');
        }

        if (body.type !== 'BUY' && body.type !== 'SELL') {
            throw new BadRequestException('type must be either BUY or SELL');
        }

        if (body.type === 'SELL' && !body.calculateMethod) {
            throw new BadRequestException('calculateMethod is required for SELL transactions');
        }

        if (body.calculateMethod && body.calculateMethod !== 'Auto' && body.calculateMethod !== 'Negotiate') {
            throw new BadRequestException('calculateMethod must be either Auto or Negotiate');
        }

        const numberFields = [body.foreignAmount,body.oneThousandThaiAmount,body.fiveHundredThaiAmount , body.oneHundredThaiAmount, body.fiftyThaiAmount, body.twentyThaiAmount, body.tenThaiAmount, body.fiveThaiAmount, body.twoThaiAmount,  body.oneThaiAmount , body.thaiBahtAmount ];
        this.inputValidator.validateNumberFieldsPositive(numberFields);

        const cashAmounts = [body.oneThousandThaiAmount,body.fiveHundredThaiAmount , body.oneHundredThaiAmount, body.fiftyThaiAmount, body.twentyThaiAmount, body.tenThaiAmount, body.fiveThaiAmount, body.twoThaiAmount,  body.oneThaiAmount ];
        this.inputValidator.validateSumOfThaiBahtAmount(cashAmounts, body.thaiBahtAmount);

        const exchangeRate : number = body.foreignAmount / body.thaiBahtAmount;

        const { passportNo = "", fullName = "" , nationality = "" , phoneNumber = "" , hotelName = ""  , roomNumber = ""} = body ;
        const customerFields = [passportNo, fullName , nationality , phoneNumber , hotelName , roomNumber , customer_img?.filename ?? ""]; ;
        const insertCustomer = this.inputValidator.validateCustomerFieldFilled(customerFields);

        // insert section 
        try {
            this.dataSource.transaction(async (manager) => {
                const createTransactionDto : CreateTransactionDto = {
                    type : "EXCHANGE",  
                    shiftId : activeShift.id
                }
                const transaction = await this.transactionsService.create(manager , createTransactionDto);
                
                const customer = insertCustomer ? await this.customerService.create(manager, passportNo , fullName, nationality, phoneNumber, hotelName, roomNumber, customer_img?.filename ?? "") : null;
                
                // const cashCountForeignData : CreateCashCountDto = {
                //     transactionId : transaction.id ,
                //     currencyId : exchangeRateId.currencyId , 
                //     denominations : [...] ,
                //     amounts : [...]
                // }

                const cashCountTHBData : CreateCashCountDto = {
                    transactionId : transaction.id ,
                    denominations : [{ denomination: '1000' },{ denomination: '500' },{ denomination: '100' },{ denomination: '50' },{ denomination: '20' },{ denomination: '10' },{ denomination: '5' },{ denomination: '2' },{ denomination: '1' },] ,
                    amounts : [{ amount: body.oneThousandThaiAmount },{ amount: body.fiveHundredThaiAmount },{ amount: body.oneHundredThaiAmount },{ amount: body.fiftyThaiAmount },{ amount: body.twentyThaiAmount },{ amount: body.tenThaiAmount },{ amount: body.fiveThaiAmount },{ amount: body.twoThaiAmount },{ amount: body.oneThaiAmount },] 
                }

                await this.cashCountsService.create(currentUser, cashCountTHBData, manager);

                // await this.cashCountsService.create(currentUser, cashCountForeignData, manager); เผื่อจะทำระบบ cash count ของสกุลเงินต่างประเทศในอนาคต

                const exchangeTransRepo = manager.getRepository(ExchangeTransaction);

                const createdExchangeTran = exchangeTransRepo.create({
                    id : transaction.id , 
                    customerId : customer ? customer.id : null , 
                    exchangeRateId : body.exchangeRatesId , 
                    foreignCurrencyAmount : body.foreignAmount , 
                    totalthaiBahtAmount : body.thaiBahtAmount , 
                    exchangeRate : exchangeRate , 
                    isNegotiateRate : body.calculateMethod == "Negotiate"  ? true : false ,
                    note : body.note ? body.note : null ,
                    status : 'COMPLETED'
                });

                await exchangeTransRepo.save(createdExchangeTran);
                
                await this.log(currentUser, 'CREATE_EXCHANGE_TRANSACTION_SUCCESS', `Created exchange transaction with ID: ${createdExchangeTran.id}`, manager);


                if (body.type === 'SELL') {
                    await this.shiftsService.setTotalReceive(activeShift.boothId, body.thaiBahtAmount);
                }
                else {
                    await this.shiftsService.setTotalExchange(activeShift.boothId, body.thaiBahtAmount);
                }
            }); 
            return { message : "Exchange transaction created successfully" } ;
        }
        catch (error) {
            throw new InternalServerErrorException('Failed to create exchange transaction');
        }

    }
    
    
    async getTransactionsFromShift(currentUser : any , query : GetExchangeTransactionsFromShiftsDto | undefined) {
        let isEmployee = currentUser.role === 'EMPLOYEE' ? true : false    ;

        const shiftId = isEmployee ? (await this.shiftsService.getActiveShiftByUserId(currentUser.id))?.id : query?.shiftId;

        if (!shiftId) {
            throw new BadRequestException('No active shift found');
        }

        const exchangeTransactions = await this.exchangeTransactionRepository.find({
            relations : {
                transaction : true ,
                customer : true ,
             }
             , 
            where : {
                transaction : {
                     shiftId : shiftId
                }
            }
        });

        return exchangeTransactions
    }


}