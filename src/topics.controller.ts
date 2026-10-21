import {
  Body,
  Controller,
  Param,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Topic } from './topics.entity';

// Legacy HTTP handlers are unregistered pending an approved authorization model.
@Controller('topics')
export class TopicsController {
  constructor(
    @InjectRepository(Topic)
    private topicRepository: Repository<Topic>,
  ) {}
  getTopics() {
    return this.topicRepository.find({
      relations: {
        posts: true,
      },
      order: {
        id: 'DESC',
      },
    });
  }
  async createTopic(
    @Body() body: any,
  ) {
    const topic =
      this.topicRepository.create({
        title: body.title,
      });

    return this.topicRepository.save(
      topic,
    );
  }
  async updateTopic(
    @Param('id') id: string,
    @Body()
    body: {
      title: string;
    },
  ) {
    await this.topicRepository.update(
      Number(id),
      {
        title: body.title,
      },
    );

    return this.topicRepository.findOneBy({
      id: Number(id),
    });
  }
  async deleteTopic(
    @Param('id') id: string,
  ) {
    await this.topicRepository.delete(
      Number(id),
    );

    return {
      success: true,
    };
  }
}
