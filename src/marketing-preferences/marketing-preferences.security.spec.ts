import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import request from 'supertest';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from '../auth/jwt.strategy';
import { JWT_CONFIGURATION } from '../auth/jwt-configuration';
import { MarketingPreferencesController } from './marketing-preferences.controller';
import { MarketingPreferencesService } from './marketing-preferences.service';
import { MarketingPreferences } from './marketing-preferences.entity';
import { parseMarketingPreferences } from './marketing-preferences.dto';

const secret = 'synthetic-marketing-regression-key';
const jwt = new JwtService({ secret, signOptions: { expiresIn: '24h' } });
const token = jwt.sign({ sub: 42, email: 'synthetic@example.test' });
const smsDefaults = { smsMarketing: false, smsMarketingGrantedAt: null, smsMarketingRevokedAt: null, smsMarketingConsentVersion: null };
const existing = () => ({ id: 7, userId: 42, accountUpdates: true, specialOffers: true, partnerRecommendations: false, ...smsDefaults, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02') });
const defaults = { id: null, userId: 42, accountUpdates: true, specialOffers: false, partnerRecommendations: false, ...smsDefaults, createdAt: null, updatedAt: null };

describe('Marketing HTTP contract with real JWT and mocked transaction manager', () => {
  let app: INestApplication;
  const users = { getById: jest.fn() };
  const read = { find: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const write = { find: jest.fn(), create: jest.fn(), save: jest.fn() };
  const lockedUsers = { findOne: jest.fn() };
  const manager = { getRepository: jest.fn(type => type === User ? lockedUsers : write) };
  const source = { transaction: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [PassportModule], controllers: [MarketingPreferencesController], providers: [MarketingPreferencesService, JwtStrategy,
      { provide: JWT_CONFIGURATION, useValue: { secret } }, { provide: UsersService, useValue: users },
      { provide: getRepositoryToken(MarketingPreferences), useValue: read }, { provide: DataSource, useValue: source }],
    }).compile(); app = module.createNestApplication(); await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    jest.clearAllMocks(); users.getById.mockResolvedValue({ id: 42, email_verified: false });
    read.find.mockResolvedValue([]); lockedUsers.findOne.mockResolvedValue({ id: 42, email_verified: false });
    write.find.mockResolvedValue([]); write.create.mockImplementation(data => ({ ...data }));
    write.save.mockImplementation(async data => ({ ...data, id: data.id ?? 7, createdAt: data.createdAt ?? new Date() }));
    source.transaction.mockImplementation(async (_level, fn) => fn(manager));
  });
  function noGetWrites() { for (const fn of [read.create, read.save, read.update, read.delete, write.save]) expect(fn).not.toHaveBeenCalled(); expect(source.transaction).not.toHaveBeenCalled(); }
  it.each(['get', 'post'] as const)('%s anonymous denied', async method => {
    await request(app.getHttpServer())[method]('/user/marketing-preferences').send({}).expect(401);
    expect(read.find).not.toHaveBeenCalled(); expect(source.transaction).not.toHaveBeenCalled();
  });
  it.each(['get', 'post'] as const)('%s deleted JWT denied before service', async method => {
    users.getById.mockResolvedValue(null);
    await request(app.getHttpServer())[method]('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send({}).expect(401);
    expect(read.find).not.toHaveBeenCalled(); expect(source.transaction).not.toHaveBeenCalled();
  });
  it.each([false, true])('verified=%s GET defaults is read-only including repeated read and foreign query', async verified => {
    users.getById.mockResolvedValue({ id: 42, email_verified: verified });
    for (let i = 0; i < 2; i++) await request(app.getHttpServer()).get('/user/marketing-preferences?userId=99').set('Authorization', `Bearer ${token}`).expect(200).expect(defaults);
    expect(read.find).toHaveBeenCalledWith({ where: { userId: 42 }, order: { id: 'ASC' }, take: 2 }); noGetWrites();
  });
  it('existing GET preserves metadata/flags and omits unexpected entity fields', async () => {
    read.find.mockResolvedValue([{ ...existing(), internalMarker: 'do-not-return' }]);
    const r = await request(app.getHttpServer()).get('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body).toEqual({ ...existing(), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' }); noGetWrites();
  });
  it.each([false, true])('verified=%s empty POST creates previous flag defaults under user lock', async verified => {
    users.getById.mockResolvedValue({ id: 42, email_verified: verified });
    const r = await request(app.getHttpServer()).post('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send({}).expect(201);
    expect(r.body).toMatchObject({ id: 7, userId: 42, accountUpdates: true, specialOffers: false, partnerRecommendations: false });
    expect(Object.keys(r.body).sort()).toEqual(Object.keys(defaults).sort());
    expect(lockedUsers.findOne).toHaveBeenCalledWith({ where: { id: 42 }, lock: { mode: 'pessimistic_write' }, select: { id: true, phone_e164: true } });
    expect(source.transaction).toHaveBeenCalledWith('READ COMMITTED', expect.any(Function));
    expect(read.find).not.toHaveBeenCalled();
  });
  it.each([{}, { specialOffers: false }, { partnerRecommendations: true }, { specialOffers: false, partnerRecommendations: true }])('partial/existing POST preserves omitted flags and accountUpdates %p', async body => {
    write.find.mockResolvedValue([{ ...existing(), accountUpdates: false }]);
    const r = await request(app.getHttpServer()).post('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send(body).expect(201);
    expect(r.body).toMatchObject({ ...existing(), ...body, accountUpdates: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: expect.any(String) });
    expect(write.create).not.toHaveBeenCalled();
  });
  for (const field of ['specialOffers', 'partnerRecommendations', 'smsMarketing']) {
    it.each(['true', 'false', 0, 1, null, [], {}])(`${field} rejects nonboolean %p`, async value => {
      await request(app.getHttpServer()).post('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send({ [field]: value }).expect(400);
      expect(source.transaction).not.toHaveBeenCalled();
    });
  }
  it.each(['smsMarketingGrantedAt','smsMarketingRevokedAt','smsMarketingConsentVersion','userId', 'id', 'accountUpdates', 'createdAt', 'updatedAt', 'unknown', '__proto__'])('rejects forbidden field %s', async key => {
    const body = JSON.parse(`{"${key}":true}`);
    await request(app.getHttpServer()).post('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send(body).expect(400); expect(source.transaction).not.toHaveBeenCalled();
  });
  it.each([null, 'text', 1, [], true, new Date()])('parser rejects nonplain body %p', body => { expect(() => parseMarketingPreferences(body)).toThrow(); });
  it('HTTP array body rejected', async () => { await request(app.getHttpServer()).post('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send([]).expect(400); });
  it.each([null, 'text', 1, true])('HTTP scalar JSON body %p rejected without transaction', async body => {
    await request(app.getHttpServer()).post('/user/marketing-preferences').set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json').send(JSON.stringify(body)).expect(400);
    expect(source.transaction).not.toHaveBeenCalled();
  });
  it.each(['user-lock', 'preferences-read', 'preferences-save'])('transactional DB failure at %s returns sanitized503', async phase => {
    const error = new Error('synthetic-private-db-detail');
    if (phase === 'user-lock') lockedUsers.findOne.mockRejectedValue(error);
    if (phase === 'preferences-read') write.find.mockRejectedValue(error);
    if (phase === 'preferences-save') write.save.mockRejectedValue(error);
    const response = await request(app.getHttpServer()).post('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send({}).expect(503);
    expect(JSON.stringify(response.body)).not.toContain('synthetic-private-db-detail');
    if (phase !== 'preferences-save') expect(write.save).not.toHaveBeenCalled();
  });
  it('user removed between JWT lookup and transactional lock returns401 without save', async () => {
    lockedUsers.findOne.mockResolvedValue(null);
    await request(app.getHttpServer()).post('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send({}).expect(401);
    expect(write.find).not.toHaveBeenCalled(); expect(write.save).not.toHaveBeenCalled();
  });
  it('SMS consent is separate, voluntary and stamped by the server', async () => {
    lockedUsers.findOne.mockResolvedValue({ id: 42, phone_e164: '+12025550123' });
    const response = await request(app.getHttpServer()).post('/user/marketing-preferences')
      .set('Authorization', `Bearer ${token}`).send({ smsMarketing: true }).expect(201);
    expect(response.body).toMatchObject({ smsMarketing: true, specialOffers: false,
      partnerRecommendations: false, smsMarketingConsentVersion: 'sms-marketing-v1', smsMarketingRevokedAt: null });
    expect(Number.isFinite(Date.parse(response.body.smsMarketingGrantedAt))).toBe(true);
    expect(response.body).not.toHaveProperty('phone_e164');
  });
  it('does not grant SMS consent without a phone', async () => {
    await request(app.getHttpServer()).post('/user/marketing-preferences')
      .set('Authorization', `Bearer ${token}`).send({ smsMarketing: true }).expect(400);
    expect(write.save).not.toHaveBeenCalled();
  });
  it('repeated grant preserves consent date; withdrawal records a server date', async () => {
    lockedUsers.findOne.mockResolvedValue({ id: 42, phone_e164: '+12025550123' });
    const granted = new Date('2026-01-01T00:00:00Z');
    write.find.mockResolvedValue([{ ...existing(), smsMarketing: true,
      smsMarketingGrantedAt: granted, smsMarketingConsentVersion: 'sms-marketing-v1' }]);
    await request(app.getHttpServer()).post('/user/marketing-preferences')
      .set('Authorization', `Bearer ${token}`).send({ smsMarketing: true }).expect(201);
    expect(write.save).toHaveBeenLastCalledWith(expect.objectContaining({smsMarketingGrantedAt:granted}));
    await request(app.getHttpServer()).post('/user/marketing-preferences')
      .set('Authorization', `Bearer ${token}`).send({ smsMarketing: false }).expect(201);
    expect(write.save).toHaveBeenLastCalledWith(expect.objectContaining({smsMarketing:false,
      smsMarketingGrantedAt:granted,smsMarketingRevokedAt:expect.any(Date)}));
  });
  it.each(['get', 'post'] as const)('%s duplicates yield409 with no arbitrary modification', async method => {
    read.find.mockResolvedValue([existing(), { ...existing(), id: 8 }]); write.find.mockResolvedValue([existing(), { ...existing(), id: 8 }]);
    await request(app.getHttpServer())[method]('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send({}).expect(409);
    expect(write.save).not.toHaveBeenCalled(); expect(write.create).not.toHaveBeenCalled();
  });
  it.each(['get', 'post'] as const)('%s DB failure sanitized503 not defaults or deletion401', async method => {
    read.find.mockRejectedValue(new Error('synthetic-private-db-detail')); source.transaction.mockRejectedValue(new Error('synthetic-private-db-detail'));
    const r = await request(app.getHttpServer())[method]('/user/marketing-preferences').set('Authorization', `Bearer ${token}`).send({}).expect(503);
    expect(JSON.stringify(r.body)).not.toContain('synthetic-private-db-detail'); expect(write.save).not.toHaveBeenCalled();
  });
});

// A deterministic mutex/transaction model, not a PostgreSQL implementation.
// The model locks only when production requests the real lock option, so a
// missing lock permits interleaving and duplicate first writes in this test.
describe('Marketing controlled interleaving model', () => {
  function model(honorRequestedLocks = true) {
    let tail = Promise.resolve(); let alive = true; const rows: MarketingPreferences[] = [];
    const lock = async () => { const previous = tail; let release!: () => void; tail = new Promise<void>(r => { release = r; }); await previous; return release; };
    const source = { transaction: async (_level: string, fn: (m: EntityManager) => Promise<unknown>) => {
      let release: (() => void) | undefined;
      const users = { findOne: async options => {
        if (honorRequestedLocks && options.lock?.mode === 'pessimistic_write') release = await lock();
        return alive ? { id: 42 } : null;
      } };
      const preferences = {
        find: async () => { const snapshot = rows.map(row => ({ ...row })); await new Promise<void>(r => setImmediate(r)); return snapshot; },
        create: data => ({ ...data }),
        save: async data => { const saved = { ...data, id: data.id ?? rows.length + 1, createdAt: data.createdAt ?? new Date() }; const index = rows.findIndex(r => r.id === saved.id); if (index < 0) rows.push(saved); else rows[index] = saved; return saved; },
      };
      const manager = { getRepository: type => type === User ? users : preferences };
      try { return await fn(manager as unknown as EntityManager); } finally { release?.(); }
    } };
    const service = new MarketingPreferencesService({} as Repository<MarketingPreferences>, source as unknown as DataSource);
    return { service, rows, lock, remove: () => { alive = false; } };
  }
  it('two concurrent first writes serialize into one row with merged flags', async () => {
    const m = model(); await Promise.all([m.service.updatePreferences(42, { specialOffers: true }), m.service.updatePreferences(42, { partnerRecommendations: true })]);
    expect(m.rows).toHaveLength(1); expect(m.rows[0]).toMatchObject({ userId: 42, specialOffers: true, partnerRecommendations: true, accountUpdates: true });
  });
  it('control: same scheduler without lock serialization permits duplicate inserts', async () => {
    const m = model(false);
    await Promise.all([m.service.updatePreferences(42, {}), m.service.updatePreferences(42, {})]);
    expect(m.rows).toHaveLength(2);
  });
  it('deletion wins parent lock; waiting writer observes missing user and never inserts', async () => {
    const m = model(); const release = await m.lock(); let finished = false;
    const write = m.service.updatePreferences(42, {}).then(() => { throw new Error('Unexpected write'); }, error => { expect(error.getStatus()).toBe(401); finished = true; });
    await new Promise<void>(r => setImmediate(r)); expect(finished).toBe(false); m.remove(); release(); await write; expect(m.rows).toHaveLength(0);
  });
});


