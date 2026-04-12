import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsNotEmpty()
  passportNumber: string;
}

export class GetImgDto {
  @IsString()
  @IsNotEmpty()
  passportImg: string;
}