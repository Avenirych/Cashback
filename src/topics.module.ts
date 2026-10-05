import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Topic } from './topics.entity';
import { Post } from './posts.entity';

import { TopicsController } from './topics.controller';
import { PostsController } from './posts.controller';

import { PostsService } from './posts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Topic,
      Post,
    ]),
  ],
  controllers: [
    TopicsController,
    PostsController,
  ],
  providers: [
    PostsService,
  ],
})
export class TopicsModule {}
