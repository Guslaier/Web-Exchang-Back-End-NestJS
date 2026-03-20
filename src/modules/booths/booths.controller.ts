import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { BoothsService } from './booths.service';
import { CreateBoothDto, UpdateBoothDto } from './dto/booth.dto';

@Controller('booths')
export class BoothsController {
  constructor(private readonly boothsService: BoothsService) {}


  @Post('create')
  create(@Body() createBoothDto: CreateBoothDto) {
    return this.boothsService.create(createBoothDto);
  }

  @Get('find-all')
  findAll() {
    return this.boothsService.findAll();
  }

  @Get('find-one/:id')
  findOne(@Param('id') id: string) {
    return this.boothsService.findOne(id);
  }

  @Put('update/:id')
  update(@Param('id') id: string, @Body() updateBoothDto: UpdateBoothDto) {
    return this.boothsService.update(id, updateBoothDto);
  }


  @Delete('remove/:id')
  remove(@Param('id') id: string) {
    return this.boothsService.remove(id);
  }


  @Put('set-currentshift/:id')
  setCurrentShift(@Param('id') id: string, @Body('shiftId') shiftId: string) {
    return this.boothsService.setCurrentShift(id, shiftId);
  }

  @Put('set-status/:id')
  setStatus(@Param('id') id: string, @Body('isOpen') isOpen: boolean) {
    return this.boothsService.setStatus(id, isOpen);
  }

  @Put('set-deactive/:id')
  setDeActive(@Param('id') id: string) {
    return this.boothsService.setDeActive(id);
  }

  @Put('set-reactive/:id')
  setReActive(@Param('id') id: string) {
    return this.boothsService.setReActive(id);
  }

  @Get('find-by-shift/:shiftId')
  findBoothByShiftId(@Param('shiftId') shiftId: string) { 
    return this.boothsService.findBoothByShiftId(shiftId);
  } 
}