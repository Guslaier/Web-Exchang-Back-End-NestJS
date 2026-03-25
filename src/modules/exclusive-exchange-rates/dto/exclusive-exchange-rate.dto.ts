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
export class ConfirmReviewDto {
  ids: string[]; // รับเป็น Array ของ string ไปเลย ง่ายกว่า
 }