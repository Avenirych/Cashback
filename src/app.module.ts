import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CashbackModule } from './cashback/cashback.module';
import { ProductsModule } from './products/products.module';
import { PartnersModule } from './partners/partners.module';
import { BonusModule } from './bonus/bonus.module';
import { PriceCalculationModule } from './price-calculation/price-calculation.module';
import { ClicksModule } from './clicks/clicks.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PromoModule } from './promo/promo.module';
import { SearchModule } from './search/search.module';
import { BalanceModule } from './balance/balance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? '',
      appSecret: process.env.OBSERVE_APP_SECRET ?? '',
      serviceId: 'cashback-plus-backend',
    }),

    UsersModule,
    AuthModule,
    CashbackModule,
    ProductsModule,
    PartnersModule,
    BonusModule,
    PriceCalculationModule,
    ClicksModule,
    TransactionsModule,
    PromoModule,
    SearchModule,
    BalanceModule,
  ],
})
export class AppModule {}



