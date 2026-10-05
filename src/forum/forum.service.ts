import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
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
    if (!title || title.trim().length < 3) {
      throw new BadRequestException('Title must be at least 3 characters');
    }

    const user = await this.usersService.getById(userId);
    if (!user) throw new BadRequestException('User not found');

    const topic = this.topicRepo.create({
      title: title.trim(),
      author: { id: user.id },
    });

    return this.topicRepo.save(topic);
  }

  async createPost(userId: number, topicId: number, content: string) {
    if (!content || content.trim().length < 1) {
      throw new BadRequestException('Content is required');
    }

    const user = await this.usersService.getById(userId);
    if (!user) throw new BadRequestException('User not found');

    const topic = await this.topicRepo.findOne({ where: { id: topicId } });
    if (!topic) throw new BadRequestException('Topic not found');

    const post = this.postRepo.create({
      content: content.trim(),
      author: { id: user.id },
      topic: { id: topic.id },
    });

    return this.postRepo.save(post);
  }

  async getTopics() {
    return this.topicRepo.find({
      relations: { author: true },
      order: { created_at: 'DESC' },
    });
  }

  async getTopic(id: number) {
    return this.topicRepo.findOne({
      where: { id },
      relations: { author: true },
    });
  }

  async getPosts(topicId: number) {
    return this.postRepo.find({
      where: { topic: { id: topicId } },
      relations: { author: true },
      order: { created_at: 'ASC' },
    });
  }

  async deleteTopic(id: number, userId: number) {
    const topic = await this.topicRepo.findOne({
      where: { id },
      relations: { author: true },
    });

    if (!topic) throw new BadRequestException('Topic not found');
    if (topic.author.id !== userId) {
      throw new ForbiddenException('You can only delete your own topics');
    }

    await this.postRepo.delete({ topic: { id } });
    await this.topicRepo.delete(id);
  }
}
