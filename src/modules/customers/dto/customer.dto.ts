import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { CustomerData } from './../../../types/index';

export class CreateCustomerDto implements Pick<
  CustomerData,
  'passportNumber' | 'firstName' | 'lastName'
> {
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

export class GetCustomerDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;
}

export class GetImgDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;
}
