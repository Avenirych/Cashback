// cashback+/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// твои модули
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
// добавь сюда остальные, которые у тебя есть

// модуль аналитики
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'mysql', // или postgres — как у тебя
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
    }),

    UsersModule,
    AuthModule,

    AnalyticsModule,
  ],
})
export class AppModule {}
