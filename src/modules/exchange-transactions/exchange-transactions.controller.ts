import { Controller, Post, Get, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, ParseFilePipe } from '@nestjs/common';
import { ExchangeTransactionsService } from './exchange-transactions.service';
import { CreateExchangeTransactionDto } from './dto/exchange-transaction.dto';
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

  @Get()
  findAll() {
    return ;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return ;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return ;
  }
}