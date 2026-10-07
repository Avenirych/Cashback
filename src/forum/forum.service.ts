import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumTopic } from './forum-topic.entity';
import { ForumPost } from './forum-post.entity';
import { ForumUserService } from './forum-user.service';

@Injectable()
export class ForumService {
  constructor(
    @InjectRepository(ForumTopic)
    private readonly topicRepo: Repository<ForumTopic>,
    @InjectRepository(ForumPost)
    private readonly postRepo: Repository<ForumPost>,
    private readonly forumUserService: ForumUserService,
  ) {}

  private validateId(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid ID / Некорректный ID');
    }
  }

  private async sanitizeAuthors<T extends ForumTopic | ForumPost>(items: T[]) {
    const ids = [
      ...new Set(
        items.map((item) => item.author?.id).filter((id): id is number => !!id),
      ),
    ];
    const members = await this.forumUserService.getByUserIds(ids);
    const byUser = new Map(members.map((member) => [member.user_id, member]));
    return items.map((item) => {
      const member = byUser.get(item.author?.id);
      return {
        id: item.id,
        ...('title' in item
          ? { title: item.title }
          : { content: item.content }),
        created_at: item.created_at,
        author: {
          id: item.author?.id ?? null,
          username: member?.username ?? 'Former member',
          avatar_url: member?.avatar_url ?? null,
          created_at: member?.created_at ?? null,
        },
      };
    });
  }

  async createTopic(userId: number, title: unknown) {
    await this.forumUserService.activeMember(userId);
    if (
      typeof title !== 'string' ||
      title.trim().length < 3 ||
      title.trim().length > 255
    ) {
      throw new BadRequestException('Title must be 3–255 characters');
    }
    const topic = await this.topicRepo.save(
      this.topicRepo.create({
        title: title.trim(),
        author: { id: userId },
      }),
    );
    return (await this.sanitizeAuthors([topic]))[0];
  }

  async createPost(userId: number, topicId: number, content: unknown) {
    await this.forumUserService.activeMember(userId);
    this.validateId(topicId);
    if (typeof content !== 'string' || !content.trim())
      throw new BadRequestException('Content is required');
    const topic = await this.topicRepo.findOne({ where: { id: topicId } });
    if (!topic) throw new BadRequestException('Topic not found');
    const post = await this.postRepo.save(
      this.postRepo.create({
        content: content.trim(),
        author: { id: userId },
        topic: { id: topic.id },
      }),
    );
    return (await this.sanitizeAuthors([post]))[0];
  }

  async getTopics() {
    return this.sanitizeAuthors(
      await this.topicRepo.find({
        relations: { author: true },
        order: { created_at: 'DESC' },
      }),
    );
  }

  async getTopic(id: number) {
    this.validateId(id);
    const topic = await this.topicRepo.findOne({
      where: { id },
      relations: { author: true },
    });
    return topic ? (await this.sanitizeAuthors([topic]))[0] : null;
  }

  async getPosts(topicId: number) {
    this.validateId(topicId);
    return this.sanitizeAuthors(
      await this.postRepo.find({
        where: { topic: { id: topicId } },
        relations: { author: true },
        order: { created_at: 'ASC' },
      }),
    );
  }

  async deleteTopic(id: number, userId: number) {
    await this.forumUserService.activeMember(userId);
    this.validateId(id);
    const topic = await this.topicRepo.findOne({
      where: { id },
      relations: { author: true },
    });
    if (!topic) throw new BadRequestException('Topic not found');
    if (topic.author?.id !== userId)
      throw new ForbiddenException('You can only delete your own topics');
    await this.postRepo.delete({ topic: { id } });
    await this.topicRepo.delete(id);
  }
}
