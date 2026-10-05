import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

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

  @Patch(':id')
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

  @Delete(':id')
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