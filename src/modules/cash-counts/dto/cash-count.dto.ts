import { IsString, IsNotEmpty, IsNumber, IsUUID, IsArray, ArrayNotEmpty, Validate, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import {CashCountData} from './../../../types/index'; ;

class DenominationDto implements Pick<CashCountData, 'denomination'> {
   @IsString()
   @IsNotEmpty()
   denomination: string; 
}

class AmountDto implements Pick<CashCountData, 'amount'>  {
    @IsNumber()
    @IsNotEmpty()
    amount: number; 
}

export class CreateCashCountDto implements Pick<CashCountData,   'transactionId'> { 
  @IsString()
  @IsNotEmpty()
  transactionId : string ;

  @IsUUID()
  @IsOptional()
  currencyId ?: string ;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => DenominationDto)
  denominations : DenominationDto[] ; 

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AmountDto)
  amounts : AmountDto[] ;
}

export class GetCashCountDto {
    @IsString()
    @IsNotEmpty()
    transactionId : string ;
}