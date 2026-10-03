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

    AnalyticsModule,
  ],
})
export class AppModule {}
