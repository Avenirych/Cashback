import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('balance')
@UseGuards(JwtAuthGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':userId')
  getHistory(@Req() req: { user: { id: number } }) {
    return this.balanceService.getUserBalanceHistory(req.user.id);
  }
}
