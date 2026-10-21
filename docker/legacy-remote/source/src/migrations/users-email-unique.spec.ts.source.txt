import { QueryFailedError } from 'typeorm';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import { AddUsersEmailUnique1791888000000 } from './1791888000000-AddUsersEmailUnique';
import { InitialApplicationTables1733927999000 } from './1733927999000-InitialApplicationTables';
import { AddMarketingPreferences1733928000000 } from './1733928000000-AddMarketingPreferences';
import { AddEmailVerification1735000000000 } from './1735000000000-AddEmailVerification';
import { AddForumUsers1791394800000 } from './1791394800000-AddForumUsers';
import { CreateBonusTables1791630000000 } from './CreateBonusTables';

describe('Users email unique migration (mock QueryRunner only)', () => {
  const migration = new AddUsersEmailUnique1791888000000();
  let query: jest.Mock;
  let runner: QueryRunner;
  beforeEach(() => {
    query = jest.fn().mockResolvedValue(undefined);
    runner = { query } as unknown as QueryRunner;
  });
  it('adds only the named unique constraint on the existing public.users email', async () => {
    await migration.up(runner);
    expect(query.mock.calls).toEqual([
      ['ALTER TABLE "public"."users" ADD CONSTRAINT "UQ_users_email" UNIQUE ("email")'],
    ]);
  });
  it('down removes only that constraint, without CASCADE or table/data removal', async () => {
    await migration.down(runner);
    expect(query.mock.calls).toEqual([
      ['ALTER TABLE "public"."users" DROP CONSTRAINT "UQ_users_email"'],
    ]);
  });
  it.each(['23505', '42710', '42P01', '55P03'])('propagates PostgreSQL %s without retry, repair or swallowed errors', async code => {
    const failure = new QueryFailedError('synthetic-migration-query', [], Object.assign(new Error('Synthetic failure'), { code }));
    query.mockRejectedValue(failure);
    await expect(migration.up(runner)).rejects.toBe(failure);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('propagates missing-constraint errors from down without touching other objects', async () => {
    const failure = new Error('Synthetic missing constraint');
    query.mockRejectedValue(failure);
    await expect(migration.down(runner)).rejects.toBe(failure);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('sorts after all five existing migrations by TypeORM timestamp naming', () => {
    const previous: MigrationInterface[] = [
      new InitialApplicationTables1733927999000(), new AddMarketingPreferences1733928000000(),
      new AddEmailVerification1735000000000(), new AddForumUsers1791394800000(),
      new CreateBonusTables1791630000000(),
    ];
    const timestamp = Number(migration.name.slice(-13));
    expect(timestamp).toBe(1791888000000);
    for (const item of previous) {
      const name = item.name || item.constructor.name;
      expect(timestamp).toBeGreaterThan(Number(name.slice(-13)));
    }
  });
});
