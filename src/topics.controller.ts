import { Body, Controller, Get, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Topic } from './topics.entity';

@Controller('topics')
export class TopicsController {
  constructor(
    @InjectRepository(Topic)
    private topicRepository: Repository<Topic>,
  ) {}

  @Get()
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

  @Post()
  async createTopic(@Body() body: any) {
    const topic = this.topicRepository.create({
      title: body.title,
    });

    return this.topicRepository.save(topic);
  }
}