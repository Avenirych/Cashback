import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketingPreferences } from './marketing-preferences.entity';

@Injectable()
export class MarketingPreferencesService {
  constructor(
    @InjectRepository(MarketingPreferences)
    private repo: Repository<MarketingPreferences>,
  ) {}

  async getPreferences(userId: number): Promise<MarketingPreferences> {
    let prefs = await this.repo.findOne({ where: { userId } });

    if (!prefs) {
      prefs = this.repo.create({
        userId,
        specialOffers: false,
        partnerRecommendations: false,
        accountUpdates: true,
      });
      await this.repo.save(prefs);
    }

    return prefs;
  }

  async updatePreferences(
    userId: number,
    data: {
      specialOffers?: boolean;
      partnerRecommendations?: boolean;
    },
  ): Promise<MarketingPreferences> {
    let prefs = await this.repo.findOne({ where: { userId } });

    if (!prefs) {
      prefs = this.repo.create({
        userId,
        accountUpdates: true,
      });
    }

    if (data.specialOffers !== undefined) {
      prefs.specialOffers = data.specialOffers;
    }
    if (data.partnerRecommendations !== undefined) {
      prefs.partnerRecommendations = data.partnerRecommendations;
    }

    prefs.updatedAt = new Date();
    return this.repo.save(prefs);
  }
}