import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { BoothsService } from './booths.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';

@Controller('booths')
export class BoothsController {
  constructor(private readonly boothsService: BoothsService) {}

  @Roles('MANAGER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  create() {
    return ;
  }

  @Get()
  findAll() {
    return ;
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return ;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  @Put(':id')
  update(@Param('id') id: number) {
    return ;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  @Delete(':id')
  remove(@Param('id') id: number) {
    return ;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER') 
  @Put(':id/status')
  setStatus(@Param('id') id: number) {
    return ;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYEE')
  @Post(':id/check-in')
  checkInUser(@Param('id') boothId: number) {
    return ;
  }

  @Get('current-id')
  
  getBoothId() {
    return ;
  }
}