import { IsString, IsNotEmpty, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSystemLogDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsOptional()
  details?: string;
}

export class QueryDate {
  @IsDate() 
  @Type(()=>Date)
  startDate: Date ; 

  @IsDate() 
  @Type(()=>Date)
  endDate: Date ; 

}