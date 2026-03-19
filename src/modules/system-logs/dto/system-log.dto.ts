import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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