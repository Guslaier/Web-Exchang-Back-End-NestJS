import { IsNumber , IsNotEmpty , Min , IsObject , ValidateNested, IsUUID} from 'class-validator' ; 
import { Type } from 'class-transformer';
import type  { ShiftData } from './../../../types/index' ;  
import { CreateCashCountDto } from './../../cash-counts/dto/cash-count.dto' ; 


export class PutShiftParam implements Pick<ShiftData , 'id'> {
    @IsUUID() 
    @IsNotEmpty()
    id : string ; 
}

export class PutShiftBody implements Pick<ShiftData , 'balanceCheck' | 'cashAdvance'> {
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