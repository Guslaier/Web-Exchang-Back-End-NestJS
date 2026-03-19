import { IsString, IsNotEmpty, IsOptional, IsBoolean, Length } from 'class-validator';

export class CreateCurrencyDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}