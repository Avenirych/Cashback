import { Injectable } from '@nestjs/common';
import { Offer } from '../products/offer.entity';
import { BonusService } from '../bonus/bonus.service';

@Injectable()
export class PriceCalculationService {
  constructor(private readonly bonusService: BonusService) {}

  async calculateFinalPrice(userId: number, offer: Offer, promoDiscount = 0) {
    const settings = await this.bonusService.getSettings(userId);
    const sources = await this.bonusService.getSources(userId);

    const latestSource = sources[0] || {
      ad_earnings: 0,
      research_referral_cashback: 0,
    };

    const cashbackAmount = offer.price * offer.cashback_rate_percent;

    const adBonusAmount =
      latestSource.ad_earnings * (settings?.ad_bonus_percent || 0);

    const researchBonusAmount =
      latestSource.research_referral_cashback *
      (settings?.research_bonus_percent || 0);

    const finalPrice =
      offer.price -
      cashbackAmount -
      adBonusAmount -
      researchBonusAmount -
      offer.seller_discount -
      promoDiscount;

    return {
      base_price: offer.price,
      cashback_amount: cashbackAmount,
      ad_bonus_amount: adBonusAmount,
      research_bonus_amount: researchBonusAmount,
      seller_discount: offer.seller_discount,
      promo_discount: promoDiscount,
      final_price: Number(finalPrice.toFixed(2)),
    };
  }
}
