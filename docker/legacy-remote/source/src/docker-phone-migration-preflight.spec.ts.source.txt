import { DataSource } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import * as source from './docker-phone-migration-data-source';
import * as preflight from './docker-phone-migration-preflight';
import type { CatalogObject, PhoneApproval, PhoneFacts } from './docker-phone-migration-preflight';
import { commitPhoneTransaction, PHONE_APPLY_CONCURRENCY_VERIFIED, runPhoneMigration } from './docker-phone-migration-runner';

const catalog = (): CatalogObject[] => [
  ...preflight.PHONE_BASE_TABLES.map(t => ({ kind: 'relation', key: `public.${t}`, body: { kind: 'r', owner: 'synthetic' } })),
  { kind: 'namespace', key: 'public', body: { acl: ['synthetic=UC/synthetic'], owner: 'synthetic' } },
  { kind: 'view', key: 'synthetic_view', body: { definition: 'SELECT 1', kind: 'v' } },
  { kind: 'rule', key: 'synthetic_view._RETURN', body: { definition: 'synthetic-rule', enabled: 'O' } },
  { kind: 'sequence', key: 'users_id_seq', body: { increment: '1', cache: '1', cycle: false } },
  { kind: 'index', key: 'UQ_users_email', body: { definition: 'synthetic-index', valid: true, ready: true } },
];
// Independently fixed synthetic inventory; never obtained from a live DB.
const inventory = () => [
  ...preflight.PHONE_BASE_TABLES.map(t => ({ kind: 'relation', key: `public.${t}` })),
  { kind: 'namespace', key: 'public' }, { kind: 'view', key: 'synthetic_view' },
  { kind: 'rule', key: 'synthetic_view._RETURN' }, { kind: 'sequence', key: 'users_id_seq' },
  { kind: 'index', key: 'UQ_users_email' },
];

// Synthetic catalog fixtures only. These are NOT deployment identities or approved fingerprints.
const approval = (): PhoneApproval => ({ operation: 'phone-seventh-only', permission: 'B',
  target: { host: 'postgres-test', port: 5432, role: 'cashback_test',
    database: `cashback_phone_migration_check_${'a'.repeat(30)}`, address: '192.0.2.1',
    oid: '42', systemIdentifier: '123', serverVersionNum: '170011' },
  schemaFormat: preflight.PHONE_SCHEMA_FORMAT, beforeObjects: inventory(), afterObjects: inventory(),
  beforeSha256: 'a'.repeat(64), afterSha256: 'b'.repeat(64) });
const facts = (): PhoneFacts => {
  const t = approval().target;
  return { identity: { database: t.database, role: t.role, address: t.address, port: '5432',
    oid: t.oid, systemIdentifier: t.systemIdentifier, serverVersionNum: t.serverVersionNum },
    history: preflight.PHONE_PREVIOUS.map(([timestamp, name]) => ({ timestamp, name })),
    emailUnique: true, schemaSha256: 'a'.repeat(64), catalogObjects: inventory(), addedColumns: [], addedConstraints: [] };
};

