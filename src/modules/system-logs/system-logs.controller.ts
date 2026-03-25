import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SystemLogsService } from './system-logs.service';
import { QueryDateDto } from './dto/system-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Cron } from '@nestjs/schedule';

@Controller('system-logs')
export class SystemLogsController {
  constructor(private readonly systemLogsService: SystemLogsService) {}

  @Cron('0 0 3 * * 0') // รันทุกวันอาทิตย์ เวลา 03:00 น.
  handleCron() {
    this.systemLogsService.cleanupOldLogs();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER', 'ADMIN')
  @Get()
  findAll(@CurrentUser() currentUser: any, @Query() query: QueryDateDto) {
    return this.systemLogsService.getAllByDate(currentUser, query);
  }
}
