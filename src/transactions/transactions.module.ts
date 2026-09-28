import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Transaction } from './transaction.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { ClicksModule } from '../clicks/clicks.module';
import { BonusModule } from '../bonus/bonus.module';
import { PriceCalculationModule } from '../price-calculation/price-calculation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    ClicksModule,
    BonusModule,
    PriceCalculationModule,
  ],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
