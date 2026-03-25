import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
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
  

 
}