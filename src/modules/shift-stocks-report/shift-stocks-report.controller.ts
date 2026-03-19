import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ShiftStocksReportService } from './shift-stocks-report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('shift-stocks-report')
export class ShiftStocksReportController {
  constructor(private readonly shiftStocksReportService: ShiftStocksReportService) {}

  @Post()
  create() {
    return ;
  }

  @Get(':shiftId')
  findOne(@Param('shiftId') shiftId: number) {
    return ;
  }
}