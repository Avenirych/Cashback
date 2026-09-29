import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Withdrawal } from './withdrawal.entity';
import { WithdrawalService } from './withdrawal.service';
import { WithdrawalController } from './withdrawal.controller';
import { UsersModule } from '../users/users.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal]),
    UsersModule,
    BalanceModule,
  ],
  providers: [WithdrawalService],
  controllers: [WithdrawalController],
  exports: [WithdrawalService],
})
export class WithdrawalModule {}
