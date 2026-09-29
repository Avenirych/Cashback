export interface SellerRating {
  rating: number;
}

export interface Seller {
  id: number;
  name: string;
  rating?: SellerRating;
}

export interface Product {
  id: number;
  title: string;
  description?: string;
  price: number;
  discount_percent: number;
  cashback_percent: number;
  created_at: string;
  brand?: string;
  seller?: Seller;
  best_offer_score?: number;
  best_offer_breakdown?: {
    rating_bonus: number;
    discount_bonus: number;
    cashback_bonus: number;
    price_penalty: number;
    final_score: number;
  };
  best_offer_visual?: {
    rating_bar: number;
    rating_color: string;
    discount_bar: number;
    discount_color: string;
    cashback_bar: number;
    cashback_color: string;
    price_bar: number;
    price_color: string;
    animation_delay: number;
    animation_duration: number;
  };
  best_offer_reason?: string[];
}
