import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserBonusSettings } from './user-bonus-settings.entity';
import { UserBonusSources } from './user-bonus-sources.entity';
import { BonusService } from './bonus.service';
import { BonusController } from './bonus.controller';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [
    OnboardingModule,
    TypeOrmModule.forFeature([UserBonusSettings, UserBonusSources]),
  ],
  providers: [BonusService],
  controllers: [BonusController],
  exports: [BonusService],
})
export class BonusModule {}
