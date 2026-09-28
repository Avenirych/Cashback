import { Injectable } from '@nestjs/common';
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

  async updateSettings(userId: number, data: Partial<UserBonusSettings>) {
    let settings = await this.getSettings(userId);

    if (!settings) {
      settings = this.settingsRepo.create({
        user: { id: userId },
        ...data,
      });
    } else {
      Object.assign(settings, data);
    }

    return this.settingsRepo.save(settings);
  }

  getSources(userId: number) {
    return this.sourcesRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }

  async addSources(userId: number, data: Partial<UserBonusSources>) {
    const source = this.sourcesRepo.create({
      user: { id: userId },
      ...data,
    });

    return this.sourcesRepo.save(source);
  }
}
