import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtStrategy } from '../auth/jwt.strategy';
import { BonusController } from '../bonus/bonus.controller';
import { BonusService } from '../bonus/bonus.service';
import { UsersController } from '../users/users.controller';
import { UsersService } from '../users/users.service';
import { BonusEligibilityGuard } from './bonus-eligibility.guard';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

describe('Authenticated onboarding and bonus isolation', () => {
  let app: INestApplication;
  const jwt = new JwtService({ secret: 'test-only-signing-key' });
  const authorization = (payload: object) =>
    ['Bearer', jwt.sign(payload)].join(' ');
  const onboarding = {
    get: jest.fn(),
    save: jest.fn(),
    assertEligible: jest.fn(),
  };
  const bonus = {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    getSources: jest.fn(),
    addSources: jest.fn(),
  };
  const users = {
    getById: jest.fn(),
    update: jest.fn(),
    getAll: jest.fn(),
    create: jest.fn(),
    updateBalance: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OnboardingController, BonusController, UsersController],
      providers: [
        JwtStrategy,
        BonusEligibilityGuard,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'test-only-signing-key' },
        },
        { provide: OnboardingService, useValue: onboarding },
        { provide: BonusService, useValue: bonus },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires valid JWT on onboarding and bonus routes', async () => {
    for (const path of [
      '/onboarding',
      '/bonus/999/settings',
      '/bonus/999/sources',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', '******')
        .expect(401);
    }
    await request(app.getHttpServer()).post('/onboarding').send({}).expect(401);
    await request(app.getHttpServer())
      .get('/onboarding')
      .set('Authorization', authorization({ sub: '7' }))
      .expect(401);
    expect(onboarding.get).not.toHaveBeenCalled();
  });

  it('takes onboarding ownership only from the JWT', async () => {
    const auth = authorization({ sub: 7, email: 'spoof@example.com' });
    onboarding.get.mockResolvedValue({ bonusEligible: false });
    await request(app.getHttpServer())
      .get('/onboarding?userId=999')
      .set('Authorization', auth)
      .expect(200);
    expect(onboarding.get).toHaveBeenCalledWith(7);
    await request(app.getHttpServer())
      .post('/onboarding')
      .set('Authorization', auth)
      .send({ userId: 999, email: 'spoof@example.com' })
      .expect(201);
    expect(onboarding.save).toHaveBeenCalledWith(7, {
      userId: 999,
      email: 'spoof@example.com',
    });
  });

  it('checks eligibility and ignores bonus URL/body ownership', async () => {
    const auth = authorization({ sub: 7 });
    await request(app.getHttpServer())
      .get('/bonus/999/settings')
      .set('Authorization', auth)
      .expect(200);
    await request(app.getHttpServer())
      .post('/bonus/999/settings')
      .set('Authorization', auth)
      .send({ userId: 999 })
      .expect(201);
    await request(app.getHttpServer())
      .get('/bonus/999/sources')
      .set('Authorization', auth)
      .expect(200);
    await request(app.getHttpServer())
      .post('/bonus/999/sources')
      .set('Authorization', auth)
      .send({ userId: 999 })
      .expect(201);
    expect(onboarding.assertEligible).toHaveBeenCalledWith(7);
    expect(bonus.getSettings).toHaveBeenCalledWith(7);
    expect(bonus.updateSettings).toHaveBeenCalledWith(7, { userId: 999 });
    expect(bonus.getSources).toHaveBeenCalledWith(7);
    expect(bonus.addSources).toHaveBeenCalledWith(7, { userId: 999 });
  });

  it('denies bonus access before eligibility', async () => {
    const { ForbiddenException } = await import('@nestjs/common');
    onboarding.assertEligible.mockRejectedValueOnce(new ForbiddenException());
    await request(app.getHttpServer())
      .get('/bonus/999/settings')
      .set('Authorization', authorization({ sub: 7 }))
      .expect(403);
    expect(bonus.getSettings).not.toHaveBeenCalled();
  });

  it('protects generic user endpoints and only returns an allowlisted self profile', async () => {
    const auth = authorization({ sub: 7 });
    users.getById.mockResolvedValue({
      id: 7,
      email: 'account@example.com',
      name: 'Alice',
      avatar_url: null,
      balance: 0,
      password: 'private',
      recipient: { ciphertext: 'private' },
      accountNumber: '00123456',
    });
    await request(app.getHttpServer()).get('/users/7').expect(401);
    await request(app.getHttpServer())
      .get('/users/999')
      .set('Authorization', auth)
      .expect(403);
    const result = await request(app.getHttpServer())
      .get('/users/7')
      .set('Authorization', auth)
      .expect(200);
    expect(result.body).toEqual({
      id: 7,
      email: 'account@example.com',
      name: 'Alice',
      avatar_url: null,
      balance: 0,
    });
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', auth)
      .expect(403);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', auth)
      .send({ balance: 100 })
      .expect(403);
    await request(app.getHttpServer())
      .post('/users/7/balance')
      .set('Authorization', auth)
      .send({ amount: 100 })
      .expect(403);
    for (const body of [
      { balance: 100 },
      { password: 'new' },
      { accountNumber: '00123456' },
      { id: 999 },
    ]) {
      await request(app.getHttpServer())
        .patch('/users/7')
        .set('Authorization', auth)
        .send(body)
        .expect(400);
    }
    expect(users.getById).toHaveBeenCalledWith(7);
    expect(users.update).not.toHaveBeenCalled();
    expect(users.updateBalance).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
    expect(users.getAll).not.toHaveBeenCalled();
  });

  it('only permits safe self profile updates', async () => {
    const auth = authorization({ sub: 7 });
    users.update.mockResolvedValue({
      id: 7,
      name: 'Updated',
      password: 'private',
      ciphertext: 'private',
    });
    const result = await request(app.getHttpServer())
      .patch('/users/7')
      .set('Authorization', auth)
      .send({ name: ' Updated ', avatar_url: 'https://example.com/avatar.png' })
      .expect(200);
    expect(users.update).toHaveBeenCalledWith(7, {
      name: 'Updated',
      avatar_url: 'https://example.com/avatar.png',
    });
    expect(result.body).toEqual({ id: 7, name: 'Updated' });
    await request(app.getHttpServer())
      .patch('/users/999')
      .set('Authorization', auth)
      .send({ name: 'Other' })
      .expect(403);
  });
});
