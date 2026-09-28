import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BalanceOperation } from './balance.entity';
import { BalanceService } from './balance.service';
import { BalanceController } from './balance.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BalanceOperation]),
    UsersModule,
  ],
  providers: [BalanceService],
  controllers: [BalanceController],
  exports: [BalanceService],
})
export class BalanceModule {}
