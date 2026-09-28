import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Transaction } from './transaction.entity';
import { ClicksService } from '../clicks/clicks.service';
import { PriceCalculationService } from '../price-calculation/price-calculation.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly clicksService: ClicksService,
    private readonly priceService: PriceCalculationService,
  ) {}

  async registerTransaction(postback: any) {
    const { click_id, order_amount, commission_received } = postback;

    const click = await this.clicksService.findByClickId(click_id);
    if (!click) throw new Error('Click not found');

    const offer = click.offer;
    const user = click.user;
    const seller = click.seller;

    const calc = await this.priceService.calculateFinalPrice(user.id, offer);

    const tx = this.txRepo.create({
      click,
      user,
      offer,
      seller,
      order_amount,
      commission_received,
      cashback_amount: calc.cashback_amount,
      ad_bonus_amount: calc.ad_bonus_amount,
      research_bonus_amount: calc.research_bonus_amount,
      final_price: calc.final_price,
      status: 'confirmed',
    });

    return this.txRepo.save(tx);
  }

  getUserTransactions(userId: number) {
    return this.txRepo.find({
      where: { user: { id: userId } },
      relations: { offer: true, seller: true },
      order: { created_at: 'DESC' },
    });
  }
}
