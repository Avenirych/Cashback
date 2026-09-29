import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BonusTransfer } from './bonus-transfer.entity';
import { BonusTransferService } from './bonus-transfer.service';
import { BonusTransferController } from './bonus-transfer.controller';

import { UsersModule } from '../users/users.module';
import { BalanceModule } from '../balance/balance.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BonusTransfer]),
    UsersModule,
    BalanceModule,
    NotificationsModule,
  ],
  providers: [BonusTransferService],
  controllers: [BonusTransferController],
})
export class BonusTransferModule {}
