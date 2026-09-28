import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserBonusSettings } from './user-bonus-settings.entity';
import { UserBonusSources } from './user-bonus-sources.entity';
import { BonusService } from './bonus.service';
import { BonusController } from './bonus.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserBonusSettings, UserBonusSources])],
  providers: [BonusService],
  controllers: [BonusController],
  exports: [BonusService],
})
export class BonusModule {}
