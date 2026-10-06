import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserBonusSettings } from './user-bonus-settings.entity';
import { UserBonusSources } from './user-bonus-sources.entity';

@Injectable()
export class BonusService {
  constructor(
    @InjectRepository(UserBonusSettings)
    private readonly settingsRepo: Repository<UserBonusSettings>,
    @InjectRepository(UserBonusSources)
    private readonly sourcesRepo: Repository<UserBonusSources>,
  ) {}

  getSettings(userId: number) {
    return this.settingsRepo.findOne({
      where: { user: { id: userId } },
    });
  }

  async updateSettings(userId: number, data: unknown) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('Invalid bonus settings');
    }
    const input = data as Record<string, unknown>;
    if (
      Object.keys(input).some(
        (key) => !['ad_bonus_percent', 'research_bonus_percent'].includes(key),
      )
    ) {
      throw new BadRequestException('Invalid bonus settings');
    }
    const allowed: Partial<UserBonusSettings> = {};
    for (const key of ['ad_bonus_percent', 'research_bonus_percent'] as const) {
      if (input[key] !== undefined) {
        const value = input[key];
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 100
        ) {
          throw new BadRequestException(
            'Bonus percentages must be between 0 and 100',
          );
        }
        allowed[key] = value;
      }
    }
    let settings = await this.getSettings(userId);

    if (!settings) {
      settings = this.settingsRepo.create({
        user: { id: userId },
        ...allowed,
      });
    } else {
      Object.assign(settings, allowed);
    }

    return this.settingsRepo.save(settings);
  }

  getSources(userId: number) {
    return this.sourcesRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  async addSources(_userId: number, _data: unknown): Promise<never> {
    // This entity has only ownership and trusted earnings, no client-writable fields.
    throw new ForbiddenException(
      'Bonus earnings are recorded by trusted server processes only',
    );
  }
}
