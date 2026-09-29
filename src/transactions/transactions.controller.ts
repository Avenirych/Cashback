import { Controller, Post, Body } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly txService: TransactionsService) {}

  @Post()
  create(@Body() body: { click_id: string; order_amount: number }) {
    return this.txService.createTransaction(body.click_id, body.order_amount);
  }
}
