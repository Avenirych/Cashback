export interface MarketingPreferencesData {
  userId: number;
  specialOffers: boolean;
  partnerRecommendations: boolean;
  accountUpdates: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingPreferencesFormData {
  specialOffers: boolean;
  partnerRecommendations: boolean;
}