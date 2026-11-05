import { APP_GUARD } from '@nestjs/core';
import { FinancialWriteGuard } from './financial-write-deny';
import { backendConfiguration } from './backend-configuration';
import { createBackendDataSource } from './backend-database';
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
  providers: [{ provide: APP_GUARD, useClass: FinancialWriteGuard }],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),

    TypeOrmModule.forRootAsync({
      useFactory: () => backendConfiguration().database,
      dataSourceFactory: createBackendDataSource,
    }),
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
