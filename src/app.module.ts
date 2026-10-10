import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TopicsModule } from './topics.module';
import { ForumModule } from './forum/forum.module';
import { AddForumUsers1791394800000 } from './migrations/1791394800000-AddForumUsers';
import { BonusModule } from './bonus/bonus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const password = config.get<string>('DB_PASSWORD');

        if (!password) {
          throw new Error('Set DB_PASSWORD in the backend .env file');
        }

        const port = Number(config.get<string>('DB_PORT') ?? '5432');

        if (!Number.isInteger(port) || port <= 0 || port > 65535) {
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
            AddForumUsers1791394800000,
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
  ],
})
export class AppModule {}