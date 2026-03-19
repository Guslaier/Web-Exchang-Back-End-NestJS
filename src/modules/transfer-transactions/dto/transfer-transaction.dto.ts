import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateTransferTransactionDto {
  @IsString()
  @IsNotEmpty()
  fromBoothId: string;

  @IsString()
  @IsNotEmpty()
  toBoothId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsString()
  @IsOptional()
  status?: string;
}