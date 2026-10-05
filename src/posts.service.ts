import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Post } from './posts.entity';
import { Topic } from './topics.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,

    @InjectRepository(Topic)
    private topicRepository: Repository<Topic>,
  ) {}

  async findByTopic(topicId: number) {
    return this.postRepository.find({
      where: {
        topic: {
          id: topicId,
        },
      },
      relations: {
        topic: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async create(topicId: number, content: string) {
    const topic = await this.topicRepository.findOneBy({
      id: topicId,
    });

    if (!topic) {
      throw new Error('Topic not found');
    }

    const post = this.postRepository.create({
      content,
      topic,
    });

    return this.postRepository.save(post);
  }

  async update(id: number, content: string) {
    const post = await this.postRepository.findOne({
      where: { id },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    post.content = content;
    return this.postRepository.save(post);
  }

  async remove(id: number) {
    const post = await this.postRepository.findOne({
      where: { id },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    return this.postRepository.remove(post);
  }
}
