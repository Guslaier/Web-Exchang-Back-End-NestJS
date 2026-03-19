import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  
}