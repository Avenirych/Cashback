import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserHistory } from './user-history.entity';
import { UserHistoryService } from './user-history.service';
import { UserHistoryController } from './user-history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserHistory])],
  providers: [UserHistoryService],
  controllers: [UserHistoryController],
  exports: [UserHistoryService],
})
export class UserHistoryModule {}
