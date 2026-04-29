import { Controller, Get, Post, Body, Param, Patch, BadRequestException, Header } from '@nestjs/common';
import { ExclusiveExchangeRatesService } from './exclusive-exchange-rates.service';
import { CreateExclusiveExchangeRateDto } from './dto/exclusive-exchange-rate.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { re } from 'mathjs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {ConfirmReviewDto} from './dto/exclusive-exchange-rate.dto';

 
@Controller('exclusive-exchange-rates')
export class ExclusiveExchangeRatesController {
  constructor(private readonly exclusiveExchangeRatesService: ExclusiveExchangeRatesService) {}

  @Patch(':id')
  async updateExclusiveRate(
    @Param('id') id: number,
    @Body() updateDto: Partial<CreateExclusiveExchangeRateDto>,
  ) {
    return await this.exclusiveExchangeRatesService.update(null, id.toString(), updateDto as any);
  }

  @Get('booth/:boothId')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getByBooth(@Param('boothId') boothId: string) {
    return await this.exclusiveExchangeRatesService.findByBooth(boothId);
  }

  @Get('exchange-rate/:exchangeRateId')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getByExchangeRate(@Param('exchangeRateId') exchangeRateId: string) {
    return await this.exclusiveExchangeRatesService.findByExchangeRate(exchangeRateId);
  }

  @Get('currency/:currencyCode')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getByCurrency(@Param('currencyCode') currencyCode: string) {
    return await this.exclusiveExchangeRatesService.findByCurrency(currencyCode);
  }

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getAll() {
    return await this.exclusiveExchangeRatesService.findAll();
  }

  @Get('pending-reviews')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getPendingReviews() {
    return await this.exclusiveExchangeRatesService.findPendingReviews();
  }

  
  @Post('confirm-review')
  async confirmReview(@CurrentUser() user: any, @Body() dto: ConfirmReviewDto) {
    if (!dto.ids || !Array.isArray(dto.ids)) {
    throw new BadRequestException('รูปแบบข้อมูลไม่ถูกต้อง ต้องส่ง ids เป็น Array');
  }

    return await this.exclusiveExchangeRatesService.bulk_review(user, dto.ids);
  }

  @Post('sync-and-clamp')
  async syncAndClamp(@Body("excid") excid:string,@Body("masterBuy") masterBuy:number,@Body("masterSell") masterSell:number) {
    return await this.exclusiveExchangeRatesService.syncAndClampRate(excid, masterBuy, masterSell);
  }
  

  @Get(':id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async getById(@Param('id') id: string) {
    return await this.exclusiveExchangeRatesService.findById(id);
  }
}