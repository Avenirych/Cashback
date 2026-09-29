import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BonusTransfer } from './bonus-transfer.entity';
import { UsersService } from '../users/users.service';
import { BalanceService } from '../balance/balance.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BonusTransferService {
  constructor(
    @InjectRepository(BonusTransfer)
    private readonly transferRepo: Repository<BonusTransfer>,
    private readonly usersService: UsersService,
    private readonly balanceService: BalanceService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async transfer(senderId: number, receiverId: number, amount: number) {
    const sender = await this.usersService.getById(senderId);
    if (!sender) throw new BadRequestException('Sender not found');

    const receiver = await this.usersService.getById(receiverId);
    if (!receiver) throw new BadRequestException('Receiver not found');

    if (Number(sender.balance) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    // списываем у отправителя
    await this.balanceService.addOperation(
      senderId,
      'withdraw',
      amount,
      `Bonus sent to user ${receiverId}`,
    );

    // начисляем получателю
    await this.balanceService.addOperation(
      receiverId,
      'bonus',
      amount,
      `Bonus received from user ${senderId}`,
    );

    const transfer = this.transferRepo.create({
      sender: { id: sender.id },
      receiver: { id: receiver.id },
      amount,
    });

    await this.transferRepo.save(transfer);

    // уведомления
    await this.notificationsService.send(
      receiverId,
      'bonus',
      'Bonus received',
      `You received £${amount} bonus from user ${senderId}`,
    );

    await this.notificationsService.send(
      senderId,
      'bonus',
      'Bonus sent',
      `You sent £${amount} bonus to user ${receiverId}`,
    );

    return transfer;
  }
}
