import { Test } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { AVATAR_MAX_SIZE, ForumUserService } from './forum-user.service';
import { FORUM_RULES } from './forum-rules';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('ForumController HTTP contract', () => {
  let app: INestApplication;
  const service = {
    register: jest.fn(),
    assertVerifiedUser: jest.fn(),
    status: jest.fn(),
    publicProfile: jest.fn(),
    updateProfile: jest.fn(),
    uploadAvatar: jest.fn(),
    getTopics: jest.fn(),
    getTopic: jest.fn(),
    getPosts: jest.fn(),
    createTopic: jest.fn(),
    createPost: jest.fn(),
    deleteTopic: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [
        { provide: ForumService, useValue: service },
        { provide: ForumUserService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            user?: { id: number };
          }>();
          if (req.headers.authorization !== '******')
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
    jest.resetAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes bilingual rules without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/forum/rules')
      .expect(200);
    expect(response.body).toEqual(FORUM_RULES);
    expect(response.body.en).toContain('UK context and advice');
    expect(response.body.en).toContain('Deleting a topic permanently removes');
    expect(response.body.ru).toContain('Безвозвратное удаление');
    expect(response.body.en).toContain(
      'Rule violations may result in deletion of your forum account or a ban',
    );
    expect(response.body.ru).toContain(
      'Нарушения могут привести к удалению вашего аккаунта форума или блокировке',
    );
  });

  it.each([
    ['post', '/forum/register'],
    ['post', '/forum/avatar'],
    ['patch', '/forum/profile'],
    ['post', '/forum/topic'],
    ['post', '/forum/post'],
    ['delete', '/forum/topic/4'],
    ['get', '/forum/status'],
    ['get', '/forum/topics'],
    ['get', '/forum/topic/4'],
    ['get', '/forum/posts/4'],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    await request(app.getHttpServer())[method](path).expect(401);
  });

  it('passes strict registration consent and authenticated ID to the service', async () => {
    service.register.mockResolvedValue({ username: 'Member_7' });
    await request(app.getHttpServer())
      .post('/forum/register')
      .set('Authorization', '******')
      .send({ username: 'Member_7', agreedToRules: true, user_id: 99 })
      .expect(201);
    expect(service.register).toHaveBeenCalledWith(7, 'Member_7', true);
  });

  it('returns the own status envelope and public username lookup', async () => {
    service.status.mockResolvedValue({ registered: false, forumUser: null });
    const status = await request(app.getHttpServer())
      .get('/forum/status')
      .set('Authorization', '******')
      .expect(200);
    expect(status.body).toEqual({ registered: false, forumUser: null });
    expect(service.status).toHaveBeenCalledWith(7);
    service.publicProfile.mockResolvedValue({ username: 'Member_7' });
    await request(app.getHttpServer()).get('/forum/user/Member_7').expect(200);
    expect(service.publicProfile).toHaveBeenCalledWith('Member_7');
  });

  it('uses in-memory multipart uploads and forwards binary bytes', async () => {
    const buffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    service.uploadAvatar.mockResolvedValue({
      avatar_url: '/avatars/7-123.png',
    });
    await request(app.getHttpServer())
      .post('/forum/avatar')
      .set('Authorization', '******')
      .attach('file', buffer, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(service.uploadAvatar).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
      }),
    );
  });

  it('rejects oversized multipart files before invoking the service', async () => {
    await request(app.getHttpServer())
      .post('/forum/avatar')
      .set('Authorization', '******')
      .attach('file', Buffer.alloc(AVATAR_MAX_SIZE + 1), 'large.png')
      .expect(413);
    expect(service.uploadAvatar).not.toHaveBeenCalled();
  });

  it('preserves existing endpoints and owner ID for writes', async () => {
    service.getTopics.mockResolvedValue([]);
    service.getPosts.mockResolvedValue([]);
    service.getTopic.mockResolvedValue({ id: 4 });
    await request(app.getHttpServer())
      .get('/forum/topics')
      .set('Authorization', '******')
      .expect(200);
    await request(app.getHttpServer())
      .get('/forum/topic/4')
      .set('Authorization', '******')
      .expect(200);
    await request(app.getHttpServer())
      .get('/forum/posts/4')
      .set('Authorization', '******')
      .expect(200);
    await request(app.getHttpServer())
      .post('/forum/topic')
      .set('Authorization', '******')
      .send({ title: 'Title' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/forum/post')
      .set('Authorization', '******')
      .send({ topicId: 4, content: 'Post' })
      .expect(201);
    const deletion = await request(app.getHttpServer())
      .delete('/forum/topic/4')
      .set('Authorization', '******')
      .expect(200);
    expect(deletion.body).toEqual({ success: true });
    expect(service.createTopic).toHaveBeenCalledWith(7, 'Title');
    expect(service.createPost).toHaveBeenCalledWith(7, 4, 'Post');
    expect(service.deleteTopic).toHaveBeenCalledWith(4, 7);
  });

  it('rejects nonnumeric IDs rather than coercing them', async () => {
    await request(app.getHttpServer())
      .get('/forum/topic/not-a-number')
      .set('Authorization', '******')
      .expect(400);
    await request(app.getHttpServer())
      .post('/forum/post')
      .set('Authorization', '******')
      .send({ topicId: {}, content: 'Post' })
      .expect(400);
    expect(service.createPost).not.toHaveBeenCalled();
  });

  it('forwards profile input intact for service whitelist validation', async () => {
    await request(app.getHttpServer())
      .patch('/forum/profile')
      .set('Authorization', '******')
      .send({ username: 'NewName' })
      .expect(200);
    expect(service.updateProfile).toHaveBeenCalledWith(7, {
      username: 'NewName',
    });
  });
});
