import {ModerationSchemaGate} from './moderation-schema-gate';
import {DemoReviewsService} from './demo-reviews.service';
import {DemoReviewsController} from './demo-reviews.controller';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ForumTopic } from './forum-topic.entity';
import { ForumPost } from './forum-post.entity';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';
import { UsersModule } from '../users/users.module';
import { ForumUser } from './forum-user.entity';
import { ForumUserService } from './forum-user.service';
import { ContentModerationService } from './content-moderation.service';
import { ContentModerationController } from './content-moderation.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ForumTopic, ForumPost, ForumUser]),
    UsersModule,
  ],
  providers: [ModerationSchemaGate,ForumService, ForumUserService, ContentModerationService,DemoReviewsService],
  controllers: [ForumController, ContentModerationController,DemoReviewsController],
  exports: [ForumService, ForumUserService],
})
export class ForumModule {}
