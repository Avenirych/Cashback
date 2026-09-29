import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Observe
import { createObserveModule } from '@nestjs/observe';
export const { ObserveModule, ObserveInstrument } = createObserveModule();

// Основные модули
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { UserHistoryModule } from './user-history/user-history.module';
import { ModerationModule } from './moderation/moderation.module';
import { SellerRatingModule } from './seller-rating/seller-rating.module';

@Module({
  imports: [
    // .env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Observe
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY!,
      appSecret: process.env.OBSERVE_APP_SECRET!,
      serviceId: 'cashback-plus-backend',
    }),

    // TypeORM
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
    }),

    // Модули проекта
    UsersModule,
    AuthModule,
    UserSettingsModule,
    UserHistoryModule,
    ModerationModule,
    SellerRatingModule,
  ],
})
export class AppModule {}
