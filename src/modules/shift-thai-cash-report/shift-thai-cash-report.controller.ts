import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ShiftThaiCashReportService } from './shift-thai-cash-report.service';
import { CreateShiftThaiCashReportDto } from './dto/shift-thai-cash-report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';


@Controller('shift-thai-cash-report')
export class ShiftThaiCashReportController {
  constructor(private readonly shiftThaiCashReportService: ShiftThaiCashReportService) {}

  @Post()
  create(@Body() createShiftThaiCashReportDto: CreateShiftThaiCashReportDto){
    return ;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return ;
  }

  @Get()
  findAll() {
    return ;
  }
}