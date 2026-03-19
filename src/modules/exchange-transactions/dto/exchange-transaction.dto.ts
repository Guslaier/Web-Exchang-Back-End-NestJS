import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateExchangeTransactionDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsNumber()
  @IsNotEmpty()
  appliedRate: number;
}