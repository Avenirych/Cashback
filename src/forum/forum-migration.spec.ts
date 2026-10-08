import type { QueryRunner } from 'typeorm';
import { AddForumUsers1791394800000 } from '../migrations/1791394800000-AddForumUsers';

describe('Forum users migration', () => {
  const migration = new AddForumUsers1791394800000();
  const runner = (synchronize: boolean, usersExist: boolean) => {
    const mock = {
      connection: { options: { synchronize } },
      hasTable: jest.fn().mockResolvedValue(usersExist),
      query: jest.fn().mockResolvedValue(undefined),
    };
    return { mock, queryRunner: mock as unknown as QueryRunner };
  };

  it('creates an idempotent PostgreSQL table on an existing synchronized database', async () => {
    const { mock, queryRunner } = runner(true, true);
    await migration.up(queryRunner);
    expect(mock.hasTable).toHaveBeenCalledWith('users');
    expect(mock.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS "forum_users"'),
    );
    const sql = mock.query.mock.calls[0][0] as string;
    expect(sql).toContain('"agreed_to_rules_at" timestamp');
    expect(sql).toContain(
      '"updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
    );
    expect(sql).toContain('REFERENCES "users"("id") ON DELETE CASCADE');
  });

  it('lets synchronization create users and forum profiles on a fresh dev database', async () => {
    const { mock, queryRunner } = runner(true, false);
    await migration.up(queryRunner);
    expect(mock.query).not.toHaveBeenCalled();
  });

  it('runs SQL without requiring synchronization in production', async () => {
    const { mock, queryRunner } = runner(false, true);
    await migration.up(queryRunner);
    expect(mock.hasTable).not.toHaveBeenCalled();
    expect(mock.query).toHaveBeenCalledTimes(1);
  });

  it('reverses only the forum profile table', async () => {
    const { mock, queryRunner } = runner(false, true);
    await migration.down(queryRunner);
    expect(mock.query).toHaveBeenCalledWith(
      'DROP TABLE IF EXISTS "forum_users"',
    );
  });
});
