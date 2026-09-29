import { Product } from '../product.entity';

export interface BestOfferProduct extends Product {
  best_offer_score: number;
  best_offer_breakdown: any;
  best_offer_visual: any;
  best_offer_reason: string[];
}
