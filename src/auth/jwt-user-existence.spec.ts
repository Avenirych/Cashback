import { startGuardedHttpTestApp } from '../../test/guarded-http-app';
import { Test } from '@nestjs/testing';
import { INestApplication, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { JwtStrategy } from './jwt.strategy';

import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersController } from '../users/users.controller';
import { ForumController } from '../forum/forum.controller';
import { ForumService } from '../forum/forum.service';
import { ForumUserService } from '../forum/forum-user.service';
import { BonusController } from '../bonus/bonus.controller';
import { BonusService } from '../bonus/bonus.service';
import { MarketingPreferencesController } from '../marketing-preferences/marketing-preferences.controller';
import { MarketingPreferencesService } from '../marketing-preferences/marketing-preferences.service';

const secret = 'synthetic-user-existence-regression-key';
const jwt = new JwtService({ secret, signOptions: { expiresIn: '24h' } });
const fixture = { id: 42, email: 'synthetic@example.test', name: 'Synthetic', balance: 0, avatar_url: null, created_at: new Date(), email_verified: false };

describe('JWT current user identity gate', () => {
  let app: INestApplication;
  let strategy: JwtStrategy;
  const users = { getById: jest.fn(), getOwnProfile: jest.fn(), updateOwnProfile: jest.fn(), update: jest.fn() };
  const auth = { profile: jest.fn(), register: jest.fn() };
  const forumUsers = { status: jest.fn(), assertVerifiedUser: jest.fn() };
  const forum = { getTopics: jest.fn() };
  const bonus = { getSnapshot: jest.fn() };
  const marketing = { getPreferences: jest.fn() };
  const paths = ['/auth/profile', '/users/42', '/forum/status', '/forum/topics', '/api/bonus/snapshot', '/user/marketing-preferences'];
  const own = jwt.sign({ sub: 42, email: fixture.email, name: fixture.name });
  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AuthController, UsersController, ForumController, BonusController, MarketingPreferencesController],
      providers: [JwtStrategy,
        { provide: UsersService, useValue: users }, { provide: AuthService, useValue: auth },
        { provide: ForumUserService, useValue: forumUsers }, { provide: ForumService, useValue: forum },
        { provide: BonusService, useValue: bonus }, { provide: MarketingPreferencesService, useValue: marketing }],
    }).compile();
    strategy = module.get(JwtStrategy); app = module.createNestApplication(); await startGuardedHttpTestApp(app);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks(); users.getById.mockResolvedValue({ ...fixture }); users.update.mockResolvedValue({ ...fixture, name: 'Updated' });
    users.getOwnProfile.mockResolvedValue({ ...fixture });
    auth.profile.mockResolvedValue({ ...fixture }); auth.register.mockResolvedValue({ message: 'synthetic-public-probe' });
    forumUsers.status.mockResolvedValue({ registered: false }); forumUsers.assertVerifiedUser.mockResolvedValue(undefined);
    forum.getTopics.mockResolvedValue([]); bonus.getSnapshot.mockResolvedValue({}); marketing.getPreferences.mockResolvedValue({ userId: 42 });
  });
  function noDownstream() {
    for (const fn of [auth.profile, users.getOwnProfile, users.updateOwnProfile, users.update, forumUsers.status, forumUsers.assertVerifiedUser, forum.getTopics, bonus.getSnapshot, marketing.getPreferences]) expect(fn).not.toHaveBeenCalled();
  }
  it.each([false, true])('existing account authenticated when email_verified=%s', async verified => {
    users.getById.mockResolvedValue({ ...fixture, email_verified: verified });
    expect(await strategy.validate({ sub: 42, email: fixture.email, name: fixture.name })).toEqual({ id: 42, email: fixture.email });
    await request(app.getHttpServer()).get('/auth/profile').set('Authorization', `Bearer ${own}`).expect(200);
    expect(auth.profile).toHaveBeenCalledWith({ id: 42, email: fixture.email });
  });
  it.each(paths)('deleted account rejected before controller at %s', async path => {
    users.getById.mockResolvedValue(null);
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${own}`).expect(401); noDownstream();
  });
  it('deleted account cannot PATCH Users', async () => {
    users.getById.mockResolvedValue(null);
    await request(app.getHttpServer()).patch('/users/42').set('Authorization', `Bearer ${own}`).send({ name: 'Updated' }).expect(401); noDownstream();
  });
  it.each([undefined, null, '', '42', 0, -1, 1.5, true, {}, [], 2147483648, Number.MAX_SAFE_INTEGER + 1])('invalid signed sub %p fails without lookup', async sub => {
    const token = jwt.sign({ sub, email: fixture.email });
    await request(app.getHttpServer()).get('/auth/profile').set('Authorization', `Bearer ${token}`).expect(401);
    expect(users.getById).not.toHaveBeenCalled(); noDownstream();
  });
  it.each([NaN, Infinity, -Infinity])('rejects nonfinite sub directly %p', async sub => {
    await expect(strategy.validate({ sub })).rejects.toMatchObject({ status: 401 }); expect(users.getById).not.toHaveBeenCalled();
  });
  it('rejects a missing/nonobject payload', async () => {
    for (const payload of [null, undefined, [], 'unsupported', {}]) await expect(strategy.validate(payload)).rejects.toMatchObject({ status: 401 });
    expect(users.getById).not.toHaveBeenCalled();
  });
  it('invalid signature and expiry rejected before lookup', async () => {
    for (const token of [new JwtService({ secret: 'different-synthetic-key' }).sign({ sub: 42 }), jwt.sign({ sub: 42 }, { expiresIn: -1 })]) {
      await request(app.getHttpServer()).get('/auth/profile').set('Authorization', `Bearer ${token}`).expect(401);
    }
    expect(users.getById).not.toHaveBeenCalled(); noDownstream();
  });
  it('database failure blocks access with sanitized 503, not deletion 401', async () => {
    users.getById.mockRejectedValue(new Error('synthetic-sensitive-database-details'));
    const response = await request(app.getHttpServer()).get('/auth/profile').set('Authorization', `Bearer ${own}`).expect(503);
    expect(response.body.message).toBe('Authentication temporarily unavailable');
    expect(JSON.stringify(response.body)).not.toContain('synthetic-sensitive-database-details'); noDownstream();
  });
  it('old token survives email confirmation and each request queries current user', async () => {
    await request(app.getHttpServer()).get('/auth/profile').set('Authorization', `Bearer ${own}`).expect(200);
    users.getById.mockResolvedValue({ ...fixture, email_verified: true });
    await request(app.getHttpServer()).get('/auth/profile').set('Authorization', `Bearer ${own}`).expect(200);
    expect(users.getById).toHaveBeenCalledTimes(2);
    users.getById.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/auth/profile').set('Authorization', `Bearer ${own}`).expect(401);
  });
  it.each(paths)('existing verified user preserves downstream principal at %s', async path => {
    users.getById.mockResolvedValue({ ...fixture, email_verified: true });
    await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${own}`).expect(200);
    expect(users.getById).toHaveBeenCalledWith(42);
  });
  it('unverified account keeps own PATCH and domain verification restrictions', async () => {
    await request(app.getHttpServer()).patch('/users/42').set('Authorization', `Bearer ${own}`).send({ name: 'Updated' }).expect(200);
    expect(users.update).toHaveBeenCalledWith(42, { name: 'Updated' });
    forumUsers.assertVerifiedUser.mockRejectedValue(new ForbiddenException('Verify email'));
    bonus.getSnapshot.mockRejectedValue(new ForbiddenException('Verify email'));
    for (const path of ['/forum/topics', '/api/bonus/snapshot']) await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${own}`).expect(403);
  });
  it('public register is not globally JWT guarded', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({ email: fixture.email, password: 'synthetic-only', name: fixture.name }).expect(201);
    expect(auth.register).toHaveBeenCalled(); expect(users.getById).not.toHaveBeenCalled();
  });
});
