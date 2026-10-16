import { BadRequestException, ConflictException, HttpException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { MarketingPreferences } from './marketing-preferences.entity';
import { assertPreferencesUserId, parseMarketingPreferences, preferencesResponse } from './marketing-preferences.dto';
import type { MarketingPreferencesResponse } from './marketing-preferences.dto';

// Identifies the consent purpose, not approval of a future frontend text.
export const SMS_MARKETING_CONSENT_VERSION = 'sms-marketing-v1';

@Injectable()
export class MarketingPreferencesService {
  constructor(
    @InjectRepository(MarketingPreferences)
    private readonly repo: Repository<MarketingPreferences>,
    private readonly dataSource: DataSource,
  ) {}

  private async findSingle(repo: Repository<MarketingPreferences>, userId: number) {
    const rows = await repo.find({ where: { userId }, order: { id: 'ASC' }, take: 2 });
    if (rows.length > 1) throw new ConflictException('Duplicate marketing preferences');
    return rows[0];
  }

  async getPreferences(userId: number): Promise<MarketingPreferencesResponse> {
    assertPreferencesUserId(userId);
    try {
      return preferencesResponse(userId, await this.findSingle(this.repo, userId));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Preferences service unavailable');
    }
  }

  async updatePreferences(userId: number, body: unknown): Promise<MarketingPreferencesResponse> {
    assertPreferencesUserId(userId);
    const data = parseMarketingPreferences(body);
    try {
      return await this.dataSource.transaction('READ COMMITTED', async manager => {
        // Serialize compatible preference writers and check existence atomically.
        const user = await manager.getRepository(User).findOne({
          where: { id: userId }, lock: { mode: 'pessimistic_write' },
          select: { id: true, phone_e164: true },
        });
        if (!user) throw new UnauthorizedException('Invalid authenticated identity');
        const repo = manager.getRepository(MarketingPreferences);
        let prefs = await this.findSingle(repo, userId);
        if (!prefs) prefs = repo.create({
          userId, accountUpdates: true, specialOffers: false, partnerRecommendations: false,
          smsMarketing: false, smsMarketingGrantedAt: null,
          smsMarketingRevokedAt: null, smsMarketingConsentVersion: null,
        });
        if (data.specialOffers !== undefined) prefs.specialOffers = data.specialOffers;
        if (data.partnerRecommendations !== undefined) prefs.partnerRecommendations = data.partnerRecommendations;
        if (data.smsMarketing === true && !user.phone_e164) {
          throw new BadRequestException('A phone number is required for SMS marketing consent');
        }
        if (data.smsMarketing !== undefined && data.smsMarketing !== (prefs.smsMarketing ?? false)) {
          prefs.smsMarketing = data.smsMarketing;
          if (data.smsMarketing) {
            prefs.smsMarketingGrantedAt = new Date();
            prefs.smsMarketingRevokedAt = null;
            prefs.smsMarketingConsentVersion = SMS_MARKETING_CONSENT_VERSION;
          } else {
            prefs.smsMarketingRevokedAt = new Date();
          }
        }
        prefs.updatedAt = new Date();
        return preferencesResponse(userId, await repo.save(prefs));
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Preferences service unavailable');
    }
  }
}
