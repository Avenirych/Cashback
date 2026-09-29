import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ForumTopic } from './forum-topic.entity';
import { ForumPost } from './forum-post.entity';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ForumTopic, ForumPost]),
    UsersModule,
  ],
  providers: [ForumService],
  controllers: [ForumController],
  exports: [ForumService],
})
export class ForumModule {}
