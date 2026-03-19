import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateExclusiveExchangeRateDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsNumber()
  @IsNotEmpty()
  specialRate: number;
}