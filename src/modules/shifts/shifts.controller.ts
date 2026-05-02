import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { QueryDateDto, QueryShiftId, SummaryData , UserIdDto , ShiftIdDto , BoothIdDto , GetShiftBoothQuery} from './dto/shift.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('shifts')
export class ShiftsController {
  constructor(
    private readonly shiftsService: ShiftsService , 
          
  ) 
  {}

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
  @Roles("ADMIN" , "MANAGER")
  @Get('booth')
  getShiftsBooth(@Query()  query : GetShiftBoothQuery) {
    return this.shiftsService.getLastShiftByBoothId(query.id) ; 
  }

  @UseGuards(JwtAuthGuard , RolesGuard) 
  @Roles("EMPLOYEE" , "ADMIN" , "MANAGER")
  @Post()
  open(@CurrentUser() currentUser : any , @Body() body : BoothIdDto) { 
    return  this.shiftsService.openShift(currentUser , body) ; 
  }

  @UseGuards(JwtAuthGuard , RolesGuard) 
  @Roles("EMPLOYEE" , "ADMIN" , "MANAGER")
  @Put()
  close(@CurrentUser() currentUser : any , @Body() body : ShiftIdDto ) {
    return this.shiftsService.setStatusToCLose(currentUser , body) ; 
  }

  @UseGuards(JwtAuthGuard , RolesGuard) 
  @Roles("ADMIN" , "MANAGER")
  @Put('summarize/:id')
  summarize(@Param('id') id : string , @Body() summaryData : SummaryData , @CurrentUser() currentUser : any) {
    return this.shiftsService.setCloseDaily(id , summaryData , currentUser) ; 
  }
  

 
}