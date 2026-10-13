import { testOptions, disposableDataSource, migrationNames } from './data-source';

describe('Email uniqueness stand static safety gates (no connections)', () => {
  const env = { CB_EMAIL_IT_RUN: 'yes', CB_EMAIL_IT_HOST: 'postgres-test',
    CB_EMAIL_IT_DATABASE: 'cashback_email_unique_it_' + 'a'.repeat(30), CB_EMAIL_IT_DATABASE_OID: '123',
    CB_DOCKER_DB_PASSWORD: 'b'.repeat(64) };
  it.each(['cashback_docker_test', 'postgres', 'cashback', 'cashback_docker_migration_check_' + 'a'.repeat(30)])('rejects non-stand database %s', database => {
    expect(() => testOptions({ ...env, CB_EMAIL_IT_DATABASE: database })).toThrow();
  });
  it('requires explicit approval, fixed host and database creation receipt', () => {
    for (const field of ['CB_EMAIL_IT_RUN', 'CB_EMAIL_IT_HOST', 'CB_EMAIL_IT_DATABASE_OID', 'CB_DOCKER_DB_PASSWORD']) {
      expect(() => testOptions({ ...env, [field]: undefined })).toThrow();
    }
    expect(() => testOptions({ ...env, CB_EMAIL_IT_HOST: 'localhost' })).toThrow();
  });
  it('registers exactly ten entities and six ordered migrations without initialization', () => {
    const ds = disposableDataSource(env);
    expect(ds.isInitialized).toBe(false);
    expect(testOptions(env).entities).toHaveLength(10);
    expect((testOptions(env).migrations as Array<new () => { name?: string }>).map(M => new M().name || M.name)).toEqual(migrationNames);
    expect(ds.options).toMatchObject({ synchronize: false, migrationsRun: false, migrationsTransactionMode: 'all', installExtensions: false, logging: false });
  });
  it('does not use DATABASE_URL or working DB_* as connection fallbacks', () => {
    const options = testOptions({ ...env, DATABASE_URL: 'synthetic-unused-value', DB_HOST: 'wrong', DB_NAME: 'wrong', DB_PASSWORD: 'wrong' });
    expect(options.host).toBe('postgres-test'); expect(options.database).toBe(env.CB_EMAIL_IT_DATABASE);
    expect(options.password).toBe(env.CB_DOCKER_DB_PASSWORD);
  });
});
