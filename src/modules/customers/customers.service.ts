import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SystemLogsService } from './../system-logs/system-logs.service';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository} from 'typeorm';
import { Customer } from './entities/customer.entity';


@Injectable()
export class CustomersService {

    constructor(
        private readonly systemLogsService : SystemLogsService ,  
        @InjectRepository(Customer)  
        private readonly customerRepository : Repository<Customer>
    ) {

    }

    private async log(user: any, action: string, details: string, manager?: EntityManager) {
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

    async create(manager : EntityManager , passportNo: string , fullName: string  , nationality : string , phoneNumber : string , hotelName : string , roomNumber : string , customer_img_filename : string ) {
        try {
            const customerRepo = manager.getRepository(Customer);
            const newCustomer = customerRepo.create({
                passportNo : passportNo ,
                passportImg : customer_img_filename ,
                fullName : fullName ,
                nationality : nationality ,
                phoneNumber : phoneNumber ,
                hotelName : hotelName ,
                roomNumber : roomNumber ,
            }) ; 
            const customerResult = await customerRepo.save(newCustomer);
            await this.log(null, 'CREATE_CUSTOMER_SUCCESS', `Created customer with passportNo: ${passportNo}`, manager);
            return customerResult;
        }   
        catch (error) {
            const err = error instanceof Error ? error.message : String(error);
            await this.log(null, 'CREATE_CUSTOMER_FAILED', `Failed to create customer with passportNo: ${passportNo}. Error: ${err}`, manager);
            throw new  InternalServerErrorException('Failed to create customer'); 
        }
    }
    
}