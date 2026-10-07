import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForumService } from './forum.service';
import { ForumUserService } from './forum-user.service';
import { ForumTopic } from './forum-topic.entity';
import { ForumPost } from './forum-post.entity';

describe('ForumService membership delegation', () => {
  const memberships = {
    activeMember: jest.fn(),
    getByUserIds: jest.fn(),
  };
  const topics = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const posts = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  let service: ForumService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ForumService,
        { provide: ForumUserService, useValue: memberships },
        { provide: getRepositoryToken(ForumTopic), useValue: topics },
        { provide: getRepositoryToken(ForumPost), useValue: posts },
      ],
    }).compile();
    service = module.get(ForumService);
  });

  it('delegates every posting/deletion access check to ForumUserService', async () => {
    memberships.activeMember.mockRejectedValue(new ForbiddenException());
    await expect(service.createTopic(7, 'Topic')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.createPost(7, 4, 'Post')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.deleteTopic(4, 7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(memberships.activeMember).toHaveBeenCalledTimes(3);
    expect(memberships.activeMember).toHaveBeenCalledWith(7);
    expect(topics.findOne).not.toHaveBeenCalled();
    expect(topics.save).not.toHaveBeenCalled();
    expect(posts.save).not.toHaveBeenCalled();
  });

  it('looks up forum authors in a batch, never returning the User relation', async () => {
    topics.find.mockResolvedValue([
      {
        id: 4,
        title: 'One',
        author: { id: 7, email: 'private' },
        created_at: new Date(0),
      },
      {
        id: 5,
        title: 'Two',
        author: { id: 7, password: 'private' },
        created_at: new Date(0),
      },
    ]);
    memberships.getByUserIds.mockResolvedValue([
      {
        user_id: 7,
        username: 'Member_7',
        avatar_url: null,
        created_at: new Date(1),
      },
    ]);
    const result = await service.getTopics();
    expect(memberships.getByUserIds).toHaveBeenCalledWith([7]);
    expect(result.map((topic) => topic.author)).toEqual([
      {
        id: 7,
        username: 'Member_7',
        avatar_url: null,
        created_at: new Date(1),
      },
      {
        id: 7,
        username: 'Member_7',
        avatar_url: null,
        created_at: new Date(1),
      },
    ]);
  });
});
