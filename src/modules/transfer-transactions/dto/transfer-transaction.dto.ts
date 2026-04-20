import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsDecimal,
  IsNumberString,
  Matches,
  
} from 'class-validator';
import { Type } from 'class-transformer';
import type { TransferTransactionData,TranSectionType,TranStatus, TransferTransactionType,CashCountData } from './../../../types';
import { CreateCashCountDto } from '../../cash-counts/dto/cash-count.dto';



export class CreateTransferTransactionDto implements Omit<TransferTransactionData,'refBoothId'| 'createdAt' | 'updatedAt' | 'id'> {
  @IsString()
  currencyCode: string;   // ชื่อสกุลเงิน

  @IsUUID()
  @IsOptional()
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
  @IsOptional()
  refBoothId?: string;        // ID บูธที่อ้างอิง

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCashCountTransferDto)
  cashCountData: CreateCashCountTransferDto[];

  @IsString()
  @IsOptional()
  type?: TransferTransactionType; // กำหนดเป็น optional และใช้ TransferTransactionType แทน TranSectionType เพราะเราต้องการระบุประเภทการโอนที่ชัดเจน เช่น 'TRANSFER_IN' หรือ 'TRANSFER_OUT'

  @IsString()
  @IsOptional()
  description?: string;


}

export class TransferCenterToBoothDto implements Omit<TransferTransactionData,'userId'|'refBoothId' |'type'|'createdAt' | 'updatedAt' | 'id' > {
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
  type: TransferTransactionType; // กำหนดเป็น optional และใช้ TransferTransactionType แทน TranSectionType เพราะเราต้องการระบุประเภทการโอนที่ชัดเจน เช่น 'TRANSFER_IN' หรือ 'TRANSFER_OUT'

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCashCountTransferDto)
  cashCountData: CreateCashCountTransferDto[];

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status: TranStatus;

}

export class CreateCashCountTransferDto implements Pick<CashCountData, 'denomination' | 'amount'> {
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @Matches(/^[0-9]+$/, {
    message: 'Denomination must contain only digits',
  })
  denomination: string;
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