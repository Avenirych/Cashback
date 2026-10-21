import assert from 'node:assert/strict';
import type { QueryRunner } from 'typeorm';

/** Read-only gate for first application to the exact Docker test database. */
export async function assertEmptyMainDockerTest(qr: QueryRunner): Promise<void> {
  assert.equal(qr.connection.options.type, 'postgres');
  const rows = await qr.query(`SELECT current_database() AS database,
    current_user AS username, host(inet_server_addr()) AS address,
    inet_server_port() AS port, current_setting('server_version') AS version,
    current_setting('transaction_read_only') AS read_only,
    (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`);
  const identity = rows[0];
  assert.equal(identity.database, 'cashback_docker_test', 'Wrong target database');
  assert.equal(identity.username, 'cashback_test', 'Wrong database role');
  assert.equal(identity.address, '172.18.0.2', 'Wrong server address');
  assert.equal(identity.port, 5432, 'Wrong server port');
  assert.equal(identity.system_identifier, '7695793866029359141', 'Wrong PostgreSQL cluster');
  assert(identity.version.startsWith('17.'), 'Wrong PostgreSQL major version');
  assert.equal(identity.read_only, 'on', 'Preflight must use a READ ONLY transaction');
const ns="n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'";
const queries={
schemas:"SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('public','pg_catalog','information_schema') AND nspname NOT LIKE 'pg_toast%' AND nspname NOT LIKE 'pg_temp_%' ORDER BY nspname",
relations:`SELECT n.nspname,c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${ns} ORDER BY 1,2`,
types:`SELECT n.nspname,t.typname,t.typtype FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE ${ns} ORDER BY 1,2`,
functions:`SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prokind FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE ${ns} ORDER BY 1,2,3`,
operators:`SELECT n.nspname,o.oprname FROM pg_operator o JOIN pg_namespace n ON n.oid=o.oprnamespace WHERE ${ns} ORDER BY 1,2`,
collations:`SELECT n.nspname,c.collname FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE ${ns} ORDER BY 1,2`,
constraints:`SELECT n.nspname,c.conname,c.contype FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE ${ns} ORDER BY 1,2`,
conversions:`SELECT n.nspname,c.conname FROM pg_conversion c JOIN pg_namespace n ON n.oid=c.connamespace WHERE ${ns} ORDER BY 1,2`,
textSearch:"SELECT n.nspname,t.cfgname AS name,'configuration' AS kind FROM pg_ts_config t JOIN pg_namespace n ON n.oid=t.cfgnamespace WHERE "+ns+" UNION ALL SELECT n.nspname,t.dictname,'dictionary' FROM pg_ts_dict t JOIN pg_namespace n ON n.oid=t.dictnamespace WHERE "+ns+" UNION ALL SELECT n.nspname,t.prsname,'parser' FROM pg_ts_parser t JOIN pg_namespace n ON n.oid=t.prsnamespace WHERE "+ns+" UNION ALL SELECT n.nspname,t.tmplname,'template' FROM pg_ts_template t JOIN pg_namespace n ON n.oid=t.tmplnamespace WHERE "+ns,
extensions:"SELECT extname,extversion FROM pg_extension WHERE extname<>'plpgsql' ORDER BY extname",
eventTriggers:'SELECT evtname FROM pg_event_trigger ORDER BY evtname',
foreignServers:'SELECT srvname FROM pg_foreign_server ORDER BY srvname',
foreignDataWrappers:'SELECT fdwname FROM pg_foreign_data_wrapper ORDER BY fdwname',
publications:'SELECT pubname FROM pg_publication ORDER BY pubname',
subscriptions:'SELECT subname FROM pg_subscription WHERE subdbid=(SELECT oid FROM pg_database WHERE datname=current_database()) ORDER BY subname',
largeObjects:'SELECT oid FROM pg_largeobject_metadata ORDER BY oid'
};
  for (const [kind, sql] of Object.entries(queries)) {
    const objects: unknown[] = await qr.query(sql);
    assert.equal(objects.length, 0, `Target is not empty: ${kind} contains ${objects.length} objects`);
  }
}

/** Manual sixth-migration gate: never accepts a fresh or already-upgraded database. */
export async function assertMainDockerTestReadyForEmailUnique(qr: QueryRunner): Promise<void> {
  assert.equal(qr.connection.options.type, 'postgres');
  await qr.query('SET LOCAL statement_timeout = 10000');
  await qr.query('SET LOCAL lock_timeout = 5000');
  const [identity] = await qr.query(`SELECT current_database() AS database,
    current_user AS username, host(inet_server_addr()) AS address, inet_server_port() AS port,
    (SELECT oid FROM pg_database WHERE datname=current_database()) AS database_oid,
    current_setting('server_version_num')::int AS version,
    current_setting('transaction_read_only') AS read_only,
    (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`);
  assert(identity.database_oid === 16384 || identity.database_oid === '16384', 'Wrong database OID');
  assert.deepEqual(identity, { database: 'cashback_docker_test', username: 'cashback_test',
    database_oid: identity.database_oid, address: '172.18.0.2', port: 5432, version: identity.version, read_only: 'on',
    system_identifier: '7695793866029359141' });
  assert(Number.isInteger(identity.version) && identity.version >= 170000 && identity.version < 180000);
  const schemas = await qr.query(`SELECT nspname FROM pg_namespace WHERE
    nspname NOT IN ('public','pg_catalog','information_schema') AND nspname NOT LIKE 'pg_%'`);
  assert.equal(schemas.length, 0, 'Unexpected application schema');
  const tables = await qr.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  assert.deepEqual(tables.map((t: { tablename: string }) => t.tablename), [
    'analytics_events','bonus_items','bonus_transfers','forum_posts','forum_topics','forum_users',
    'marketing_preferences','migrations','post','topic','users',
  ]);
  const history = await qr.query('SELECT name FROM public.migrations ORDER BY id');
  assert.deepEqual(history.map((m: { name: string }) => m.name), [
    'InitialApplicationTables1733927999000','AddMarketingPreferences1733928000000',
    'AddEmailVerification1735000000000','AddForumUsers1791394800000','CreateBonusTables1791630000000',
  ]);
  const email = await qr.query(`SELECT data_type,is_nullable,column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='email'`);
  assert.deepEqual(email, [{ data_type: 'character varying', is_nullable: 'NO', column_default: null }]);
  const unique = await qr.query(`SELECT c.conname FROM pg_constraint c WHERE
    c.conrelid='public.users'::regclass AND (c.conname='UQ_users_email' OR
    (c.contype='u' AND c.conkey @> ARRAY[(SELECT attnum FROM pg_attribute
      WHERE attrelid='public.users'::regclass AND attname='email')]::smallint[]))`);
  assert.equal(unique.length, 0, 'Unexpected existing email constraint');
  const indexes = await qr.query(`SELECT indexrelid FROM pg_index WHERE indrelid='public.users'::regclass
    AND indisunique AND NOT indisprimary`);
  assert.equal(indexes.length, 0, 'Unexpected unique users index');
  const [users] = await qr.query('SELECT count(*)::int AS count FROM public.users');
  // Empty users makes the exact JavaScript normalization/duplicate check vacuous.
  // Nonempty users require a separately approved exact-normalization audit.
  assert.equal(users.count, 0, 'Users must remain empty for this approved migration preparation');
}
