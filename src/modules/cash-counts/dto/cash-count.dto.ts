import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateCashCountDto {
  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;
}