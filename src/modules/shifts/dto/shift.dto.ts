import { IsString, IsNotEmpty, IsOptional, IsDateString , IsDate, IsNumber, IsUUID, min, Min, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type  {ShiftData , BoothData} from './../../../types/index' ;  
import { CreateCashCountDto } from './../../cash-counts/dto/cash-count.dto' ; 

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

export class SummaryData implements Pick<ShiftData , 'id' | 'balanceCheck' | 'cashAdvance' > {
  @IsUUID()
  @IsNotEmpty()
  id : string ; 

  @IsNumber()
  @IsNotEmpty()
  balanceCheck : number ; 

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  cashAdvance : number ; 

  @IsObject() 
  @ValidateNested()
  @Type(()=> CreateCashCountDto)
  cashCountData  : CreateCashCountDto  ;
}

export class QueryShiftId {
  @IsString()
  shiftId : string
}

export class UserIdDto  implements Pick<ShiftData , 'userId'> {
  @IsUUID() 
  @IsOptional() 
  userId: string; 

}

export class BoothIdDto implements Pick<ShiftData , 'boothId'>   {
  @IsUUID() 
  @IsNotEmpty()
  boothId: string; 
}

export class ShiftIdDto implements Pick<ShiftData , 'id'>   {
  @IsUUID() 
  @IsOptional() 
  id: string; 
}

export class GetShiftBoothQuery implements Pick<BoothData , 'id' > {
  @IsUUID()
  @IsNotEmpty()
  id : string ; 
}