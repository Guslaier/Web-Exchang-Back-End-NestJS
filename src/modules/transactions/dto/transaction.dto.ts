import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, IsUUID } from 'class-validator';
import type { TransactionData  , TranSectionType} from './../../../types';
import { Type } from 'class-transformer';

export class CreateTransactionDto implements Omit<TransactionData, 'createdAt' | 'updatedAt' | 'transactionNo'> {
  @IsIn(['TRANSFER', 'EXCHANGE'])
  @IsNotEmpty()
  type: TranSectionType;

  @IsUUID()
  @IsOptional()
  shiftId: string;
}