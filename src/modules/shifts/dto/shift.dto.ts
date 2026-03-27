import { IsString, IsNotEmpty, IsOptional, IsDateString , IsDate } from 'class-validator';
import { Type } from 'class-transformer';


export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  boothId: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class QueryDateDto {
  @IsDate() 
  @Type(()=>Date)
  @IsNotEmpty()
  startDate: Date ; 

  @IsDate() 
  @Type(()=>Date)
  @IsNotEmpty()
  endDate: Date ; 

}