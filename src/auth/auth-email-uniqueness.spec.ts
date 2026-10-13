import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));

describe('Registration email conflict and normalization', () => {
  let app: INestApplication;
  let auth: AuthService;
  const users = { getByEmail: jest.fn(), create: jest.fn(), update: jest.fn() };
  const mail = { sendVerificationEmail: jest.fn(), sendResendVerificationEmail: jest.fn() };
  const jwt = { sign: jest.fn() };
  const email = 'first.last+alias@example.test';
  const input = { name: 'Synthetic', email, password: 'Synthetic1!' };
  const fixture = { id: 42, email, name: input.name, email_verified: false, password: 'synthetic-hash' };
  beforeAll(async () => {
    auth = new AuthService(users as unknown as UsersService, jwt as unknown as JwtService, mail as unknown as MailService);
    const module = await Test.createTestingModule({ controllers: [AuthController], providers: [{ provide: AuthService, useValue: auth }] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.resetAllMocks();
    users.getByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue(fixture);
    users.update.mockResolvedValue(fixture);
    (bcrypt.hash as jest.Mock).mockResolvedValue('synthetic-hash');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwt.sign.mockReturnValue('synthetic-session-result');
    mail.sendVerificationEmail.mockResolvedValue(null);
    mail.sendResendVerificationEmail.mockResolvedValue(null);
  });
  function noDeliveryOrSession() {
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
    expect(mail.sendResendVerificationEmail).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(users.update).not.toHaveBeenCalled();
  }
  function dbError(code: string, constraint: string) {
    return new QueryFailedError('synthetic-sensitive-query', [], Object.assign(new Error('synthetic-sensitive-detail'), {
      code, constraint, detail: 'synthetic-sensitive-email-and-id',
    }));
  }
  it.each(['FIRST.LAST+ALIAS@EXAMPLE.TEST', '  First.Last+Alias@Example.Test  ', '\tFirst.Last+Alias@Example.Test\n', '\u00a0First.Last+Alias@Example.Test\u00a0'])('normalizes registration without rewriting dots or aliases: case %#', async value => {
    await request(app.getHttpServer()).post('/auth/register').send({ ...input, email: value }).expect(201);
    expect(users.getByEmail).toHaveBeenCalledWith(email);
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ email }));
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(jwt.sign).toHaveBeenCalledTimes(1);
  });
  it('returns the same safe 409 for preflight and the exact named database conflict', async () => {
    users.getByEmail.mockResolvedValue(fixture);
    const preflight = await request(app.getHttpServer()).post('/auth/register').send(input).expect(409);
    expect(users.create).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    noDeliveryOrSession();
    users.getByEmail.mockResolvedValue(null);
    users.create.mockRejectedValue(dbError('23505', 'UQ_users_email'));
    const raced = await request(app.getHttpServer()).post('/auth/register').send(input).expect(409);
    expect(raced.body).toEqual(preflight.body);
    expect(raced.body).toEqual({ statusCode: 409, error: 'Conflict', message: 'Registration with this email is unavailable' });
    expect(users.create).toHaveBeenCalledTimes(1); // Attempt fails; no account was persisted by the mock.
    noDeliveryOrSession();
    const publicData = JSON.stringify(raced.body) + JSON.stringify(raced.headers);
    for (const forbidden of [email, '23505', 'UQ_users_email', 'synthetic-sensitive', 'driverError']) {
      expect(publicData).not.toContain(forbidden);
    }
    expect(raced.body).not.toHaveProperty('id');
  });
  it.each([
    dbError('23505', 'UQ_other'), dbError('23503', 'UQ_users_email'), new Error('synthetic-sensitive-detail'),
    { code: '23505', constraint: 'UQ_users_email' },
    { driverError: { code: '23505' } },
    { driverError: { code: 23505, constraint: 'UQ_users_email' } },
    { driverError: null },
  ])('does not misclassify another creation failure: case %#', async failure => {
    users.create.mockRejectedValue(failure);
    await expect(auth.register(email, input.password, input.name)).rejects.toBe(failure);
    noDeliveryOrSession();
  });
  it.each([dbError('23505', 'UQ_other'), dbError('08006', 'UQ_users_email')])('does not expose other database failure details in HTTP: case %#', async failure => {
    users.create.mockRejectedValue(failure);
    const response = await request(app.getHttpServer()).post('/auth/register').send(input).expect(500);
    expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    noDeliveryOrSession();
  });
  it('does not convert lookup failures into email conflicts', async () => {
    const failure = dbError('23505', 'UQ_users_email');
    users.getByEmail.mockRejectedValue(failure);
    await expect(auth.register(email, input.password, input.name)).rejects.toBe(failure);
    expect(users.create).not.toHaveBeenCalled();
    noDeliveryOrSession();
  });
  it('preserves login normalization and permits an existing weak-password account to log in', async () => {
    users.getByEmail.mockResolvedValue(fixture);
    await auth.login(' \tFIRST.LAST+ALIAS@EXAMPLE.TEST\n', 'old');
    expect(users.getByEmail).toHaveBeenCalledWith(email);
    expect(bcrypt.compare).toHaveBeenCalledWith('old', fixture.password);
    expect(jwt.sign).toHaveBeenCalledTimes(1);
    expect(users.create).not.toHaveBeenCalled();
  });
  it('preserves resend normalization and its capability-free response', async () => {
    users.getByEmail.mockResolvedValue(fixture);
    const result = await auth.resendVerificationEmail(' \tFIRST.LAST+ALIAS@EXAMPLE.TEST\n');
    expect(users.getByEmail).toHaveBeenCalledWith(email);
    expect(mail.sendResendVerificationEmail).toHaveBeenCalledWith(email, expect.any(String), fixture.name);
    expect(Object.keys(result)).toEqual(['message']);
    expect(users.create).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
