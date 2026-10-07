import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { ForumService } from './forum.service';
import { ForumUserService, AVATAR_MAX_SIZE } from './forum-user.service';
import { ForumUser } from './forum-user.entity';
import { ForumPost } from './forum-post.entity';
import { ForumTopic } from './forum-topic.entity';
import { UsersService } from '../users/users.service';
import { IsNull } from 'typeorm';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data: unknown) => data),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('ForumUserService with ForumService access enforcement', () => {
  let service: ForumUserService;
  let forum: ForumService;
  let members: ReturnType<typeof makeRepo>;
  let topics: ReturnType<typeof makeRepo>;
  let posts: ReturnType<typeof makeRepo>;
  let users: { getById: jest.Mock };
  const joined = new Date('2026-01-01');
  const member = () => ({
    id: 2,
    user_id: 7,
    username: 'Member_7',
    agreed_to_rules: true,
    agreed_to_rules_at: joined,
    banned: false,
    ban_reason: 'private',
    avatar_url: null,
    created_at: joined,
    updated_at: joined,
    user: { email: 'private@example.com', password: 'private' },
  });
  const png = () => {
    const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return { buffer, size: buffer.length, mimetype: 'image/png' };
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    topics = makeRepo();
    posts = makeRepo();
    members = makeRepo();
    users = {
      getById: jest.fn().mockResolvedValue({ id: 7, email_verified: true }),
    };
    members.findOne.mockResolvedValue(member());
    members.find.mockResolvedValue([member()]);
    members.save.mockImplementation((data: object) =>
      Promise.resolve(Object.assign(member(), data)),
    );
    members.update.mockResolvedValue({ affected: 1 });
    jest.mocked(mkdir).mockResolvedValue(undefined);
    jest.mocked(unlink).mockResolvedValue(undefined);
    jest.mocked(writeFile).mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        ForumService,
        ForumUserService,
        { provide: getRepositoryToken(ForumTopic), useValue: topics },
        { provide: getRepositoryToken(ForumPost), useValue: posts },
        { provide: getRepositoryToken(ForumUser), useValue: members },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    service = module.get(ForumUserService);
    forum = module.get(ForumService);
  });

  it('registers only a verified account with strict consent and returns a safe profile', async () => {
    members.findOne.mockResolvedValue(null);
    const result = await service.register(7, 'Member_7', true);
    expect(result).toEqual({
      id: 2,
      user_id: 7,
      username: 'Member_7',
      avatar_url: null,
      created_at: joined,
      agreed_to_rules: true,
      agreed_to_rules_at: expect.any(Date),
      updated_at: joined,
      banned: false,
    });
    expect(members.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 7,
        agreed_to_rules: true,
        agreed_to_rules_at: expect.any(Date),
      }),
    );
    expect(users.getById).toHaveBeenCalledWith(7);
    expect(result).not.toHaveProperty('user');
    expect(result).not.toHaveProperty('ban_reason');
  });

  it.each([
    'ab',
    'a'.repeat(31),
    'with space',
    'юзер',
    '../user',
    '',
    null,
    123,
    {},
  ])('rejects invalid username %p', async (username) => {
    await expect(service.register(7, username, true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([false, 'true', 1, undefined, null])(
    'rejects non-boolean consent %p',
    async (consent) => {
      await expect(
        service.register(7, 'Valid_name', consent),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each([false, undefined, 'true'])(
    'checks real database verification %p',
    async (verified) => {
      users.getById.mockResolvedValue({ id: 7, email_verified: verified });
      await expect(
        service.register(7, 'Valid_name', true),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(members.save).not.toHaveBeenCalled();
    },
  );

  it('rejects deleted users and invalid user IDs', async () => {
    users.getById.mockResolvedValue(null);
    await expect(
      service.register(7, 'Valid_name', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.register(NaN, 'Valid_name', true),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('handles duplicate accounts, usernames and database unique races', async () => {
    await expect(
      service.register(7, 'Valid_name', true),
    ).rejects.toBeInstanceOf(ConflictException);
    members.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(member());
    await expect(service.register(7, 'Valid_name', true)).rejects.toThrow(
      'Имя уже занято',
    );
    members.findOne.mockResolvedValue(null);
    members.save.mockRejectedValue({ code: '23505' });
    await expect(service.register(7, 'Valid_name', true)).rejects.toThrow(
      'already exists',
    );
    members.save.mockRejectedValue(new Error('database unavailable'));
    await expect(service.register(7, 'Valid_name', true)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('returns own ban status but never exposes it publicly', async () => {
    members.findOne.mockResolvedValue({ ...member(), banned: true });
    expect(await service.status(7)).toEqual({
      registered: true,
      forumUser: expect.objectContaining({ banned: true }),
    });
    const profile = await service.publicProfile('Member_7');
    expect(profile.agreed_to_rules).toBe(true);
    expect(profile.agreed_to_rules_at).toEqual(joined);
    expect(profile.updated_at).toEqual(joined);
    expect(profile).not.toHaveProperty('banned');
    expect(profile).not.toHaveProperty('ban_reason');
    expect(profile).not.toHaveProperty('user');
    members.findOne.mockResolvedValue(null);
    expect(await service.status(7)).toEqual({
      registered: false,
      forumUser: null,
    });
    await expect(service.publicProfile('Missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sanitizes authors on every public read, including former members', async () => {
    const topic = {
      id: 4,
      title: 'Topic',
      created_at: joined,
      author: { id: 7, email: 'secret', password: 'secret' },
    };
    const post = {
      id: 6,
      content: 'Post',
      created_at: joined,
      author: topic.author,
    };
    topics.find.mockResolvedValue([topic]);
    topics.findOne.mockResolvedValue(topic);
    posts.find.mockResolvedValue([post]);
    const expectedAuthor = {
      id: 7,
      username: 'Member_7',
      avatar_url: null,
      created_at: joined,
    };
    expect((await forum.getTopics())[0].author).toEqual(expectedAuthor);
    expect((await forum.getTopic(4))?.author).toEqual(expectedAuthor);
    expect((await forum.getPosts(4))[0].author).toEqual(expectedAuthor);
    members.find.mockResolvedValue([]);
    expect((await forum.getPosts(4))[0].author).toEqual({
      id: 7,
      username: 'Former member',
      avatar_url: null,
      created_at: null,
    });
  });

  it.each(['unregistered', 'unverified', 'banned', 'not-agreed'])(
    'blocks all writes for %s users',
    async (state) => {
      if (state === 'unregistered') members.findOne.mockResolvedValue(null);
      if (state === 'unverified')
        users.getById.mockResolvedValue({ email_verified: false });
      if (state === 'banned')
        members.findOne.mockResolvedValue({ ...member(), banned: true });
      if (state === 'not-agreed')
        members.findOne.mockResolvedValue({
          ...member(),
          agreed_to_rules: false,
        });
      await expect(forum.createTopic(7, 'Title')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(forum.createPost(7, 4, 'Post')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(forum.deleteTopic(4, 7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(
        service.updateProfile(7, { username: 'NewName' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.uploadAvatar(7, png())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(topics.save).not.toHaveBeenCalled();
      expect(posts.delete).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
    },
  );

  it('preserves owner-only deletion', async () => {
    topics.findOne.mockResolvedValue({ id: 4, author: { id: 8 } });
    await expect(forum.deleteTopic(4, 7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(topics.delete).not.toHaveBeenCalled();
    topics.findOne.mockResolvedValue({ id: 4, author: { id: 7 } });
    await forum.deleteTopic(4, 7);
    expect(posts.delete).toHaveBeenCalledWith({ topic: { id: 4 } });
    expect(topics.delete).toHaveBeenCalledWith(4);
  });

  it('creates sanitized topics and posts with runtime text/ID validation', async () => {
    topics.save.mockImplementation((data: object) =>
      Promise.resolve({ ...data, id: 4, created_at: joined }),
    );
    posts.save.mockImplementation((data: object) =>
      Promise.resolve({ ...data, id: 5, created_at: joined }),
    );
    topics.findOne.mockResolvedValue({ id: 4 });
    expect(await forum.createTopic(7, ' Title ')).toEqual(
      expect.objectContaining({
        title: 'Title',
        author: expect.objectContaining({ username: 'Member_7' }),
      }),
    );
    expect(await forum.createPost(7, 4, ' Content ')).toEqual(
      expect.objectContaining({ content: 'Content' }),
    );
    await expect(forum.createTopic(7, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(forum.createPost(7, NaN, 'Post')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(forum.createPost(7, 4, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(forum.getTopic(-1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('validates the profile whitelist, username conflicts and database races', async () => {
    await expect(
      service.updateProfile(7, { avatar_url: 'https://bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateProfile(7, { username: 'NewName', banned: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateProfile(7, null)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    members.findOne.mockResolvedValueOnce(member()).mockResolvedValueOnce(null);
    expect(await service.updateProfile(7, { username: 'NewName' })).toEqual(
      expect.objectContaining({ username: 'NewName' }),
    );
    members.findOne
      .mockResolvedValueOnce(member())
      .mockResolvedValueOnce({ ...member(), user_id: 8 });
    await expect(
      service.updateProfile(7, { username: 'Taken' }),
    ).rejects.toBeInstanceOf(ConflictException);
    members.update.mockRejectedValue({ code: '23505' });
    await expect(
      service.updateProfile(7, { username: 'Member_7' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('supports safe avatar uploads through updateProfile', async () => {
    const file = png();
    const uploaded = { ...member(), avatar_url: '/avatars/7-123.png' };
    const upload = jest
      .spyOn(service, 'uploadAvatar')
      .mockResolvedValue(uploaded);
    expect(await service.updateProfile(7, { avatarFile: file })).toEqual(
      uploaded,
    );
    expect(upload).toHaveBeenCalledWith(7, file);
    expect(members.update).not.toHaveBeenCalled();
  });

  it('supports explicit null avatar removal and removes only an owned old file', async () => {
    members.findOne.mockResolvedValue({
      ...member(),
      avatar_url: '/avatars/7-123.png',
    });
    const profile = await service.updateProfile(7, { avatar_url: null });
    expect(profile.avatar_url).toBeNull();
    expect(members.update).toHaveBeenCalledWith(
      { id: 2, avatar_url: '/avatars/7-123.png' },
      {
        avatar_url: null,
        updated_at: expect.any(Date),
      },
    );
    expect(unlink).toHaveBeenCalledWith(
      expect.stringContaining('/public/avatars/7-123.png'),
    );
  });

  it('keeps the old file when avatar removal fails in the database', async () => {
    members.findOne.mockResolvedValue({
      ...member(),
      avatar_url: '/avatars/7-123.png',
    });
    members.update.mockRejectedValue(new Error('db failed'));
    await expect(
      service.updateProfile(7, { avatar_url: null }),
    ).rejects.toThrow('db failed');
    expect(unlink).not.toHaveBeenCalled();
  });

  it('validates avatar changes before applying a simultaneous username change', async () => {
    await expect(
      service.updateProfile(7, {
        username: 'NewName',
        avatarFile: {
          buffer: Buffer.from('bad'),
          size: 3,
          mimetype: 'image/png',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateProfile(7, { avatar_url: null, avatarFile: png() }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateProfile(7, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(members.update).not.toHaveBeenCalled();
  });

  it('rejects invalid authenticated IDs on all profile operations', async () => {
    for (const id of [0, -1, NaN, Infinity, 1.5]) {
      await expect(
        service.updateProfile(id, { avatar_url: null }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.uploadAvatar(id, png())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.register(id, 'Valid_name', true),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(members.update).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    { buffer: Buffer.from('html'), size: 4, mimetype: 'image/png' },
    { buffer: Buffer.from([255, 216, 255]), size: 3, mimetype: 'image/png' },
    {
      buffer: Buffer.alloc(AVATAR_MAX_SIZE + 1),
      size: AVATAR_MAX_SIZE + 1,
      mimetype: 'image/png',
    },
    { buffer: Buffer.alloc(0), size: 0, mimetype: 'image/png' },
    { buffer: Buffer.from([255, 216, 255]), size: 2, mimetype: 'image/jpeg' },
  ])('rejects missing, oversized or forged avatar %p', async (file) => {
    await expect(service.uploadAvatar(7, file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it.each([
    ['image/jpeg', Buffer.from([255, 216, 255]), 'jpg'],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'png'],
    ['image/webp', Buffer.from('RIFF1234WEBP'), 'webp'],
  ] as const)(
    'accepts validated %s signatures',
    async (mimetype, buffer, extension) => {
      const result = await service.uploadAvatar(7, {
        buffer,
        size: buffer.length,
        mimetype,
      });
      expect(result.avatar_url).toMatch(
        new RegExp(`^/avatars/7-\\d+\\.${extension}$`),
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/public/avatars/7-'),
        buffer,
        { flag: 'wx' },
      );
    },
  );

  it('uses distinct filenames, retries existing files and safely cleans up old avatars', async () => {
    const old = '/avatars/7-123.png';
    members.findOne.mockResolvedValue({ ...member(), avatar_url: old });
    jest
      .mocked(writeFile)
      .mockRejectedValueOnce({ code: 'EEXIST' })
      .mockResolvedValue(undefined);
    const first = await service.uploadAvatar(7, png());
    const second = await service.uploadAvatar(7, png());
    expect(first.avatar_url).not.toBe(second.avatar_url);
    expect(unlink).toHaveBeenCalledWith(
      expect.stringContaining('/public/avatars/7-123.png'),
    );
    members.findOne.mockResolvedValue({
      ...member(),
      avatar_url: '/avatars/../../important',
    });
    jest.mocked(unlink).mockClear();
    await service.uploadAvatar(7, png());
    expect(unlink).not.toHaveBeenCalled();
  });

  it('removes only the newly uploaded file if database update fails', async () => {
    members.findOne.mockResolvedValue({
      ...member(),
      avatar_url: '/avatars/7-123.png',
    });
    members.update.mockRejectedValue(new Error('db failed'));
    await expect(service.uploadAvatar(7, png())).rejects.toThrow('db failed');
    expect(unlink).toHaveBeenCalledTimes(1);
    expect(unlink).not.toHaveBeenCalledWith(
      expect.stringContaining('7-123.png'),
    );
  });

  it('cleans up a new avatar if the membership disappeared during upload', async () => {
    members.update.mockResolvedValue({ affected: 0 });
    await expect(service.uploadAvatar(7, png())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it('never removes another member’s avatar during replacement', async () => {
    members.findOne.mockResolvedValue({
      ...member(),
      avatar_url: '/avatars/8-123.png',
    });
    await service.uploadAvatar(7, png());
    expect(unlink).not.toHaveBeenCalled();
  });

  it('uses an IS NULL compare-and-swap when uploading the first avatar', async () => {
    await service.uploadAvatar(7, png());
    expect(members.update).toHaveBeenCalledWith(
      { id: 2, avatar_url: IsNull() },
      expect.objectContaining({
        avatar_url: expect.stringMatching(/^\/avatars\/7-/),
      }),
    );
  });

  it('keeps one winner and cleans up the losing concurrent upload', async () => {
    let currentUrl: string | null = '/avatars/7-123.png';
    members.findOne.mockImplementation(async () => ({
      ...member(),
      avatar_url: currentUrl,
    }));
    members.update.mockImplementation(
      async (
        criteria: { avatar_url: string },
        changes: { avatar_url: string | null },
      ) => {
        if (criteria.avatar_url !== currentUrl) return { affected: 0 };
        currentUrl = changes.avatar_url;
        return { affected: 1 };
      },
    );
    const results = await Promise.allSettled([
      service.uploadAvatar(7, png()),
      service.uploadAvatar(7, png()),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const failed = results.find((result) => result.status === 'rejected');
    expect(failed?.status === 'rejected' && failed.reason).toBeInstanceOf(
      ConflictException,
    );
    const winnerName = currentUrl?.split('/').pop();
    expect(unlink).not.toHaveBeenCalledWith(
      expect.stringContaining(winnerName!),
    );
    expect(unlink).toHaveBeenCalledTimes(2);
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('7-123.png'));
  });

  it('cleans up a losing upload when concurrent avatar clearing wins', async () => {
    let currentUrl: string | null = '/avatars/7-123.png';
    members.findOne.mockImplementation(async () => ({
      ...member(),
      avatar_url: currentUrl,
    }));
    members.update.mockImplementation(
      async (
        criteria: { avatar_url: string },
        changes: { avatar_url: string | null },
      ) => {
        if (criteria.avatar_url !== currentUrl) return { affected: 0 };
        currentUrl = changes.avatar_url;
        return { affected: 1 };
      },
    );
    const results = await Promise.allSettled([
      service.uploadAvatar(7, png()),
      service.updateProfile(7, { avatar_url: null }),
    ]);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
    expect(currentUrl).toBeNull();
    expect(unlink).toHaveBeenCalledTimes(2);
  });

  it('does not delete the winning upload when concurrent clearing loses', async () => {
    let currentUrl: string | null = '/avatars/7-123.png';
    let releaseClear: () => void = () => undefined;
    const uploadFinished = new Promise<void>((resolve) => {
      releaseClear = resolve;
    });
    members.findOne.mockImplementation(async () => ({
      ...member(),
      avatar_url: currentUrl,
    }));
    members.update.mockImplementation(
      async (
        criteria: { avatar_url: string },
        changes: { avatar_url: string | null },
      ) => {
        if (changes.avatar_url === null) await uploadFinished;
        if (criteria.avatar_url !== currentUrl) return { affected: 0 };
        currentUrl = changes.avatar_url;
        if (changes.avatar_url !== null) releaseClear();
        return { affected: 1 };
      },
    );
    const results = await Promise.allSettled([
      service.uploadAvatar(7, png()),
      service.updateProfile(7, { avatar_url: null }),
    ]);
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    const winnerName = currentUrl?.split('/').pop();
    expect(unlink).not.toHaveBeenCalledWith(
      expect.stringContaining(winnerName!),
    );
    expect(unlink).toHaveBeenCalledTimes(1);
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('7-123.png'));
  });
  it('supports internal bans and validates reasons without a public ban route', async () => {
    await expect(service.ban(7, '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await service.ban(7, ' Spam ');
    expect(members.update).toHaveBeenCalledWith(
      { id: 2 },
      { banned: true, ban_reason: 'Spam' },
    );
    members.findOne.mockResolvedValue({ ...member(), banned: true });
    expect(await service.isBanned(7)).toBe(true);
    members.findOne.mockResolvedValue(null);
    expect(await service.isBanned(7)).toBe(false);
    await expect(service.ban(7, 'Spam')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
