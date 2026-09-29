import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';

@Controller('withdrawal')
export class WithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  @Post(':userId')
  request(
    @Param('userId') userId: number,
    @Body('amount') amount: number,
    @Body('method') method: string,
    @Body('details') details: string,
  ) {
    return this.withdrawalService.requestWithdrawal(userId, amount, method, details);
  }

  @Post('approve/:id')
  approve(@Param('id') id: number) {
    return this.withdrawalService.approve(id);
  }

  @Post('reject/:id')
  reject(@Param('id') id: number) {
    return this.withdrawalService.reject(id);
  }

  @Get(':userId')
  getUserWithdrawals(@Param('userId') userId: number) {
    return this.withdrawalService.getUserWithdrawals(userId);
  }
}
