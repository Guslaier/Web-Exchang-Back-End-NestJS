import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { QueryDateDto, QueryShiftId, SummaryData } from './dto/shift.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UUID } from 'crypto';

@Controller('shifts')
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService , 
          
  ) 
  {}

  @UseGuards(JwtAuthGuard , RolesGuard) 
  @Roles("ADMIN" , "MANAGER" , "EMPLOYEE")
  @Get('summary')
  findShiftSummary(@CurrentUser() currentUser : any , @Query() query : QueryShiftId) {
    return this.shiftsService.getSummary(currentUser , query) ;
  }

  

  @UseGuards(JwtAuthGuard , RolesGuard) 
  @Roles("ADMIN" , "MANAGER")
  @Get('actives')
  findActivesShift(@Query() query : QueryDateDto) {
    return this.shiftsService.getActiveShifts(query) ;
  }

  @UseGuards(JwtAuthGuard , RolesGuard) 
  @Roles("ADMIN" , "MANAGER")
  @Get()
  findShifts(@Query() query : QueryDateDto) {
    return this.shiftsService.getShifts(query) ;
  }

  @UseGuards(JwtAuthGuard , RolesGuard) 
  @Roles("EMPLOYEE")
  @Post()
  open(@CurrentUser() currentUser : any) {
    return  this.shiftsService.openShift(currentUser) ; 
  }

  @UseGuards(JwtAuthGuard , RolesGuard) 
  @Roles("EMPLOYEE")
  @Put()
  close(@CurrentUser() currentUser : any) {
    return this.shiftsService.setStatusToCLose(currentUser) ; 
  }

  @UseGuards(JwtAuthGuard , RolesGuard) 
  @Roles("ADMIN" , "MANAGER")
  @Put('summarize/:id')
  summarize(@Param('id') id : string , @Body() summaryData : SummaryData , @CurrentUser() currentUser : any) {
    return this.shiftsService.setCloseDaily(id , summaryData , currentUser) ; 
  }
  

 
}