import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateShiftThaiCashReportDto {
  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @IsNumber()
  @IsNotEmpty()
  totalThaiCash: number;
}