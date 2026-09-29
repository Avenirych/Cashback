import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './user-settings.entity';

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
  ) {}

  async getSettings(userId: number) {
    return this.settingsRepo.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });
  }

  async updateSettings(userId: number, data: Partial<UserSettings>) {
    let settings = await this.getSettings(userId);

    if (!settings) {
      settings = this.settingsRepo.create({
        user: { id: userId } as any,
        ...data,
      });
    } else {
      Object.assign(settings, data);
    }

    return this.settingsRepo.save(settings);
  }

  async createDefaultSettings(userId: number) {
    const settings = this.settingsRepo.create({
      user: { id: userId } as any,
      bonus_enabled: true,
      notify_cashback: true,
      notify_bonus: true,
      notify_forum_replies: true,
      notify_new_offers: true,
      theme: 'light',
      currency: 'GBP',
      language: 'en',
      favorite_sellers: [],
      blocked_sellers: [],
    });

    return this.settingsRepo.save(settings);
  }
}
