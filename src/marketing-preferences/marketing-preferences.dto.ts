import { BadRequestException } from '@nestjs/common';
import type { MarketingPreferences } from './marketing-preferences.entity';

export interface UpdateMarketingPreferences {
  specialOffers?: boolean;
  partnerRecommendations?: boolean;
  smsMarketing?: boolean;
}
export interface MarketingPreferencesResponse {
  id: number | null;
  userId: number;
  accountUpdates: boolean;
  specialOffers: boolean;
  partnerRecommendations: boolean;
  smsMarketing: boolean;
  smsMarketingGrantedAt: Date | null;
  smsMarketingRevokedAt: Date | null;
  smsMarketingConsentVersion: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
export function assertPreferencesUserId(id: number): void {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    throw new BadRequestException('Invalid user ID');
  }
}
export function parseMarketingPreferences(body: unknown): UpdateMarketingPreferences {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(body))) {
    throw new BadRequestException('Expected a preferences object');
  }
  const parsed: UpdateMarketingPreferences = {};
  for (const key of Reflect.ownKeys(body)) {
    if (key !== 'specialOffers' && key !== 'partnerRecommendations' && key !== 'smsMarketing') {
      throw new BadRequestException('Only marketing preference flags may be updated');
    }
    const value = (body as Record<string, unknown>)[key];
    if (typeof value !== 'boolean') throw new BadRequestException('Preference flags must be boolean');
    parsed[key] = value;
  }
  return parsed;
}
export function preferencesResponse(userId: number, prefs?: MarketingPreferences): MarketingPreferencesResponse {
  return prefs ? {
    id: prefs.id, userId: prefs.userId, accountUpdates: prefs.accountUpdates,
    specialOffers: prefs.specialOffers, partnerRecommendations: prefs.partnerRecommendations,
    smsMarketing: prefs.smsMarketing ?? false,
    smsMarketingGrantedAt: prefs.smsMarketingGrantedAt ?? null,
    smsMarketingRevokedAt: prefs.smsMarketingRevokedAt ?? null,
    smsMarketingConsentVersion: prefs.smsMarketingConsentVersion ?? null,
    createdAt: prefs.createdAt, updatedAt: prefs.updatedAt,
  } : {
    id: null, userId, accountUpdates: true, specialOffers: false,
    partnerRecommendations: false, createdAt: null, updatedAt: null,
    smsMarketing: false, smsMarketingGrantedAt: null,
    smsMarketingRevokedAt: null, smsMarketingConsentVersion: null,
  };
}
