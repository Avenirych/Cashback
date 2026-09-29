import { Controller, Post, Body } from '@nestjs/common';
import { BonusTransferService } from './bonus-transfer.service';

@Controller('bonus-transfer')
export class BonusTransferController {
  constructor(private readonly bonusTransferService: BonusTransferService) {}

  @Post()
  transfer(
    @Body('senderId') senderId: number,
    @Body('receiverId') receiverId: number,
    @Body('amount') amount: number,
  ) {
    return this.bonusTransferService.transfer(senderId, receiverId, amount);
  }
}
