import { Injectable } from '@nestjs/common';
import { Offer } from '../products/offer.entity';

@Injectable()
export class PriceCalculationService {
  calculateFinalPrice(offer: Offer): number {
    const cashbackAmount = offer.price * offer.cashback_rate_percent;
    const finalPrice =
      offer.price - offer.seller_discount - cashbackAmount;

    return Math.max(finalPrice, 0);
  }
}
