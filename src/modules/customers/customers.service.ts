import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { SystemLogsService } from './../system-logs/system-logs.service';
import { ShiftsService } from './../shifts/shifts.service';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { join } from 'path';
import { existsSync, createReadStream } from 'fs';
import * as mime from 'mime-types';

@Injectable()
export class CustomersService {
  constructor(
    private readonly systemLogsService: SystemLogsService,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly shiftsService: ShiftsService,
  ) {}

  private async log(
    user: any,
    action: string,
    details: string,
    manager?: EntityManager,
  ) {
    await this.systemLogsService.createLog(
      user,
      {
        userId: user?.id || null,
        action,
        details,
      },
      manager, // ส่งต่อ manager เพื่อให้อยู่ใน Transaction เดียวกัน
    );
  }

  async create(
    manager: EntityManager,
    exchangeTransactionId: string,
    passportNo: string,
    fullName: string,
    nationality: string,
    phoneNumber: string,
    hotelName: string,
    roomNumber: string,
    customer_img_filename: string,
  ) {
    try {
      const customerRepo = manager.getRepository(Customer);
      const newCustomer = customerRepo.create({
        transactionId: exchangeTransactionId,
        passportNo: passportNo,
        passportImg: customer_img_filename,
        fullName: fullName,
        nationality: nationality,
        phoneNumber: phoneNumber,
        hotelName: hotelName,
        roomNumber: roomNumber,
      });
      const customerResult = await customerRepo.save(newCustomer);
      await this.log(
        null,
        'CREATE_CUSTOMER_SUCCESS',
        `Created customer with passportNo: ${passportNo}`,
        manager,
      );
      return customerResult;
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      await this.log(
        null,
        'CREATE_CUSTOMER_FAILED',
        `Failed to create customer with passportNo: ${passportNo}. Error: ${err}`,
        manager,
      );
      throw new InternalServerErrorException('Failed to create customer');
    }
  }

  async findById(currentUser: any, id: string): Promise<Customer> {
    const isEmployee = currentUser.role === 'EMPLOYEE';

    if (isEmployee) {
      const activeShift = await this.shiftsService.getLastShiftByUserId(
        currentUser.id,
      );

      if (!activeShift) {
        throw new NotFoundException('Your active shift is not found.');
      }

      const customer = await this.customerRepository.findOne({
        relations: {
          transaction: true,
        },
        where: {
          id: id,
          transaction: {
            shiftId: activeShift.id,
          },
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found or not in your active shift.');
      }

      return customer;
    }

    const customer = await this.customerRepository.findOne({
      where: { id: id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return customer;
  }

  async getImg(currentUser: any, id: string): Promise<StreamableFile> {
    const customer = await this.customerRepository.findOne({
      relations: {
        transaction: true,
      },
      where: {
        id: id,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    const isEmployee = currentUser.role === 'EMPLOYEE';

    if (isEmployee) {
      const activeShift = await this.shiftsService.getLastShiftByUserId(
        currentUser.id,
      );

      if (!activeShift) {
        throw new NotFoundException('Your active shift is not found.');
      }

      if (customer.transaction?.shiftId !== activeShift.id) {
        throw new BadRequestException(
          'This customer is not in your active shift.',
        );
      }
    }

    const filePath = join('upload/customers', customer.passportImg);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Customer image not found.');
    }

    const file = createReadStream(filePath);
    const contentType = mime.lookup(customer.passportImg) || 'application/octet-stream';

    return new StreamableFile(file, { type: contentType });
  }
}
