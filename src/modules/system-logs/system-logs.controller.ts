import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { SystemLogsService } from './system-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('system-logs')
export class SystemLogsController {
  constructor(private readonly systemLogsService: SystemLogsService) {}

  @Post()
  create(){
    return ;
  }

  @Get()
  findAll() {
    return ;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return ;
  }
}