import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  get(@Req() req: { user: { id: number } }) {
    return this.onboarding.get(req.user.id);
  }

  @Post()
  save(@Req() req: { user: { id: number } }, @Body() body: unknown) {
    return this.onboarding.save(req.user.id, body);
  }
}
