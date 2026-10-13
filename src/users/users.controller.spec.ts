import { JWT_CONFIGURATION } from '../auth/jwt-configuration';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtStrategy } from '../auth/jwt.strategy';

const fixture = {
  id: 101, email: 'fixture@example.invalid', name: 'Fixture User',
  avatar_url: null, balance: 0, email_verified: true,
  created_at: new Date('2026-01-01T00:00:00Z'),
  password: 'synthetic-password-field', email_token: 'synthetic-email-token',
  email_token_expires_at: new Date('2026-01-02T00:00:00Z'),
  futureSecret: 'must-also-be-excluded',
};

describe('Users HTTP security (mock repository, real JWT guard)', () => {
  let app: INestApplication;
  const secret = 'synthetic-users-security-test-key-only';
  const oldSecret = process.env.JWT_SECRET;
  const jwt = new JwtService({ secret });
  const ownToken = jwt.sign({ sub: 101 });
  const service = { getById: jest.fn(), update: jest.fn(), create: jest.fn(), updateBalance: jest.fn(), getAll: jest.fn() };

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    const module = await Test.createTestingModule({
      imports: [PassportModule], controllers: [UsersController],
      providers: [{ provide: JWT_CONFIGURATION, useValue: Object.freeze({ secret }) }, JwtStrategy, { provide: UsersService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    service.getById.mockResolvedValue({ ...fixture });
    service.update.mockImplementation(async (id, data) => ({ ...fixture, id, ...data }));
  });

  it.each(['get', 'patch'] as const)('%s needs JWT', async method => {
    await request(app.getHttpServer())[method]('/users/101').send({ name: 'New Name' }).expect(401);
    expect(service.getById).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });
  it.each(['get', 'patch'] as const)('%s rejects another account', async method => {
    await request(app.getHttpServer())[method]('/users/202').set('Authorization', `Bearer ${ownToken}`).send({ name: 'New Name' }).expect(403);
    expect(service.getById).toHaveBeenCalledWith(101);
    expect(service.getById).not.toHaveBeenCalledWith(202);
    expect(service.update).not.toHaveBeenCalled();
  });
  it('rejects invalid and expired JWTs', async () => {
    for (const token of ['not-a-jwt', jwt.sign({ sub: 101 }, { expiresIn: -1 })]) {
      await request(app.getHttpServer()).get('/users/101').set('Authorization', `Bearer ${token}`).expect(401);
    }
  });
  it('rejects non-numeric identity claims', async () => {
    const token = jwt.sign({ sub: '101' });
    await request(app.getHttpServer()).get('/users/101').set('Authorization', `Bearer ${token}`).expect(401);
    expect(service.getById).not.toHaveBeenCalled();
  });
  it.each([
    ['get', '/users'], ['post', '/users'], ['post', '/users/101/balance'],
  ] as const)('%s %s is disabled even for authenticated users', async (method, path) => {
    for (const authenticated of [false, true]) {
      const call = request(app.getHttpServer())[method](path);
      if (authenticated) call.set('Authorization', `Bearer ${ownToken}`);
      await call.send({ amount: 100, balance: 100 }).expect(404);
    }
    expect(service.create).not.toHaveBeenCalled();
    expect(service.updateBalance).not.toHaveBeenCalled();
    expect(service.getAll).not.toHaveBeenCalled();
  });
  it('returns only the safe own-account projection', async () => {
    const res = await request(app.getHttpServer()).get('/users/101').set('Authorization', `Bearer ${ownToken}`).expect(200);
    expect(Object.keys(res.body).sort()).toEqual(['id','email','name','avatar_url','balance','email_verified','created_at'].sort());
    expect(service.getById).toHaveBeenCalledWith(101);
  });
  it('allows only normalized own name and serializes PATCH safely', async () => {
    const res = await request(app.getHttpServer()).patch('/users/101').set('Authorization', `Bearer ${ownToken}`).send({ name: '  Updated Name  ' }).expect(200);
    expect(service.update).toHaveBeenCalledWith(101, { name: 'Updated Name' });
    expect(res.body.name).toBe('Updated Name');
    expect(Object.keys(res.body).sort()).toEqual(['id','email','name','avatar_url','balance','email_verified','created_at'].sort());
  });
  it.each(['password','role','balance','email_verified','email_token','email_token_expires_at','email','id','avatar_url','created_at','userId','__proto__'])('rejects mass assignment of %s', async key => {
    const body = JSON.parse(JSON.stringify({ name: 'Allowed Name' }).slice(0,-1) + ',"' + key + '":"forbidden"}');
    await request(app.getHttpServer()).patch('/users/101').set('Authorization', `Bearer ${ownToken}`).send(body).expect(400);
    expect(service.update).not.toHaveBeenCalled();
  });
  it.each([{}, [], {name:''}, {name:'x'}, {name:123}, {name:'x'.repeat(101)}])('rejects invalid profile input', async body => {
    await request(app.getHttpServer()).patch('/users/101').set('Authorization', `Bearer ${ownToken}`).send(body).expect(400);
    expect(service.update).not.toHaveBeenCalled();
  });
  it.each(['get','patch'] as const)('%s returns 401 for deleted own user', async method => {
    service.getById.mockResolvedValue(null);
    await request(app.getHttpServer())[method]('/users/101').set('Authorization', `Bearer ${ownToken}`).send({name:'New Name'}).expect(401);
    expect(service.update).not.toHaveBeenCalled();
  });
  it('rejects invalid path id', async () => {
    await request(app.getHttpServer()).get('/users/not-an-id').set('Authorization', `Bearer ${ownToken}`).expect(400);
    expect(service.getById).toHaveBeenCalledWith(101);
  });
});



