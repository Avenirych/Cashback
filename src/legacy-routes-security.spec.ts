import { startGuardedHttpTestApp } from '../test/guarded-http-app';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { TopicsController } from './topics.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { Topic } from './topics.entity';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';

import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { ForumController } from './forum/forum.controller';
import { ForumService } from './forum/forum.service';
import { ForumUserService } from './forum/forum-user.service';
import { BonusController } from './bonus/bonus.controller';
import { BonusService } from './bonus/bonus.service';
import { MarketingPreferencesController } from './marketing-preferences/marketing-preferences.controller';
import { MarketingPreferencesService } from './marketing-preferences/marketing-preferences.service';

const routes = [
  ['get', '/topics'], ['post', '/topics'], ['patch', '/topics/1'], ['delete', '/topics/1'],
  ['get', '/posts/topic/1'], ['post', '/posts'], ['patch', '/posts/1'], ['delete', '/posts/1'], ['get', '/analytics'],
] as const;
const secret = 'synthetic-legacy-route-regression-key';
const jwt = new JwtService({ secret, signOptions: { expiresIn: '24h' } });
const identityCases = ['anonymous', 'unverified', 'verified-owner', 'verified-non-owner', 'deleted', 'invalid-signature'] as const;
const tokenFor = (identity: typeof identityCases[number]) => identity === 'anonymous' ? undefined : identity === 'invalid-signature'
  ? new JwtService({ secret: 'different-synthetic-key' }).sign({ sub: 11 })
  : jwt.sign({ sub: identity === 'deleted' ? 33 : identity === 'unverified' ? 11 : identity === 'verified-owner' ? 22 : 44, email: 'synthetic@example.test' });

describe('Unregistered legacy Topics/Posts/Analytics HTTP handlers', () => {
  let app: INestApplication;
  const repo = { find: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn(), findOneBy: jest.fn(), delete: jest.fn() };
  const posts = { findByTopic: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() };
  const analytics = { getEvents: jest.fn() };
  const users = { getById: jest.fn(), update: jest.fn() };
  const forumUsers = { publicProfile: jest.fn(), status: jest.fn() };
  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [TopicsController, PostsController, AnalyticsController, AuthController, UsersController, ForumController, BonusController, MarketingPreferencesController],
      providers: [JwtStrategy,
        { provide: getRepositoryToken(Topic), useValue: repo }, { provide: PostsService, useValue: posts }, { provide: AnalyticsService, useValue: analytics },
        { provide: UsersService, useValue: users }, { provide: AuthService, useValue: {} },
        { provide: ForumService, useValue: {getTopics:async()=>[]} }, { provide: ForumUserService, useValue: forumUsers },
        { provide: BonusService, useValue: {} }, { provide: MarketingPreferencesService, useValue: {} }],
    }).compile();
    app = module.createNestApplication(); await startGuardedHttpTestApp(app);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks(); users.getById.mockImplementation(async id => id === 33 ? null : ({ id, email_verified: id !== 11 }));
    forumUsers.publicProfile.mockResolvedValue({ username: 'Synthetic' });
  });
  function noLegacyAccess() {
    for (const fn of [...Object.values(repo), ...Object.values(posts), analytics.getEvents]) expect(fn).not.toHaveBeenCalled();
    expect(users.getById).not.toHaveBeenCalled();
  }
  it('has no HTTP metadata on any legacy controller method', () => {
    for (const controller of [TopicsController, PostsController, AnalyticsController]) {
      for (const key of Object.getOwnPropertyNames(controller.prototype).filter(k => k !== 'constructor')) {
        const method = Object.getOwnPropertyDescriptor(controller.prototype, key)?.value;
        expect(typeof method).toBe('function');
        expect(Reflect.getMetadata(PATH_METADATA, method)).toBeUndefined();
        expect(Reflect.getMetadata(METHOD_METADATA, method)).toBeUndefined();
      }
    }
  });
  it('real initialized Express route registry has no legacy route and retains active controllers', () => {
    const instance = app.getHttpAdapter().getInstance();
    type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };
    const stack: RouteLayer[] = instance.router?.stack ?? instance._router?.stack;
    expect(stack).toBeDefined();
    const paths = stack.filter(layer => layer.route).map(layer => layer.route!.path);
    for (const prefix of ['/topics', '/posts', '/analytics']) expect(paths.some(p => p === prefix || p.startsWith(prefix + '/'))).toBe(false);
    const expected = [
      ['post', '/auth/register'], ['post', '/auth/login'], ['post', '/auth/resend-verification'], ['get', '/auth/verify-email'], ['get', '/auth/profile'],
      ['get', '/users/:id'], ['patch', '/users/:id'],
      ['post', '/forum/register'], ['get', '/forum/status'], ['get', '/forum/rules'], ['get', '/forum/user/:username'], ['patch', '/forum/profile'], ['post', '/forum/avatar'],
      ['get', '/forum/topics'], ['post', '/forum/topic'], ['post', '/forum/post'], ['get', '/forum/topic/:id'], ['get', '/forum/posts/:topicId'], ['delete', '/forum/topic/:id'],
      ['get', '/api/bonus/snapshot'], ['post', '/api/bonus/transfer'], ['post', '/api/bonus/spend-on-purchase'],
      ['get', '/user/marketing-preferences'], ['post', '/user/marketing-preferences'],
    ];
    for (const [method, path] of expected) expect(stack.some(layer => layer.route?.path === path && layer.route.methods[method])).toBe(true);
  });
  for (const identity of identityCases) {
    it.each(routes)(`${identity}: %s %s returns 404 without accessing repositories/services`, async (method, path) => {
      let call = request(app.getHttpServer())[method](path);
      const token = tokenFor(identity); if (token) call = call.set('Authorization', `Bearer ${token}`);
      if (method !== 'get') call = call.send({ title: 'Synthetic', content: 'Synthetic', topicId: 1, userId: 1, authorId: 1 });
      const response = await call.expect(404);
      expect(response.body.statusCode).toBe(404); noLegacyAccess();
    });
  }
  it.each(['/analytics?userId=1&type=marketing', '/analytics?userId=2', '/analytics/', '/topics/', '/posts/topic/1/'])('query/trailing path %s cannot reveal legacy data', async path => {
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${tokenFor('verified-owner')}`).expect(404); noLegacyAccess();
  });
  it.each(['/auth/profile', '/users/1', '/forum/status', '/api/bonus/snapshot', '/user/marketing-preferences'])('protected active path %s remains registered and denies anonymous requests', async path => {
    await request(app.getHttpServer()).get(path).expect(401);
  });
  it('preserves public Forum rules/profile handlers', async () => {
    await request(app.getHttpServer()).get('/forum/topics').expect(200,[]);
    await request(app.getHttpServer()).get('/forum/rules').expect(200);
    await request(app.getHttpServer()).get('/forum/user/Synthetic').expect(200).expect({ username: 'Synthetic' });
    expect(forumUsers.publicProfile).toHaveBeenCalledWith('Synthetic');
  });
});
