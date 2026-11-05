import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './user.entity';
import { UsersService } from './users.service';
import { SessionRevocationService } from '../auth/session-revocation.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, SessionRevocationService],
  controllers: [UsersController],
  exports: [UsersService, SessionRevocationService], // 🔥 обязательно!
})
export class UsersModule {}
