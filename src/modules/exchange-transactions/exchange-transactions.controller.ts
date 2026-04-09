import { Controller, Post, Get, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, ParseFilePipe, Query } from '@nestjs/common';
import { ExchangeTransactionsService } from './exchange-transactions.service';
import { CreateExchangeTransactionDto , GetExchangeTransactionsFromShiftsDto  } from './dto/exchange-transaction.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { customerStorage } from '../../config/diskStorge';

@Controller('exchange-transactions')
export class ExchangeTransactionsController {
  constructor(private readonly exchangeTransactionsService: ExchangeTransactionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYEE') 
  @Post()
  @UseInterceptors(FileInterceptor('customer_img' ,{
    storage: customerStorage, 
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
      } else {
        cb(new Error('Only JPEG and PNG files are allowed'), false);
      }
    } ,    
  })) 
  create(@CurrentUser() currentUser : any , 
  @Body() createExchangeTransactionDto: CreateExchangeTransactionDto , 
  @UploadedFile() customer_img ?: Express.Multer.File) {
    return this.exchangeTransactionsService.create(currentUser, createExchangeTransactionDto, customer_img);
  }


  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYEE','ADMIN', 'MANAGER')
  @Get('/shift')
  getTransactionsFromShift(@CurrentUser() currentUser : any , @Query() query ?: GetExchangeTransactionsFromShiftsDto) {
    return this.exchangeTransactionsService.getTransactionsFromShift(currentUser , query); 
  }

}