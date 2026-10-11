import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingPreferences } from './marketing-preferences.entity';
import { MarketingPreferencesService } from './marketing-preferences.service';
import { MarketingPreferencesController } from './marketing-preferences.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MarketingPreferences])],
  providers: [MarketingPreferencesService],
  controllers: [MarketingPreferencesController],
  exports: [MarketingPreferencesService],
})
export class MarketingPreferencesModule {}