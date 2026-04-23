import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import {} from './../../../types/index' ;

export class UpdateStockByExchangeTransactionDto {
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @IsIn(['BUY', 'SELL'])
    @IsNotEmpty() 
    type: string;

    @IsUUID()
    @IsNotEmpty()
    foreignRateId: string;

    @IsNumber()
    @IsNotEmpty()
    foreingCurrencyAmount: number;

    @IsNumber()
    @IsNotEmpty()
    totalThaiBahtAmount: number;

}

export class UpdateStockByTransferTransactionDto {
    @IsUUID()
    @IsOptional()
    sender: string | null ;

    @IsUUID()
    @IsOptional()
    receiver: string | null;

    @IsUUID()
    @IsNotEmpty()
    exchangeRateId: string;

    @IsNumber()
    @IsNotEmpty()
    transferAmount: number;
}
export class UpdateStockByTransferTransactionForCancel {
    @IsUUID()
    @IsOptional()
    sender_shift: string | null ;

    @IsUUID()
    @IsOptional()
    receiver_shift: string | null;

    @IsUUID()
    @IsNotEmpty()
    exchangeRateId: string;

    @IsNumber()
    @IsNotEmpty()
    transferAmount: number;
}