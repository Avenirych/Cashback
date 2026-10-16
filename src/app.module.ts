import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateLocalDemoMailpit } from './mail/local-demo-mailpit';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TopicsModule } from './topics.module';
import { ForumModule } from './forum/forum.module';
import { BonusModule } from './bonus/bonus.module';
import { MarketingPreferencesModule } from './marketing-preferences/marketing-preferences.module';

import { AddUsersEmailUnique1791888000000 } from './migrations/1791888000000-AddUsersEmailUnique';
import { AddForumUsers1791394800000 } from './migrations/1791394800000-AddForumUsers';
import { AddMarketingPreferences1733928000000 } from './migrations/1733928000000-AddMarketingPreferences';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        validateLocalDemoMailpit(config);
        return config;
      },
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (config: ConfigService) => {
        const password = config.get<string>('DB_PASSWORD');

        if (!password) {
          throw new Error(
            'Set DB_PASSWORD in the backend .env file',
          );
        }

        const port = Number(
          config.get<string>('DB_PORT') ?? '5432',
        );

        if (
          !Number.isInteger(port) ||
          port <= 0 ||
          port > 65535
        ) {
          throw new Error('Invalid DB_PORT');
        }

        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST') ?? 'localhost',
          port,
          username: config.get<string>('DB_USER') ?? 'postgres',
          password,
          database: config.get<string>('DB_NAME') ?? 'cashback',

          autoLoadEntities: true,

          migrations: [
            AddMarketingPreferences1733928000000,
            AddForumUsers1791394800000,
            AddUsersEmailUnique1791888000000,
          ],

          migrationsRun: false,
          synchronize: false,
        };
      },
    }),

    UsersModule,
    AuthModule,
    TopicsModule,
    ForumModule,
    AnalyticsModule,
    BonusModule,
    MarketingPreferencesModule,
  ],
})
export class AppModule {}
