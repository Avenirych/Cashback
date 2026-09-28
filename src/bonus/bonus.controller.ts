import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BonusService } from './bonus.service';

@Controller('bonus')
export class BonusController {
  constructor(private readonly bonusService: BonusService) {}

  @Get(':userId/settings')
  getSettings(@Param('userId') userId: number) {
    return this.bonusService.getSettings(userId);
  }

  @Post(':userId/settings')
  updateSettings(@Param('userId') userId: number, @Body() body: any) {
    return this.bonusService.updateSettings(userId, body);
  }

  @Get(':userId/sources')
  getSources(@Param('userId') userId: number) {
    return this.bonusService.getSources(userId);
  }

  @Post(':userId/sources')
  addSources(@Param('userId') userId: number, @Body() body: any) {
    return this.bonusService.addSources(userId, body);
  }
}
