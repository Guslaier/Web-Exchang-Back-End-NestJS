import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsDecimal,
  
} from 'class-validator';
import { Type } from 'class-transformer';
import type { TransferTransactionData,TranSectionType,TranStatus, TransferTransactionType } from './../../../types';



export class CreateTransferTransactionDto implements Omit<TransferTransactionData, 'createdAt' | 'updatedAt' | 'id'> {

  @IsUUID()
  currencyCode: string;   // FK

  @IsString()
  @IsOptional()
  currencyName?: string;   // ชื่อสกุลเงิน

  @IsUUID()
  @IsNotEmpty()
  boothId: string;           // FK

  @IsUUID()
  @IsOptional()
  ShiftId?: string | null ;

  @IsNumber()
  @IsNotEmpty()
  amount: number;            // จำนวนเงิน

  @IsString()
  @IsNotEmpty()
  type: TransferTransactionType;     // ประเภทการโอน

  @IsUUID()
  @IsNotEmpty()
  refBoothId: string;        // ID บูธที่อ้างอิง

    @IsUUID()
  @IsOptional()
  refShiftId?: string | null | undefined;

  @IsString()
  @IsOptional()
  description?: string;      // รายละเอียด (ใส่ ? เพราะปกติมักจะเป็น optional)

  @IsUUID()
  @IsNotEmpty()
  userId: string;            // ผู้ทำรายการ

  @IsString()
  status: TranStatus;        // สถานะ (เช่น success, pending, cancel)

  @IsUUID()
  @IsOptional()
  shiftId?: string | null; // อนุญาตให้เป็น null ได้สำหรับบางประเภทของ transaction เช่น transfer ระหว่างบูธ
}

export class TransferBoothToBoothDto implements Omit<TransferTransactionData, 'userId'|'status' |'type'|'createdAt' | 'updatedAt' | 'id' > {
  @IsUUID()
  @IsNotEmpty()
  boothId: string;

  @IsUUID()
  @IsNotEmpty()
  refBoothId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;


  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsString()
  @IsOptional()
  type?: TransferTransactionType; // กำหนดเป็น optional และใช้ TransferTransactionType แทน TranSectionType เพราะเราต้องการระบุประเภทการโอนที่ชัดเจน เช่น 'TRANSFER_IN' หรือ 'TRANSFER_OUT'

  @IsString()
  @IsOptional()
  description?: string;


}

export class TransferCenterToBoothDto implements Omit<TransferTransactionData,'refBoothId' |'type'|'createdAt' | 'updatedAt' | 'id' > {
  @IsUUID()
  @IsNotEmpty()
  boothId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @IsString()
  @IsOptional()
  type?: TranSectionType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CashCountDataDto)
  cashCountData: CashCountDataDto[];

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsString()
  status: TranStatus;

}

export class CashCountDataDto {
  @IsNumber()
  denomination: number;

  @IsNumber()
  amount: number;
}

export class UpdateTransferTransactionDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class GetTransfersByBoothDto implements Pick<TransferTransactionData, 'boothId'> {
  @IsUUID()
  @IsNotEmpty()
  boothId: string;
}

export class GetCashInventoryDto {
  @IsUUID()
  @IsNotEmpty()
  booth_id: string;
}

export class GetTotalReceiveDto {
  @IsString()
  @IsNotEmpty()
  shift_id: string;
}