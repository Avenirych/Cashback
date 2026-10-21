import { Test } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

describe('Registration capability isolation', () => {
  let app: INestApplication;
  const mode = process.env.NODE_ENV;
  const users = { getByEmail: jest.fn(), create: jest.fn(), consumeEmailToken: jest.fn(), findByEmailToken: jest.fn(), update: jest.fn() };
  const mail = { sendVerificationEmail: jest.fn() };
  const jwt = { sign: jest.fn().mockReturnValue('synthetic-session-result') };
  const fixture = { id: 42, email: 'synthetic@example.test', name: 'Synthetic', balance: 0, avatar_url: null, created_at: new Date(), email_verified: false };
  let errorLog: jest.SpyInstance;
  beforeAll(async () => {
    const auth = new AuthService(users as unknown as UsersService, jwt as unknown as JwtService, mail as unknown as MailService);
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [{ provide: AuthService, useValue: auth }] }).compile();
    app = module.createNestApplication(); await app.init();
  });
  afterAll(async () => { await app.close(); if (mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = mode; });
  beforeEach(() => {
    jest.clearAllMocks(); errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    users.getByEmail.mockResolvedValue(null);
    users.create.mockImplementation(async data => ({ ...fixture, ...data }));
    (bcrypt.hash as jest.Mock).mockResolvedValue('synthetic-hash');
  });
  afterEach(() => errorLog.mockRestore());
  it.each([undefined, null, '', '2025550123', '+000123', '+12025550123 ext 4', 123])(
    'rejects invalid or absent phone before any account action: %#', async phone_e164 => {
      await request(app.getHttpServer()).post('/auth/register')
        .send({ firstName: "Synthetic", lastName: "Buyer", email: fixture.email, password: 'Synthetic1!', name: fixture.name, phone_e164 }).expect(400);
      expect(users.getByEmail).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    },
  );
  for (const environment of ['development', 'production', 'test', undefined]) {
    it.each(['local', 'ethereal', 'smtp', 'failure'])(`${environment}: %s returns no verification capability`, async delivery => {
      if (environment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = environment;
      mail.sendVerificationEmail.mockImplementation(async (_email, token) => {
        if (delivery === 'failure') throw new Error(`synthetic-sensitive-error ${token}`);
        return delivery === 'smtp' ? null : `https://synthetic.invalid/verify-email?token=${token}`;
      });
      const response = await request(app.getHttpServer()).post('/auth/register')
        .send({ firstName: "Synthetic", lastName: "Buyer", email: fixture.email, password: 'Synthetic1!', name: fixture.name, phone_e164: '+12025550123' }).expect(201);
      const data = users.create.mock.calls[0][0];
      expect(data.email_token).toMatch(/^[a-f0-9]{64}$/);
      expect(data.email_token_expires_at).toBeInstanceOf(Date);
      expect(data.password).toBe('synthetic-hash');
      expect(mail.sendVerificationEmail).toHaveBeenCalledWith(fixture.email, data.email_token, data.name);
      expect(response.body).not.toHaveProperty('preview_url');
      expect(response.body.user).toHaveProperty('phone_e164', data.phone_e164);
      expect(response.body.user).not.toHaveProperty('phone_verified');
      expect(response.body.user).not.toHaveProperty('phone_verified_at');
      expect(Object.keys(response.body).sort()).toEqual(['access_token', 'message', 'user', 'verification_email_sent']);
      const serialized = JSON.stringify(response.body) + JSON.stringify(response.headers) + JSON.stringify(errorLog.mock.calls);
      for (const forbidden of [data.email_token, 'verify-email?', 'synthetic-sensitive-error', 'synthetic-hash']) expect(serialized).not.toContain(forbidden);
      expect(response.body.verification_email_sent).toBe(delivery !== 'failure');
      expect(jwt.sign).toHaveBeenCalledWith({ sub: fixture.id, email: fixture.email, name: data.name });
      if (delivery !== 'failure') {
        users.consumeEmailToken.mockResolvedValue({ ...fixture, ...data, email_verified:true });
        users.update.mockResolvedValue({ ...fixture, email_verified: true });
        await request(app.getHttpServer()).get('/auth/verify-email').query({ token: data.email_token }).expect(200);
        expect(users.consumeEmailToken).toHaveBeenCalledWith(data.email_token);
      }
    });
  }

  it.each([
    ['too short', 'Aa1!aaa'],
    ['no uppercase letter', 'aaaaaaa1!'],
    ['no lowercase letter', 'AAAAAAA1!'],
    ['no digit', 'Aaaaaaaa!'],
    ['no special character', 'Aaaaaaa1'],
    ['previously accepted weak password', 'abc'],
    ['non-ASCII uppercase is not A-Z', 'Äaaaaaa1!'],
    ['non-ASCII lowercase is not a-z', 'Aääääää1!'],
    ['non-ASCII digit is not ASCII digit', 'Aaaaaaa١!'],
    ['empty', ''],
    ['missing', undefined],
    ['null', null],
    ['non-string', 12345678],
  ])('rejects %s before account lookup, hashing, email or JWT', async (_case, password) => {
    await request(app.getHttpServer()).post('/auth/register')
      .send({ firstName: "Synthetic", lastName: "Buyer", email: fixture.email, password, name: fixture.name, phone_e164: '+12025550123' }).expect(400);
    expect(users.getByEmail).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it.each([
    'Aa1!aaaa', // Exact eight-character boundary.
    'Aa1 aaaa', // Frontend counts whitespace as a special character.
    'Aa1éaaaa', // Frontend counts non-ASCII characters as special characters.
    ' Aa1!aaa ', // Neither frontend nor backend trims passwords.
  ])('preserves frontend password semantics for valid synthetic case %#', async password => {
    mail.sendVerificationEmail.mockResolvedValue(null);
    await request(app.getHttpServer()).post('/auth/register')
      .send({ firstName: "Synthetic", lastName: "Buyer", email: fixture.email, password, name: fixture.name, phone_e164: '+12025550123' }).expect(201);
    expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    expect(users.create).toHaveBeenCalledTimes(1);
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(jwt.sign).toHaveBeenCalledTimes(1);
  });
});
