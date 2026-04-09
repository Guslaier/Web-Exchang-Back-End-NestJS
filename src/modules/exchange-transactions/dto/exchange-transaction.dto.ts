import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import type { ExchangeTransactionData , CustomerData , TranType} from './../../../types/index'

export class CreateExchangeTransactionDto implements Pick<ExchangeTransactionData , 'exchangeRatesId' | 'type' | 'foreignAmount' | 'thaiBahtAmount' | 'calculateMethod' |'note'> , Partial<CustomerData>  {
   
    @IsUUID()
    @IsNotEmpty()
    exchangeRatesId: string;

    @IsString()
    @IsNotEmpty()
    type: TranType;

    @IsNumber()
    @IsNotEmpty()
    foreignAmount: number;

    @IsNumber()
    @IsNotEmpty()
    oneThousandThaiAmount: number;

    @IsNumber()
    @IsNotEmpty()
    fiveHundredThaiAmount: number;

    @IsNumber()
    @IsNotEmpty()
    oneHundredThaiAmount: number;

    @IsNumber()
    @IsNotEmpty()
    fiftyThaiAmount: number;

    @IsNumber()
    @IsNotEmpty()
    twentyThaiAmount: number;

    @IsNumber()
    @IsNotEmpty()
    tenThaiAmount: number;

    @IsNumber()
    @IsNotEmpty()
    fiveThaiAmount: number;

    @IsNumber()
    @IsNotEmpty()
    twoThaiAmount: number;

    @IsNumber()
    @IsNotEmpty()
    oneThaiAmount: number;

     @IsNumber()
    @IsNotEmpty()
    thaiBahtAmount: number;

    @IsString()
    @IsNotEmpty()
    calculateMethod: string;

    @IsString()
    @IsOptional()
    note?: string;

    @IsOptional()
    customer_img ?: any;

    @IsString()
    @IsOptional()
    passportNo ?: string;

    @IsString()
    @IsOptional()
    fullName ?: string;

    @IsString()
    @IsOptional()
    nationality ?: string;

    @IsString()
    @IsOptional()
    phoneNumber ?: string;

    @IsString()
    @IsOptional()
    hotelName ?: string;

    @IsString()
    @IsOptional()
    roomNumber ?: string;
}

export class GetExchangeTransactionsFromShiftsDto {
    @IsUUID()
    @IsOptional()
    shiftId: string;
}