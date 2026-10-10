import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { ForumUser } from '../forum/forum-user.entity';
import { BonusItem } from './bonus-item.entity';
import { BonusTransfer } from './bonus-transfer.entity';
import { BonusController } from './bonus.controller';
import { BonusService } from './bonus.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      User,
      ForumUser,
      BonusItem,
      BonusTransfer,
    ]),
  ],
  controllers: [BonusController],
  providers: [BonusService],
  exports: [BonusService],
})
export class BonusModule {}