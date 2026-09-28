import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { BalanceService } from './balance.service';

@Controller('balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Post(':userId')
  addOperation(
    @Param('userId') userId: number,
    @Body('type') type: string,
    @Body('amount') amount: number,
    @Body('description') description?: string,
  ) {
    return this.balanceService.addOperation(userId, type, amount, description);
  }

  @Get(':userId')
  getHistory(@Param('userId') userId: number) {
    return this.balanceService.getUserBalanceHistory(userId);
  }
}
