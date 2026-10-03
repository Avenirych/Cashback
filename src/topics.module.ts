import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Topic } from './topics.entity';
import { Post } from './posts.entity';

import { TopicsController } from './topics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Topic,
      Post,
    ]),
  ],
  controllers: [TopicsController],
})
export class TopicsModule {}
