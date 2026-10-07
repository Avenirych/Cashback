import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { ForumUserService } from './forum-user.service';
import { ForumUser } from './forum-user.entity';

describe('Forum discussion read access', () => {
  let app: INestApplication;
  const users = { getById: jest.fn() };
  const members = { findOne: jest.fn() };
  const discussions = {
    getTopics: jest.fn().mockResolvedValue([]),
    getTopic: jest.fn().mockResolvedValue({ id: 4 }),
    getPosts: jest.fn().mockResolvedValue([]),
  };
  const paths = ['/forum/topics', '/forum/topic/4', '/forum/posts/4'];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [
        ForumUserService,
        { provide: UsersService, useValue: users },
        { provide: getRepositoryToken(ForumUser), useValue: members },
        { provide: ForumService, useValue: discussions },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            user?: { id: number };
          }>();
          if (req.headers.authorization !== 'reader')
            throw new UnauthorizedException();
          req.user = { id: 7 };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    users.getById.mockResolvedValue({ id: 7, email_verified: true });
    members.findOne.mockResolvedValue(null);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(paths)('rejects anonymous discussion reads at %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
    expect(users.getById).not.toHaveBeenCalled();
  });

  it.each(paths)('checks database email verification for %s', async (path) => {
    users.getById.mockResolvedValue({ id: 7, email_verified: false });
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'reader')
      .expect(403);
    expect(users.getById).toHaveBeenCalledWith(7);
    expect(members.findOne).not.toHaveBeenCalled();
    expect(discussions.getTopics).not.toHaveBeenCalled();
    expect(discussions.getTopic).not.toHaveBeenCalled();
    expect(discussions.getPosts).not.toHaveBeenCalled();
  });

  it.each(paths)('allows a verified nonmember to read %s', async (path) => {
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'reader')
      .expect(200);
    expect(users.getById).toHaveBeenCalledWith(7);
    expect(members.findOne).not.toHaveBeenCalled();
  });

  it.each(paths)('allows a verified banned member to read %s', async (path) => {
    members.findOne.mockResolvedValue({ user_id: 7, banned: true });
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'reader')
      .expect(200);
    expect(users.getById).toHaveBeenCalledWith(7);
    expect(members.findOne).not.toHaveBeenCalled();
  });

  it('keeps bilingual rules public', async () => {
    await request(app.getHttpServer()).get('/forum/rules').expect(200);
    expect(users.getById).not.toHaveBeenCalled();
  });

  it('keeps username profiles public', async () => {
    members.findOne.mockResolvedValue({
      id: 2,
      user_id: 7,
      username: 'Member_7',
      banned: true,
      avatar_url: null,
      agreed_to_rules: true,
      agreed_to_rules_at: new Date(0),
      created_at: new Date(0),
      updated_at: new Date(0),
    });
    const response = await request(app.getHttpServer())
      .get('/forum/user/Member_7')
      .expect(200);
    expect(response.body.username).toBe('Member_7');
    expect(response.body).not.toHaveProperty('banned');
    expect(users.getById).not.toHaveBeenCalled();
  });
});
