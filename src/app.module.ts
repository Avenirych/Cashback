import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TopicsModule } from './topics.module';
import { ForumModule } from './forum/forum.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'Lsa5295685',
      database: 'cashback',
      autoLoadEntities: true,
      synchronize: true,
    }),

    UsersModule,
    AuthModule,
    TopicsModule,
    ForumModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
