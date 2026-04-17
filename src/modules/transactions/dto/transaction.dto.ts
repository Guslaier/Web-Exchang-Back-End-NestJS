import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn, IsUUID } from 'class-validator';
import type { TransactionData  , TranSectionType} from './../../../types';
import { Type } from 'class-transformer';

export class CreateTransactionDto implements Omit<TransactionData, 'shiftId'|'createdAt' | 'updatedAt' | 'transactionNo' | 'id'> {
  @IsIn(['TRANSFER', 'EXCHANGE'])
  @IsNotEmpty()
  type: TranSectionType;

  @IsUUID()
  @IsOptional()
  shiftId?: string | null; // อนุญาตให้เป็น null ได้สำหรับบางประเภทของ transaction เช่น transfer ระหว่างบูธ

}