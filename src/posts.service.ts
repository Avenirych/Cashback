import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Post } from './posts.entity';
import { Topic } from './topics.entity';

import { User } from './users/user.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,

    @InjectRepository(Topic)
    private topicRepository: Repository<Topic>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
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
        author: true,
      },
      order: {
        id: 'ASC',
      },
    });
  }

  async create(
    topicId: number,
    content: string,
  ) {
    const topic =
      await this.topicRepository.findOneBy({
        id: topicId,
      });

    if (!topic) {
      throw new Error(
        'Topic not found',
      );
    }

    const author =
      await this.userRepository.findOneBy({
        id: 1,
      });

    if (!author) {
      throw new Error(
        'User not found',
      );
    }

    const post =
      this.postRepository.create({
        content,
        topic,
        author,
      });

    return this.postRepository.save(
      post,
    );
  }

  async update(
    id: number,
    content: string,
  ) {
    await this.postRepository.update(
      id,
      {
        content,
      },
    );

    return this.postRepository.findOne({
      where: {
        id,
      },
      relations: {
        topic: true,
        author: true,
      },
    });
  }

  async remove(id: number) {
    await this.postRepository.delete(id);

    return {
      success: true,
    };
  }
}