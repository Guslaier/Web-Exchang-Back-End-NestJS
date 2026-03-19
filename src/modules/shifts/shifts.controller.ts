import { Controller, Post, Get, Put, Delete, Param, Body } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  create() {
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

  @Put(':id')
  update(@Param('id') id: string) {
    return ;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return ;
  }
}