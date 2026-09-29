import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Transaction } from './transaction.entity';
import { ClicksService } from '../clicks/clicks.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly clicksService: ClicksService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createTransaction(click_id: string, order_amount: number) {
    const click = await this.clicksService.findByClickId(click_id);
    if (!click) throw new BadRequestException('Click not found');

    const user = click.user;
    const offer = click.offer;
    const seller = click.seller;

    // ✔ единственное реальное поле для расчётов — cashback_rate_percent
    const cashback_amount =
      Number(order_amount) * Number(offer.cashback_rate_percent / 100);

    // ✔ комиссии нет → ставим 0
    const commission_received = 0;

    // ✔ бонусов нет → ставим 0
    const ad_bonus_amount = 0;
    const research_bonus_amount = 0;

    const final_price = Number(order_amount) - cashback_amount;

    const transaction = this.transactionRepo.create({
      click,
      user,
      offer,
      seller,
      order_amount,
      commission_received,
      cashback_amount,
      ad_bonus_amount,
      research_bonus_amount,
      final_price,
      status: 'confirmed',
    });

    const saved = await this.transactionRepo.save(transaction);

    // 🔥 уведомление
    await this.notificationsService.send(
      user.id,
      'transaction',
      'Purchase confirmed',
      `Your purchase for £${order_amount} has been confirmed`,
    );

    return saved;
  }

  getUserTransactions(userId: number) {
    return this.transactionRepo.find({
      where: { user: { id: userId } },
      relations: {
        offer: true,
        seller: true,
      },
      order: { created_at: 'DESC' },
    });
  }
}