describe('isolated phone migration safety (mocks only)', () => {
  afterEach(() => jest.restoreAllMocks());
  it('does not initialize a connection when the module is imported or factory constructed', () => {
    const initialize = jest.spyOn(DataSource.prototype, 'initialize').mockRejectedValue(new Error('NO_CONNECTION'));
    jest.isolateModules(() => { require('./docker-phone-migration-data-source'); });
    const ds = source.createPhoneMigrationDataSource(approval().target, 'synthetic-not-a-credential');
    expect(ds.isInitialized).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
    expect(ds.options.migrations).toHaveLength(1);
  });
  it('accepts the exact synthetic baseline', () => expect(() => preflight.validatePhoneFacts(facts(), approval())).not.toThrow());
  it.each(['role', 'database', 'oid', 'systemIdentifier', 'address', 'port', 'serverVersionNum'])('rejects wrong identity %s', key => {
    const f = facts(); f.identity[key] = 'wrong';
    expect(() => preflight.validatePhoneFacts(f, approval())).toThrow('PHONE_IDENTITY_MISMATCH');
  });
  it.each(['missing', 'reordered', 'extra', 'already-applied'])('rejects %s history', kind => {
    const f = facts();
    if (kind === 'missing') f.history.pop();
    if (kind === 'reordered') f.history.reverse();
    if (kind === 'extra') f.history.push({ timestamp: '1', name: 'Unexpected1' });
    if (kind === 'already-applied') f.history.push({ timestamp: preflight.PHONE_TIMESTAMP, name: preflight.PHONE_MIGRATION });
    expect(() => preflight.validatePhoneFacts(f, approval())).toThrow('PHONE_HISTORY_MISMATCH');
  });
  it('rejects absent email uniqueness', () => {
    expect(() => preflight.validatePhoneFacts({ ...facts(), emailUnique: false }, approval())).toThrow('PHONE_EMAIL_UNIQUE_MISMATCH');
  });
  it.each(['fingerprint', 'phone-column', 'conflicting-check'])('rejects schema mismatch %s', kind => {
    const f = facts();
    if (kind === 'fingerprint') f.schemaSha256 = 'c'.repeat(64);
    if (kind === 'phone-column') f.addedColumns.push('users.phone_e164');
    if (kind === 'conflicting-check') f.addedConstraints.push('CK_users_phone_e164');
    expect(() => preflight.validatePhoneFacts(f, approval())).toThrow('PHONE_SCHEMA_MISMATCH');
  });
  it('rejects invalid mode and absent permission before constructing a source', async () => {
    const factory = jest.spyOn(source, 'createPhoneMigrationDataSource');
    expect(await runPhoneMigration('')).toEqual({ status: 'BLOCKED', reason: 'INVALID_MODE' });
    expect(await runPhoneMigration('apply', approval())).toEqual({ status: 'BLOCKED', reason: 'AUTHORIZATION_REQUIRED' });
    expect(factory).not.toHaveBeenCalled();
  });

  function mockSource() {
    let isolation = '';
    const q = { isTransactionActive: false, connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn(async (level: string) => { isolation = level.toLowerCase(); q.isTransactionActive = true; }),
      rollbackTransaction: jest.fn(async () => { q.isTransactionActive = false; }),
      commitTransaction: jest.fn(async () => { q.isTransactionActive = false; }),
      query: jest.fn(async (sql: string): Promise<unknown[]> => sql === 'SHOW transaction_isolation'
        ? [{ transaction_isolation: isolation }] : []), release: jest.fn().mockResolvedValue(undefined) };
    const ds = { isInitialized: false, initialize: jest.fn(async () => { ds.isInitialized = true; }),
      createQueryRunner: jest.fn(() => q), destroy: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(source, 'createPhoneMigrationDataSource').mockReturnValue(ds as unknown as DataSource);
    jest.spyOn(preflight, 'inspectPhoneDatabase').mockResolvedValue(facts());
    return { q, ds };
  }
  it('read-only preflight always rolls back and releases without migrations', async () => {
    const { q, ds } = mockSource();
    expect(await runPhoneMigration('preflight', approval(), 'synthetic')).toEqual({ status: 'PASS', reason: 'PREFLIGHT_PASSED' });
    expect(q.query).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    expect(q.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(q.commitTransaction).not.toHaveBeenCalled();
    expect(q.release).toHaveBeenCalledTimes(1); expect(ds.destroy).toHaveBeenCalledTimes(1);
  });
  it('rolls back on transaction work failure without retry', async () => {
    const { q } = mockSource(); q.query.mockRejectedValueOnce(new Error('synthetic'));
    expect((await runPhoneMigration('preflight', approval(), 'synthetic')).status).toBe('BLOCKED');
    expect(q.rollbackTransaction).toHaveBeenCalledTimes(1); expect(q.release).toHaveBeenCalledTimes(1);
  });
  it('blocks if cleanup is unconfirmed', async () => {
    const { q } = mockSource(); q.release.mockRejectedValueOnce(new Error('synthetic'));
    expect((await runPhoneMigration('preflight', approval(), 'synthetic')).reason).toBe('CLEANUP_UNCONFIRMED');
  });
  it('locks in order with fresh statement snapshots but keeps unverified apply blocked', async () => {
    const { q } = mockSource();
    const a = approval(); a.permission = 'C';
    expect(await runPhoneMigration('apply', a, 'synthetic')).toEqual({ status: 'BLOCKED', reason: 'CONCURRENCY_UNVERIFIED' });
    expect(PHONE_APPLY_CONCURRENCY_VERIFIED).toBe(false);
    expect(q.startTransaction).toHaveBeenCalledWith('READ COMMITTED');
    const sql = q.query.mock.calls.map(call => String(call[0]));
    expect(sql.filter(s => s.startsWith('LOCK TABLE'))).toEqual([
      'LOCK TABLE public.migrations IN ACCESS EXCLUSIVE MODE',
      'LOCK TABLE public.users IN ACCESS EXCLUSIVE MODE',
      'LOCK TABLE public.marketing_preferences IN ACCESS EXCLUSIVE MODE',
    ]);
    expect(sql.filter(s => s.startsWith('ALTER TABLE') || s.startsWith('INSERT INTO'))).toHaveLength(0);
    expect(q.commitTransaction).not.toHaveBeenCalled();
    expect(q.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(preflight.inspectPhoneDatabase).toHaveBeenCalledTimes(2);
    const secondInspection = jest.mocked(preflight.inspectPhoneDatabase).mock.invocationCallOrder[1];
    expect(q.query.mock.invocationCallOrder[sql.indexOf('LOCK TABLE public.marketing_preferences IN ACCESS EXCLUSIVE MODE')]).toBeLessThan(secondInspection);
  });
  it('rolls back an apply preflight failure before any migration SQL', async () => {
    const { q } = mockSource(); const a = approval(); a.permission = 'C';
    jest.mocked(preflight.inspectPhoneDatabase).mockRejectedValueOnce(new Error('synthetic'));
    expect((await runPhoneMigration('apply', a, 'synthetic')).status).toBe('BLOCKED');
    expect(q.commitTransaction).not.toHaveBeenCalled();
    expect(q.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(q.query.mock.calls.some(call => String(call[0]).startsWith('ALTER TABLE'))).toBe(false);
  });
  it('refuses generic migration and down entry points without connecting', async () => {
    const ds = source.createPhoneMigrationDataSource(approval().target, 'synthetic');
    await expect(ds.runMigrations()).rejects.toThrow('PHONE_GENERIC_CLI_FORBIDDEN');
    await expect(ds.undoLastMigration()).rejects.toThrow('PHONE_DOWN_FORBIDDEN');
    expect(ds.isInitialized).toBe(false);
  });

  it.each(['view', 'rule', 'sequence', 'index', 'namespace'])('detects changed %s metadata against independent expected hash', kind => {
    const a = approval();
    a.beforeSha256 = preflight.fingerprintPhoneCatalog(catalog(), inventory());
    const changed = catalog();
    const object = changed.find(r => r.kind === kind)!;
    // Represents definition/increment/index validity/privilege changes, never live data.
    if (kind === 'index') object.body = { definition: 'synthetic-index', valid: false, ready: true };
    else if (kind === 'namespace') object.body = { acl: ['unapproved=UC/synthetic'], owner: 'synthetic' };
    else if (kind === 'sequence') object.body = { increment: '2', cache: '1', cycle: false };
    else object.body = { definition: 'changed-synthetic-definition' };
    const f = { ...facts(), schemaSha256: preflight.fingerprintPhoneCatalog(changed, inventory()) };
    expect(() => preflight.validatePhoneFacts(f, a)).toThrow('PHONE_SCHEMA_MISMATCH');
  });
  it('canonicalizes row order, inventory order and JSON object key order', () => {
    const reversed = catalog().reverse().map(r => ({ ...r,
      body: Object.fromEntries(Object.entries(r.body as Record<string, unknown>).reverse()) }));
    expect(preflight.fingerprintPhoneCatalog(reversed, inventory().reverse()))
      .toBe(preflight.fingerprintPhoneCatalog(catalog(), inventory()));
  });
  it('rejects missing, duplicate, unexpected and unsupported objects rather than learning an inventory', () => {
    const rows = catalog();
    expect(() => preflight.fingerprintPhoneCatalog(rows.slice(1), inventory())).toThrow();
    expect(() => preflight.fingerprintPhoneCatalog([...rows, rows[0]], inventory())).toThrow();
    expect(() => preflight.fingerprintPhoneCatalog([...rows, { kind: 'rule', key: 'unexpected', body: {} }], inventory())).toThrow();
    expect(() => preflight.fingerprintPhoneCatalog([{ kind: 'unknown', key: 'unknown', body: {} }], inventory())).toThrow();
    expect(() => preflight.fingerprintPhoneCatalog(rows, [])).toThrow();
  });
  it('rejects unversioned approvals', () => {
    const a = approval();
    expect(() => preflight.requirePhoneApproval({ ...a, schemaFormat: 'old' } as unknown as PhoneApproval, 'preflight')).toThrow();
  });
  it('executes catalog inspection only against a mock QueryRunner and validates unsupported surface', async () => {
    const a = approval(); a.beforeSha256 = preflight.fingerprintPhoneCatalog(catalog(), inventory());
    const responses = [[facts().identity], [{ count: '0' }], facts().history,
      [{ count: 1 }], [], [], catalog()];
    const query = jest.fn(async () => responses.shift());
    const f = await preflight.inspectPhoneDatabase({ query } as unknown as QueryRunner, a);
    expect(() => preflight.validatePhoneFacts(f, a)).not.toThrow();
    expect(query).toHaveBeenCalledTimes(7);
    const badQuery = jest.fn().mockResolvedValueOnce([facts().identity]).mockResolvedValueOnce([{ count: '1' }]);
    await expect(preflight.inspectPhoneDatabase({ query: badQuery } as unknown as QueryRunner, a))
      .rejects.toThrow('PHONE_UNSUPPORTED_CATALOG_OBJECT');
    expect(badQuery).toHaveBeenCalledTimes(2);
  });
  it('blocks catalog inspection errors without silently omitting a family', async () => {
    const query = jest.fn().mockResolvedValueOnce([facts().identity]).mockRejectedValueOnce(new Error('synthetic'));
    await expect(preflight.inspectPhoneDatabase({ query } as unknown as QueryRunner, approval())).rejects.toThrow('synthetic');
  });
  it('rejects history changed while waiting for locks before any up or history write', async () => {
    const { q } = mockSource(); const a = approval(); a.permission = 'C';
    const changed = facts(); changed.history.push({ timestamp: '1', name: 'conflicting' });
    jest.mocked(preflight.inspectPhoneDatabase).mockReset().mockResolvedValueOnce(facts()).mockResolvedValueOnce(changed);
    expect((await runPhoneMigration('apply', a, 'synthetic')).reason).toBe('OPERATION_FAILED');
    expect(q.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(q.query.mock.calls.some(([sql]) => /^(ALTER|INSERT)/.test(sql))).toBe(false);
  });
  it('rejects schema changed before locks', async () => {
    const { q } = mockSource(); const a = approval(); a.permission = 'C';
    jest.mocked(preflight.inspectPhoneDatabase).mockReset().mockResolvedValueOnce(facts())
      .mockResolvedValueOnce({ ...facts(), schemaSha256: 'c'.repeat(64) });
    expect((await runPhoneMigration('apply', a, 'synthetic')).reason).toBe('OPERATION_FAILED');
    expect(q.commitTransaction).not.toHaveBeenCalled(); expect(q.rollbackTransaction).toHaveBeenCalledTimes(1);
  });
  it('rolls back on lock acquisition failure and does not retry', async () => {
    const { q } = mockSource(); const a = approval(); a.permission = 'C';
    q.query.mockImplementation(async sql => {
      if (sql.startsWith('LOCK TABLE')) throw new Error('synthetic-lock-failure');
      return sql === 'SHOW transaction_isolation' ? [{ transaction_isolation: 'read committed' }] : [];
    });
    expect((await runPhoneMigration('apply', a, 'synthetic')).reason).toBe('OPERATION_FAILED');
    expect(q.query.mock.calls.filter(([sql]) => sql.startsWith('LOCK TABLE'))).toHaveLength(1);
    expect(q.rollbackTransaction).toHaveBeenCalledTimes(1); expect(q.release).toHaveBeenCalledTimes(1);
  });
  it('rejects an old transaction snapshot policy after locks', async () => {
    const { q } = mockSource(); const a = approval(); a.permission = 'C'; let shows = 0;
    q.query.mockImplementation(async sql => sql === 'SHOW transaction_isolation'
      ? [{ transaction_isolation: ++shows === 1 ? 'read committed' : 'serializable' }] : []);
    expect((await runPhoneMigration('apply', a, 'synthetic')).reason).toBe('OPERATION_FAILED');
    expect(preflight.inspectPhoneDatabase).toHaveBeenCalledTimes(1);
    expect(q.commitTransaction).not.toHaveBeenCalled();
  });
  it.each(['rollback', 'release', 'destroy'])('reports uncertain %s cleanup without PASS', async kind => {
    const { q, ds } = mockSource(); const a = approval(); a.permission = 'C';
    if (kind === 'rollback') q.rollbackTransaction.mockRejectedValueOnce(new Error('synthetic'));
    if (kind === 'release') q.release.mockRejectedValueOnce(new Error('synthetic'));
    if (kind === 'destroy') ds.destroy.mockRejectedValueOnce(new Error('synthetic'));
    expect((await runPhoneMigration('apply', a, 'synthetic')).reason).toBe('CLEANUP_UNCONFIRMED');
    expect(q.release).toHaveBeenCalledTimes(1); expect(ds.destroy).toHaveBeenCalledTimes(1);
  });
  it('preserves unknown commit acknowledgement without retry or down', async () => {
    const commitTransaction = jest.fn().mockRejectedValue(new Error('synthetic'));
    expect(await commitPhoneTransaction({ commitTransaction } as unknown as QueryRunner))
      .toEqual({ status: 'BLOCKED', reason: 'COMMIT_OUTCOME_UNKNOWN' });
    expect(commitTransaction).toHaveBeenCalledTimes(1);
  });
});
