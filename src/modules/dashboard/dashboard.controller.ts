import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('summary')
  async getSummary(@Query('date') date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    return await this.dashboardService.getSummary(targetDate);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('metrics')
  async getMetrics(@Query('date') date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    return await this.dashboardService.getMetrics(targetDate);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('active-shifts')
  async getActiveShifts() {
    return await this.dashboardService.getActiveShifts();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('pending-alerts')
  async getPendingAlerts() {
    return await this.dashboardService.getPendingAlerts();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('analytics')
  async getAnalytics(@Query('date') date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    return await this.dashboardService.getAnalytics(targetDate);
  }
}
