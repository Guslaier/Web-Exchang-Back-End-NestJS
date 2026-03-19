import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class CreateShiftStocksReportDto {
  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @IsObject()
  @IsOptional()
  stockDetails?: any;
}