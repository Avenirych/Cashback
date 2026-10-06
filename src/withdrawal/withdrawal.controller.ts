import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BonusEligibilityGuard } from '../onboarding/bonus-eligibility.guard';

@Controller('withdrawal')
@UseGuards(JwtAuthGuard, BonusEligibilityGuard)
export class WithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post(':userId')
  request(
    @Req() req: { user: { id: number } },
    @Body('amount') amount: unknown,
    @Body('requestId') requestId: unknown,
  ) {
    return this.withdrawalService.requestWithdrawal(req.user.id, amount, requestId);
  }

  @Get(':userId')
  getUserWithdrawals(@Req() req: { user: { id: number } }) {
    return this.withdrawalService.getUserWithdrawals(req.user.id);
  }
}
