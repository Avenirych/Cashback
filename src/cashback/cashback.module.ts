import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CashbackService } from './cashback.service';
import { CashbackController } from './cashback.controller';
import { Transaction } from './transaction.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    UsersModule,
  ],
  providers: [CashbackService],
  controllers: [CashbackController],
})
export class CashbackModule {}
