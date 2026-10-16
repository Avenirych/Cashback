export interface MarketingPreferencesData {
  userId: number;
  specialOffers: boolean;
  partnerRecommendations: boolean;
  accountUpdates: boolean;
  smsMarketing: boolean;
  smsMarketingGrantedAt: string | null;
  smsMarketingRevokedAt: string | null;
  smsMarketingConsentVersion: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MarketingPreferencesFormData {
  specialOffers: boolean;
  partnerRecommendations: boolean;
  smsMarketing?: boolean;
}
