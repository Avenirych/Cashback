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
  const users = { getByEmail: jest.fn(), create: jest.fn(), findByEmailToken: jest.fn(), update: jest.fn() };
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
  for (const environment of ['development', 'production', 'test', undefined]) {
    it.each(['local', 'ethereal', 'smtp', 'failure'])(`${environment}: %s returns no verification capability`, async delivery => {
      if (environment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = environment;
      mail.sendVerificationEmail.mockImplementation(async (_email, token) => {
        if (delivery === 'failure') throw new Error(`synthetic-sensitive-error ${token}`);
        return delivery === 'smtp' ? null : `https://synthetic.invalid/verify-email?token=${token}`;
      });
      const response = await request(app.getHttpServer()).post('/auth/register')
        .send({ email: fixture.email, password: 'synthetic-password', name: fixture.name }).expect(201);
      const data = users.create.mock.calls[0][0];
      expect(data.email_token).toMatch(/^[a-f0-9]{64}$/);
      expect(data.email_token_expires_at).toBeInstanceOf(Date);
      expect(data.password).toBe('synthetic-hash');
      expect(mail.sendVerificationEmail).toHaveBeenCalledWith(fixture.email, data.email_token, fixture.name);
      expect(response.body).not.toHaveProperty('preview_url');
      expect(Object.keys(response.body).sort()).toEqual(['access_token', 'message', 'user', 'verification_email_sent']);
      const serialized = JSON.stringify(response.body) + JSON.stringify(response.headers) + JSON.stringify(errorLog.mock.calls);
      for (const forbidden of [data.email_token, 'verify-email?', 'synthetic-sensitive-error', 'synthetic-hash']) expect(serialized).not.toContain(forbidden);
      expect(response.body.verification_email_sent).toBe(delivery !== 'failure');
      expect(jwt.sign).toHaveBeenCalledWith({ sub: fixture.id, email: fixture.email, name: fixture.name });
      if (delivery !== 'failure') {
        users.findByEmailToken.mockResolvedValue({ ...fixture, ...data });
        users.update.mockResolvedValue({ ...fixture, email_verified: true });
        await request(app.getHttpServer()).get('/auth/verify-email').query({ token: data.email_token }).expect(200);
        expect(users.update).toHaveBeenCalledWith(fixture.id, { email_verified: true, email_token: null, email_token_expires_at: null });
      }
    });
  }
});
