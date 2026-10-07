import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ForumTopic } from './forum-topic.entity';
import { ForumPost } from './forum-post.entity';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { UsersModule } from '../users/users.module';
import { ForumUser } from './forum-user.entity';
import { ForumUserService } from './forum-user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ForumTopic, ForumPost, ForumUser]),
    UsersModule,
  ],
  providers: [ForumService, ForumUserService],
  controllers: [ForumController],
  exports: [ForumService, ForumUserService],
})
export class ForumModule {}
