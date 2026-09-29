import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ForumTopic } from './forum-topic.entity';
import { ForumPost } from './forum-post.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ForumService {
  constructor(
    @InjectRepository(ForumTopic)
    private readonly topicRepo: Repository<ForumTopic>,

    @InjectRepository(ForumPost)
    private readonly postRepo: Repository<ForumPost>,

    private readonly usersService: UsersService,
  ) {}

  async createTopic(userId: number, title: string) {
    const user = await this.usersService.getById(userId);
    if (!user) throw new BadRequestException('User not found');

    const topic = this.topicRepo.create({
      title,
      author: { id: user.id }, // ✔ передаём только id
    });

    return this.topicRepo.save(topic);
  }

  async createPost(userId: number, topicId: number, content: string) {
    const user = await this.usersService.getById(userId);
    if (!user) throw new BadRequestException('User not found');

    const topic = await this.topicRepo.findOne({ where: { id: topicId } });
    if (!topic) throw new BadRequestException('Topic not found');

    const post = this.postRepo.create({
      content,
      author: { id: user.id }, // ✔ только id
      topic: { id: topic.id }, // ✔ только id
    });

    return this.postRepo.save(post);
  }

  getTopic(id: number) {
    return this.topicRepo.findOne({
      where: { id },
      relations: { author: true },
    });
  }

  getPosts(topicId: number) {
    return this.postRepo.find({
      where: { topic: { id: topicId } },
      relations: { author: true },
      order: { created_at: 'ASC' },
    });
  }
}
