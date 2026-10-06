import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { WithdrawalService } from './withdrawal.service';
import { Withdrawal } from './withdrawal.entity';
import { User } from '../users/user.entity';
import { BalanceOperation } from '../balance/balance.entity';
import { BalanceService } from '../balance/balance.service';
import { OnboardingService } from '../onboarding/onboarding.service';

const database = process.env.WITHDRAWAL_TEST_DATABASE;
const postgresTests = database ? describe : describe.skip;

postgresTests('PostgreSQL withdrawal reservations', () => {
  let db: DataSource;
  let service: WithdrawalService;
  let ledger: BalanceService;
  let userId: number;
  let otherUserId: number;

  beforeAll(async () => {
    db = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD,
      database,
      entities: [User, Withdrawal, BalanceOperation],
      synchronize: true,
      logging: false,
    });
    await db.initialize();
    ledger = new BalanceService(db.getRepository(BalanceOperation));
    service = new WithdrawalService(db.getRepository(Withdrawal), ledger, {
      assertEligible: jest.fn().mockResolvedValue(undefined),
      getRecipientId: jest.fn().mockImplementation(async (id: number) => id),
    } as unknown as OnboardingService);
  });

  beforeEach(async () => {
    const users = db.getRepository(User);
    const suffix = randomUUID();
    userId = (await users.save(users.create({
      email: `${suffix}@example.test`, name: 'Test customer', balance: '999.00',
    }))).id;
    otherUserId = (await users.save(users.create({
      email: `other-${suffix}@example.test`, name: 'Other test customer',
    }))).id;
  });

  afterEach(async () => {
    for (const id of [userId, otherUserId]) {
      await db.getRepository(Withdrawal).delete({ user: { id } });
      await db.getRepository(BalanceOperation).delete({ user: { id } });
      await db.getRepository(User).delete(id);
    }
  });

  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });

  async function reward(type: string, amount: string, status = 'confirmed', currency = 'GBP') {
    await db.getRepository(BalanceOperation).save({
      user: { id: userId }, type, amount, status, currency,
    });
  }

  it('allows £10 aggregate confirmed cashback plus bonuses, never completes a payout', async () => {
    await reward('cashback', '6.00');
    await reward('bonus', '4.00');
    await expect(service.requestWithdrawal(userId, '9.99', randomUUID())).rejects.toThrow('Minimum');
    const result = await service.requestWithdrawal(userId, '10.00', randomUUID());
    expect(result).toMatchObject({ amount: '10.00', status: 'pending', currency: 'GBP' });
    expect(result).not.toHaveProperty('recipientId');
    expect(result).not.toHaveProperty('user');
    expect((await db.getRepository(User).findOneByOrFail({ id: userId })).balance).toBe('0.00');
  });

  it('ignores pending, reversed, other currency, other customer and legacy balance', async () => {
    await reward('cashback', '9.99');
    await reward('bonus', '100.00', 'pending');
    await reward('bonus', '100.00', 'reversed');
    await reward('bonus', '100.00', 'confirmed', 'EUR');
    await db.getRepository(BalanceOperation).save({
      user: { id: otherUserId }, type: 'bonus', amount: '100.00', status: 'confirmed',
    });
    await expect(service.requestWithdrawal(userId, '10.00', randomUUID()))
      .rejects.toThrow('Insufficient');
    expect(await db.getRepository(Withdrawal).countBy({ user: { id: userId } })).toBe(0);
  });

  it('serializes competing requests so only one can reserve £10', async () => {
    await reward('bonus', '10.00');
    const results = await Promise.allSettled([
      service.requestWithdrawal(userId, '10.00', randomUUID()),
      service.requestWithdrawal(userId, '10.00', randomUUID()),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await db.getRepository(Withdrawal).countBy({ user: { id: userId } })).toBe(1);
  });

  it('makes concurrent retries idempotent and rejects changed amounts with the same key', async () => {
    await reward('bonus', '20.00');
    const key = randomUUID();
    const [first, second] = await Promise.all([
      service.requestWithdrawal(userId, '10.00', key),
      service.requestWithdrawal(userId, '10.00', key),
    ]);
    expect(first.id).toBe(second.id);
    expect(await ledger.availablePence(db.manager, userId)).toBe(1000);
    await expect(service.requestWithdrawal(userId, '11.00', key)).rejects.toThrow('different amount');
  });

  it('rolls back a reservation when persistence fails', async () => {
    await reward('bonus', '10.00');
    const manager = db.getRepository(Withdrawal).manager;
    const original = manager.transaction.bind(manager);
    const spy = jest.spyOn(manager, 'transaction').mockImplementation((async (work: Function) =>
      original(async (transactionManager) => {
        const save = transactionManager.save.bind(transactionManager);
        jest.spyOn(transactionManager, 'save').mockImplementation((async (...args: unknown[]) => {
          if (args[0] === Withdrawal) throw new Error('Simulated save failure');
          return (save as Function)(...args);
        }) as typeof transactionManager.save);
        return work(transactionManager);
      })) as typeof manager.transaction);
    try {
      await expect(service.requestWithdrawal(userId, '10.00', randomUUID())).rejects.toThrow('Simulated');
      expect(await ledger.availablePence(db.manager, userId)).toBe(1000);
    } finally {
      spy.mockRestore();
    }
  });
});
