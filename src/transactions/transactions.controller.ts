import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly txService: TransactionsService) {}

  @Post('postback')
  register(@Body() body: any) {
    return this.txService.registerTransaction(body);
  }

  @Get(':userId')
  getUserTransactions(@Param('userId') userId: number) {
    return this.txService.getUserTransactions(userId);
  }
}
