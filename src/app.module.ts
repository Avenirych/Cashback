import { localConfiguration } from './local-configuration';
import {ActivityModule} from './activity/activity.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TopicsModule } from './topics.module';
import { ForumModule } from './forum/forum.module';
import { MarketingPreferencesModule } from './marketing-preferences/marketing-preferences.module';
import { BonusModule } from './bonus/bonus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),

    TypeOrmModule.forRoot(localConfiguration().database),
    ActivityModule,

    UsersModule,
    AuthModule,
    TopicsModule,
    ForumModule,
    BonusModule,
    MarketingPreferencesModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
