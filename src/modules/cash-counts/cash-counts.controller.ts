import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { CashCountsService } from './cash-counts.service';
import { CreateCashCountDto } from './dto/cash-count.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';


@Controller('cash-counts')
export class CashCountsController {
  constructor(private readonly cashCountsService: CashCountsService) {}

  @Post()
  create(@Body() createCashCountDto: CreateCashCountDto)  {
    return ;
  }

  @Get(':transactionNo')
  findOne(@Param('transactionNo') transactionNo: string){
    return ;
  }
}