import { assertMainDockerTestReadyForEmailUnique } from './docker-main-test-preflight';
import type { QueryRunner } from 'typeorm';

const identity = { database: 'cashback_docker_test', username: 'cashback_test', address: '172.18.0.2',
  database_oid: 16384, port: 5432, version: 170011, read_only: 'on', system_identifier: '7695793866029359141' };
const tables = ['analytics_events','bonus_items','bonus_transfers','forum_posts','forum_topics','forum_users',
  'marketing_preferences','migrations','post','topic','users'];
const history = ['InitialApplicationTables1733927999000','AddMarketingPreferences1733928000000',
  'AddEmailVerification1735000000000','AddForumUsers1791394800000','CreateBonusTables1791630000000'];
function fixture(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = { identity: [identity], schemas: [], tables: tables.map(tablename => ({ tablename })),
    history: history.map(name => ({ name })), email: [{ data_type: 'character varying', is_nullable: 'NO', column_default: null }],
    unique: [], indexes: [], users: [{ count: 0 }], ...overrides };
  const query = jest.fn(async (sql: string) => {
    if (sql.startsWith('SET LOCAL')) return [];
    const key = sql.includes('current_database()') ? 'identity' : sql.includes('pg_namespace') ? 'schemas' :
      sql.includes('pg_tables') ? 'tables' : sql.includes('public.migrations') ? 'history' :
      sql.includes('information_schema.columns') ? 'email' : sql.includes('pg_constraint') ? 'unique' :
      sql.includes('pg_index') ? 'indexes' : 'users';
    return responses[key];
  });
  return { qr: { connection: { options: { type: 'postgres' } }, query } as unknown as QueryRunner, query };
}
describe('Manual sixth migration read-only preflight', () => {
  it('accepts only the expected existing empty-user schema and five migrations', async () => {
    const { qr, query } = fixture(); await assertMainDockerTestReadyForEmailUnique(qr);
    expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT') || sql.startsWith('SET LOCAL'))).toBe(true);
  });
  it.each(['database','username','address','port','system_identifier','read_only','version'])('rejects wrong %s', async key => {
    const { qr } = fixture({ identity: [{ ...identity, [key]: key === 'version' ? 160011 : 'wrong' }] });
    await expect(assertMainDockerTestReadyForEmailUnique(qr)).rejects.toThrow();
  });
  it.each(['schemas','tables','history','email','unique','indexes','users'])('rejects unexpected %s', async key => {
    const { qr } = fixture({ [key]: key === 'users' ? [{ count: 1 }] : [{ unexpected: true }] });
    await expect(assertMainDockerTestReadyForEmailUnique(qr)).rejects.toThrow();
  });
  it.each([16384, '16384'])('accepts exact OID representation %p', async database_oid => {
    const { qr, query } = fixture({ identity: [{ ...identity, database_oid }] });
    await expect(assertMainDockerTestReadyForEmailUnique(qr)).resolves.toBeUndefined();
    expect(query.mock.calls[2][0]).toContain('SELECT oid FROM pg_database WHERE datname=current_database()');
  });
  it.each([16385, '16385', undefined, null, '', 'wrong', '16384junk', ' 16384', '16384 ',
    '016384', '+16384', '16384.0', '1.6384e4', '0x4000', true, NaN, Infinity, {}, ['16384']])(
    'rejects missing, wrong or noncanonical OID case %#', async database_oid => {
      const { qr, query } = fixture({ identity: [{ ...identity, database_oid }] });
      await expect(assertMainDockerTestReadyForEmailUnique(qr)).rejects.toThrow('Wrong database OID');
      expect(query).toHaveBeenCalledTimes(3); // Stop before schema/history queries.
    },
  );
  it('rejects an omitted OID field before reading application tables', async () => {
    const { database_oid: _ignored, ...withoutOid } = identity;
    const { qr, query } = fixture({ identity: [withoutOid] });
    await expect(assertMainDockerTestReadyForEmailUnique(qr)).rejects.toThrow('Wrong database OID');
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('propagates an identity SQL error without continuing', async () => {
    const { qr, query } = fixture();
    const failure = new Error('Synthetic identity query failure');
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockRejectedValueOnce(failure);
    await expect(assertMainDockerTestReadyForEmailUnique(qr)).rejects.toBe(failure);
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('still rejects an already-upgraded six-migration history', async () => {
    const { qr } = fixture({ history: [...history, 'AddUsersEmailUnique1791888000000'].map(name => ({ name })) });
    await expect(assertMainDockerTestReadyForEmailUnique(qr)).rejects.toThrow();
  });

});
