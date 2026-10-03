import { Controller, Get, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
  ) {}

  @Get('user/:userId')
  async getUserTransactions(
    @Param('userId') userId: string,
  ) {
    return this.transactionsService.getUserTransactions(
      Number(userId),
    );
  }
}