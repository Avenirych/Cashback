import 'reflect-metadata';
import assert from 'node:assert/strict';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { User } from '../../src/users/user.entity';
import { AnalyticsEvent } from '../../src/analytics/analytics.entity';
import { Topic } from '../../src/topics.entity';
import { Post } from '../../src/posts.entity';
import { ForumUser } from '../../src/forum/forum-user.entity';
import { ForumTopic } from '../../src/forum/forum-topic.entity';
import { ForumPost } from '../../src/forum/forum-post.entity';
import { BonusItem } from '../../src/bonus/bonus-item.entity';
import { BonusTransfer } from '../../src/bonus/bonus-transfer.entity';
import { MarketingPreferences } from '../../src/marketing-preferences/marketing-preferences.entity';
import { InitialApplicationTables1733927999000 } from '../../src/migrations/1733927999000-InitialApplicationTables';
import { AddMarketingPreferences1733928000000 } from '../../src/migrations/1733928000000-AddMarketingPreferences';
import { AddEmailVerification1735000000000 } from '../../src/migrations/1735000000000-AddEmailVerification';
import { AddForumUsers1791394800000 } from '../../src/migrations/1791394800000-AddForumUsers';
import { CreateBonusTables1791630000000 } from '../../src/migrations/CreateBonusTables';
import { AddUsersEmailUnique1791888000000 } from '../../src/migrations/1791888000000-AddUsersEmailUnique';

export const migrationNames = [
  'InitialApplicationTables1733927999000', 'AddMarketingPreferences1733928000000',
  'AddEmailVerification1735000000000', 'AddForumUsers1791394800000',
  'CreateBonusTables1791630000000', 'AddUsersEmailUnique1791888000000',
];

/** No dotenv, root env, DATABASE_URL or production DB_* fallback. */
export function testOptions(env: NodeJS.ProcessEnv): PostgresConnectionOptions {
  assert.equal(env.CB_EMAIL_IT_RUN, 'yes', 'Explicit integration execution approval required');
  assert.equal(env.CB_EMAIL_IT_HOST, 'postgres-test', 'Only postgres-test is permitted');
  assert.match(env.CB_EMAIL_IT_DATABASE ?? '', /^cashback_email_unique_it_[a-f0-9]{30}$/, 'Only a fresh disposable database is permitted');
  assert.match(env.CB_EMAIL_IT_DATABASE_OID ?? '', /^[1-9][0-9]*$/, 'Creation receipt database OID required');
  assert.match(env.CB_DOCKER_DB_PASSWORD ?? '', /^[a-f0-9]{64}$/, 'Dedicated Docker test credential required');
  return {
    type: 'postgres', host: 'postgres-test', port: 5432, username: 'cashback_test',
    password: env.CB_DOCKER_DB_PASSWORD, database: env.CB_EMAIL_IT_DATABASE, schema: 'public',
    entities: [User, AnalyticsEvent, Topic, Post, ForumUser, ForumTopic, ForumPost, BonusItem, BonusTransfer, MarketingPreferences],
    migrations: [InitialApplicationTables1733927999000, AddMarketingPreferences1733928000000,
      AddEmailVerification1735000000000, AddForumUsers1791394800000, CreateBonusTables1791630000000,
      AddUsersEmailUnique1791888000000],
    subscribers: [], synchronize: false, migrationsRun: false, migrationsTransactionMode: 'all',
    installExtensions: false, logging: false,
    extra: { options: '-c statement_timeout=10000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=15000', max: 4 },
  };
}

/** Identity is checked before user tables; emptiness gate before all writes. */
export async function assertTarget(ds: DataSource, env: NodeJS.ProcessEnv, empty: boolean): Promise<void> {
  const qr = ds.createQueryRunner();
  try {
    await qr.startTransaction();
    await qr.query('SET TRANSACTION READ ONLY');
    const [identity] = await qr.query(`SELECT current_database() AS database, current_user AS role,
      host(inet_server_addr()) AS ip, inet_server_port() AS port,
      (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,
      (SELECT system_identifier::text FROM pg_control_system()) AS system,
      current_setting('server_version_num')::int AS version,
      current_setting('transaction_read_only') AS read_only`);
    assert.equal(identity.database, env.CB_EMAIL_IT_DATABASE);
    assert.equal(identity.oid, env.CB_EMAIL_IT_DATABASE_OID);
    assert.equal(identity.role, 'cashback_test'); assert.equal(identity.ip, '172.18.0.2');
    assert.equal(identity.port, 5432); assert.equal(identity.system, '7695793866029359141');
    assert(identity.version >= 170000 && identity.version < 180000); assert.equal(identity.read_only, 'on');
    if (empty) {
      const [objects] = await qr.query(`SELECT
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%') AS relations,
        (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%') AS functions,
        (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%') AS types,
        (SELECT count(*)::int FROM pg_namespace WHERE nspname NOT IN ('public','pg_catalog','information_schema')
          AND nspname NOT LIKE 'pg_%') AS schemas`);
      assert.deepEqual(objects, { relations: 0, functions: 0, types: 0, schemas: 0 });
    }
  } finally {
    if (qr.isTransactionActive) await qr.rollbackTransaction();
    await qr.release();
  }
}

/** Export a factory only: importing this module cannot connect. */
export function disposableDataSource(env: NodeJS.ProcessEnv): DataSource {
  return new DataSource(testOptions(env));
}
