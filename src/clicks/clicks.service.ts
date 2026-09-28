import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Click } from './click.entity';
import { Offer } from '../products/offer.entity';
import { Seller } from '../partners/seller.entity';

@Injectable()
export class ClicksService {
  constructor(
    @InjectRepository(Click)
    private readonly clickRepo: Repository<Click>,
  ) {}

  async registerClick(userId: number, offer: Offer) {
    const clickId = `clk_${Date.now()}_${userId}_${offer.id}`;

    const click = this.clickRepo.create({
      user: { id: userId },
      offer,
      seller: offer.seller as Seller,
      click_id: clickId,
    });

    const saved = await this.clickRepo.save(click);

    return {
      click_id: saved.click_id,
      redirect_url: offer.affiliate_link,
    };
  }

  async findByClickId(clickId: string) {
    return this.clickRepo.findOne({
      where: { click_id: clickId },
      relations: {
        user: true,
        offer: true,
        seller: true,
      },
    });
  }
}
