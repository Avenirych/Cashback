import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { BonusService } from './bonus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BonusEligibilityGuard } from '../onboarding/bonus-eligibility.guard';

@Controller('bonus')
@UseGuards(JwtAuthGuard, BonusEligibilityGuard)
export class BonusController {
  constructor(private readonly bonusService: BonusService) {}

  @Get(':userId/settings')
  getSettings(@Req() req: { user: { id: number } }) {
    return this.bonusService.getSettings(req.user.id);
  }

  @Post(':userId/settings')
  updateSettings(@Req() req: { user: { id: number } }, @Body() body: unknown) {
    return this.bonusService.updateSettings(req.user.id, body);
  }

  @Get(':userId/sources')
  getSources(@Req() req: { user: { id: number } }) {
    return this.bonusService.getSources(req.user.id);
  }

  @Post(':userId/sources')
  addSources(@Req() req: { user: { id: number } }, @Body() body: unknown) {
    return this.bonusService.addSources(req.user.id, body);
  }
}
