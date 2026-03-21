import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { UpdateMode } from './dto/currency.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  // 1. ดึงข้อมูลสกุลเงินทั้งหมด (Select All)
  @Get()
  findAll() {
    return this.currenciesService.findAll();
  }

  // 2. สั่งอัปเดตข้อมูลจาก BOT API ด้วยตัวเอง (Manual Trigger Auto Update)
  @Post('sync-bot')
  async syncWithBot() {
    return await this.currenciesService.updateAutoRateAll();
  }

  // 3. เปลี่ยนโหมดการอัปเดต (AUTO <-> MANUAL)
  @Patch('mode/:id')
  async setMode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('mode') mode: UpdateMode,
  ) {
    return await this.currenciesService.setUpdateMode(id, mode);
  }

  @Patch('mode')
  async setModeAll(@Body('mode') mode: UpdateMode) {
    return await this.currenciesService.setUpdateModeAll(mode);
  }

  // 4. อัปเดตเรทแบบ Manual (Bulk Update - ส่งมาเป็น Array)
  @Patch('manual-update')
  async updateManualBulk(@CurrentUser() user: any,
    @Body('data') data: { id: string; buyRate: number; sellRate: number }[],
  ) {
    return await this.currenciesService.updateManualBulk(data);
  }

  // 5. ดึงข้อมูลรายตัว
  @Get('id/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.currenciesService.findOne(id);
  }
  @Get('code/:id')
  findOneByCode(@Param('id') id: string) {
    return this.currenciesService.findOneByCode(id);
  }
}