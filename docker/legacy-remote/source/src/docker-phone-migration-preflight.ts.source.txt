import { createHash } from 'node:crypto';
import type { QueryRunner } from 'typeorm';
import { assertPhoneTarget } from './docker-phone-migration-data-source';
import type { PhoneTarget } from './docker-phone-migration-data-source';

export const PHONE_MIGRATION = 'AddUserPhoneAndSmsConsent1792195200000';
export const PHONE_TIMESTAMP = '1792195200000';
export const PHONE_SCHEMA_FORMAT = 'PHONE_SCHEMA_V2';
export interface CatalogObject { kind: string; key: string; body: unknown }
export interface CatalogKey { kind: string; key: string }
export const PHONE_BASE_TABLES = [
  'analytics_events', 'bonus_items', 'bonus_transfers', 'forum_posts', 'forum_topics',
  'forum_users', 'marketing_preferences', 'migrations', 'post', 'topic', 'users',
] as const;
const catalogKinds = new Set(['namespace', 'relation', 'column', 'constraint', 'index',
  'trigger', 'policy', 'type', 'routine', 'extension', 'view', 'rule', 'sequence',
  'dependency', 'default-acl', 'effective-privileges', 'role-membership']);

// No locale, driver JSON object insertion order, or incoming row order in the digest.
function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  throw new Error('PHONE_CATALOG_UNSUPPORTED_VALUE');
}

function orderedKeys(keys: readonly CatalogKey[]): CatalogKey[] {
  const seen = new Set<string>();
  return keys.map(({ kind, key }) => {
    const id = canonical([kind, key]);
    if (!catalogKinds.has(kind) || !key || seen.has(id)) throw new Error('PHONE_CATALOG_INVENTORY_INVALID');
    seen.add(id);
    return { kind, key };
  }).sort((a, b) => { const x = canonical([a.kind, a.key]); const y = canonical([b.kind, b.key]); return x < y ? -1 : x > y ? 1 : 0; });
}

export function fingerprintPhoneCatalog(rows: readonly CatalogObject[], expected: readonly CatalogKey[]): string {
  if (!expected.length || !rows.length || canonical(orderedKeys(rows)) !== canonical(orderedKeys(expected))) {
    throw new Error('PHONE_CATALOG_INVENTORY_MISMATCH');
  }
  const tables = rows.filter(r => r.kind === 'relation' && (r.body as { kind?: unknown } | null)?.kind === 'r')
    .map(r => r.key).sort();
  if (canonical(tables) !== canonical(PHONE_BASE_TABLES.map(t => `public.${t}`).sort())) {
    throw new Error('PHONE_TABLE_ROSTER_MISMATCH');
  }
  const bodies = new Map(rows.map(r => [canonical([r.kind, r.key]), r.body]));
  const objects = orderedKeys(rows).map(r => ({ ...r, body: bodies.get(canonical([r.kind, r.key])) }));
  return createHash('sha256').update(canonical({ format: PHONE_SCHEMA_FORMAT, objects }), 'utf8').digest('hex');
}
export const PHONE_PREVIOUS = [
  ['1733927999000', 'InitialApplicationTables1733927999000'],
  ['1733928000000', 'AddMarketingPreferences1733928000000'],
  ['1735000000000', 'AddEmailVerification1735000000000'],
  ['1791394800000', 'AddForumUsers1791394800000'],
  ['1791630000000', 'CreateBonusTables1791630000000'],
  ['1791888000000', 'AddUsersEmailUnique1791888000000'],
] as const;

/** Trusted, separately owner-reviewed receipt. Never construct this from observed DB state. */
export interface PhoneApproval {
  operation: 'phone-seventh-only';
  permission: 'B' | 'C';
  target: PhoneTarget;
  schemaFormat: typeof PHONE_SCHEMA_FORMAT;
  beforeObjects: readonly CatalogKey[];
  afterObjects: readonly CatalogKey[];
  beforeSha256: string;
  afterSha256: string;
}

export function requirePhoneApproval(a: PhoneApproval | null, mode: string): asserts a is PhoneApproval {
  if (!a || (mode !== 'preflight' && mode !== 'apply') ||
      a.operation !== 'phone-seventh-only' || a.permission !== (mode === 'apply' ? 'C' : 'B') ||
      a.schemaFormat !== PHONE_SCHEMA_FORMAT || !a.beforeObjects.length || !a.afterObjects.length ||
      !/^[a-f0-9]{64}$/.test(a.beforeSha256) || !/^[a-f0-9]{64}$/.test(a.afterSha256) ||
      a.beforeSha256 === a.afterSha256) throw new Error('PHONE_AUTHORIZATION_REQUIRED');
  assertPhoneTarget(a.target);
  orderedKeys(a.beforeObjects); orderedKeys(a.afterObjects);
}

export interface PhoneFacts {
  identity: Record<string, string>;
  history: Array<{ timestamp: string; name: string }>;
  emailUnique: boolean;
  schemaSha256: string;
  catalogObjects: CatalogKey[];
  addedColumns: string[];
  addedConstraints: string[];
}
const columns = [
  'marketing_preferences.smsMarketing', 'marketing_preferences.smsMarketingConsentVersion',
  'marketing_preferences.smsMarketingGrantedAt', 'marketing_preferences.smsMarketingRevokedAt',
  'users.phone_e164', 'users.phone_verified', 'users.phone_verified_at',
].sort();
const constraints = ['CK_marketing_sms_consent', 'CK_users_phone_e164', 'CK_users_phone_verification'].sort();

export function validatePhoneFacts(f: PhoneFacts, a: PhoneApproval, after = false): void {
  const t = a.target;
  const expected = { database: t.database, role: t.role, address: t.address, port: String(t.port),
    oid: t.oid, systemIdentifier: t.systemIdentifier, serverVersionNum: t.serverVersionNum };
  if (Object.entries(expected).some(([k, v]) => f.identity[k] !== v)) throw new Error('PHONE_IDENTITY_MISMATCH');
  const history: readonly (readonly string[])[] = after
    ? [...PHONE_PREVIOUS, [PHONE_TIMESTAMP, PHONE_MIGRATION]] : PHONE_PREVIOUS;
  if (JSON.stringify(f.history.map(r => [r.timestamp, r.name])) !== JSON.stringify(history)) {
    throw new Error('PHONE_HISTORY_MISMATCH');
  }
  if (!f.emailUnique) throw new Error('PHONE_EMAIL_UNIQUE_MISMATCH');
  if (JSON.stringify([...f.addedColumns].sort()) !== JSON.stringify(after ? columns : []) ||
      JSON.stringify([...f.addedConstraints].sort()) !== JSON.stringify(after ? constraints : []) ||
      canonical(orderedKeys(f.catalogObjects)) !== canonical(orderedKeys(after ? a.afterObjects : a.beforeObjects)) ||
      f.schemaSha256 !== (after ? a.afterSha256 : a.beforeSha256)) throw new Error('PHONE_SCHEMA_MISMATCH');
}

/** Catalog-only fingerprint. Excludes rows, sequence counters and physical storage identifiers.
 * Expected hashes must be independently reviewed against the six migration sources on the
 * exact approved PostgreSQL version; this module deliberately supplies no default hashes.
 */
export const PHONE_CATALOG_SQL = `WITH objects AS (
 SELECT 'namespace' AS kind, nspname AS key, jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl) AS body
 FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname <> 'information_schema'
 UNION ALL SELECT 'relation', n.nspname||'.'||c.relname,
 jsonb_build_object('kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,
 'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'persistence',c.relpersistence,'options',c.reloptions)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'column', c.relname||'.'||a.attname,
 jsonb_build_object('position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),
 'notnull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
 'default',pg_get_expr(d.adbin,d.adrelid),'collation',a.attcollation::regcollation::text,'acl',a.attacl)
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'constraint', COALESCE(c.relname,x.contypid::regtype::text)||'.'||x.conname,
 jsonb_build_object('definition',pg_get_constraintdef(x.oid),'validated',x.convalidated,
 'type',x.contype,'local',x.conislocal,'inheritCount',x.coninhcount,'noInherit',x.connoinherit,
 'referencedRelation',CASE WHEN x.confrelid=0 THEN NULL ELSE x.confrelid::regclass::text END)
 FROM pg_constraint x LEFT JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=x.connamespace
 WHERE n.nspname='public'
 UNION ALL SELECT 'index', c.relname, jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'valid',i.indisvalid,'ready',i.indisready)
 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'trigger', c.relname||'.'||t.tgname, jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'policy', c.relname||'.'||p.polname, to_jsonb(p)-'oid'-'polrelid'
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'type', t.typname, jsonb_build_object('kind',t.typtype,'owner',pg_get_userbyid(t.typowner),
 'acl',t.typacl,'base',format_type(t.typbasetype,t.typtypmod),'notnull',t.typnotnull,
 'default',t.typdefault,'element',t.typelem::regtype::text,'collation',t.typcollation::regcollation::text,'labels',
 (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid))
 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'routine', p.oid::regprocedure::text, jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')
 UNION ALL SELECT 'extension', extname, jsonb_build_object('version',extversion,'schema',extnamespace::regnamespace::text) FROM pg_extension
 UNION ALL SELECT 'view', c.relname, jsonb_build_object('definition',pg_get_viewdef(c.oid,false),
 'kind',c.relkind,'populated',c.relispopulated)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('v','m')
 UNION ALL SELECT 'rule', c.relname||'.'||r.rulename,
 jsonb_build_object('definition',pg_get_ruledef(r.oid,false),'enabled',r.ev_enabled)
 FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'sequence', c.relname,
 jsonb_build_object('type',format_type(s.seqtypid,NULL),'start',s.seqstart::text,'increment',s.seqincrement::text,
 'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle)
 FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
 UNION ALL SELECT 'dependency', jsonb_build_array(d.classid::regclass::text,o.type,o.schema,o.identity,d.objsubid,
 d.refclassid::regclass::text,r.type,r.schema,r.identity,d.refobjsubid,d.deptype)::text,
 jsonb_build_object('dependencyType',d.deptype)
 FROM pg_depend d CROSS JOIN LATERAL pg_identify_object(d.classid,d.objid,d.objsubid) o
 CROSS JOIN LATERAL pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) r
 WHERE o.schema='public' OR r.schema='public'
 UNION ALL SELECT 'default-acl', jsonb_build_array(pg_get_userbyid(a.defaclrole),n.nspname,a.defaclobjtype)::text,
 jsonb_build_object('acl',a.defaclacl)
 FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid=a.defaclnamespace
 WHERE a.defaclnamespace=0 OR n.nspname='public'
 UNION ALL SELECT 'effective-privileges', current_user::text,
 jsonb_build_object('schemaUsage',has_schema_privilege(current_user,'public','USAGE'),
 'schemaCreate',has_schema_privilege(current_user,'public','CREATE'),
 'databaseCreate',has_database_privilege(current_user,current_database(),'CREATE'),
 'databaseTemp',has_database_privilege(current_user,current_database(),'TEMP'),
 'superuser',r.rolsuper,'createRole',r.rolcreaterole,'createDb',r.rolcreatedb,
 'inherit',r.rolinherit,'bypassRls',r.rolbypassrls)
 FROM pg_roles r WHERE r.rolname=current_user
 UNION ALL SELECT 'effective-privileges', 'public.'||c.relname,
 CASE WHEN c.relkind='S' THEN jsonb_build_object('usage',has_sequence_privilege(current_user,c.oid,'USAGE'),
 'select',has_sequence_privilege(current_user,c.oid,'SELECT'),'update',has_sequence_privilege(current_user,c.oid,'UPDATE'))
 ELSE jsonb_build_object('select',has_table_privilege(current_user,c.oid,'SELECT'),
 'insert',has_table_privilege(current_user,c.oid,'INSERT'),'update',has_table_privilege(current_user,c.oid,'UPDATE'),
 'delete',has_table_privilege(current_user,c.oid,'DELETE'),'truncate',has_table_privilege(current_user,c.oid,'TRUNCATE'),
 'references',has_table_privilege(current_user,c.oid,'REFERENCES'),'trigger',has_table_privilege(current_user,c.oid,'TRIGGER')) END
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v','m','S')
 UNION ALL SELECT 'role-membership', jsonb_build_array(pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor))::text,
 jsonb_build_object('admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)
 FROM pg_auth_members m
 ) SELECT kind,key,body FROM objects ORDER BY kind COLLATE "C",key COLLATE "C",body::text COLLATE "C"`;

/** Closed supported surface: unhandled object families never silently disappear from a hash.
 * Counts/metadata only; no server options, user mappings, role passwords or user rows.
 */
export const PHONE_UNSUPPORTED_SQL = `SELECT (
 (SELECT count(*) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('public','information_schema')) +
 (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND (c.relkind NOT IN ('r','i','S','v','m') OR c.relispartition)) +
 (SELECT count(*) FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') +
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind NOT IN ('f','p')) +
 (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
   WHERE n.nspname='public' AND NOT (t.typtype IN ('c','e','d') OR (t.typtype='b' AND t.typelem<>0))) +
 (SELECT count(*) FROM pg_event_trigger) + (SELECT count(*) FROM pg_foreign_server) +
 (SELECT count(*) FROM pg_foreign_data_wrapper) + (SELECT count(*) FROM pg_publication) +
 (SELECT count(*) FROM pg_collation WHERE collnamespace='public'::regnamespace) +
 (SELECT count(*) FROM pg_operator WHERE oprnamespace='public'::regnamespace) +
 (SELECT count(*) FROM pg_opclass WHERE opcnamespace='public'::regnamespace) +
 (SELECT count(*) FROM pg_opfamily WHERE opfnamespace='public'::regnamespace) +
 (SELECT count(*) FROM pg_conversion WHERE connamespace='public'::regnamespace) +
 (SELECT count(*) FROM pg_ts_config WHERE cfgnamespace='public'::regnamespace) +
 (SELECT count(*) FROM pg_ts_dict WHERE dictnamespace='public'::regnamespace) +
 (SELECT count(*) FROM pg_ts_parser WHERE prsnamespace='public'::regnamespace) +
 (SELECT count(*) FROM pg_ts_template WHERE tmplnamespace='public'::regnamespace)
 )::text AS count`;

export async function inspectPhoneDatabase(q: QueryRunner, a: PhoneApproval, after = false): Promise<PhoneFacts> {
  const identityRows = await q.query(`SELECT current_database() AS database,current_user AS role,
    inet_server_addr()::text AS address,inet_server_port()::text AS port,
    (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,
    (SELECT system_identifier::text FROM pg_control_system()) AS "systemIdentifier",
    current_setting('server_version_num') AS "serverVersionNum"`);
  if (identityRows.length !== 1) throw new Error('PHONE_IDENTITY_MISMATCH');
  const unsupported = await q.query(PHONE_UNSUPPORTED_SQL);
  if (unsupported.length !== 1 || unsupported[0].count !== '0') throw new Error('PHONE_UNSUPPORTED_CATALOG_OBJECT');
  // No history-table discovery/bootstrap: missing or unexpected history is an error.
  const history = await q.query('SELECT timestamp::text AS timestamp,name FROM public.migrations ORDER BY id');
  const unique = await q.query(`SELECT count(*)::int AS count FROM pg_constraint c
    JOIN pg_index i ON i.indexrelid=c.conindid
    WHERE c.conrelid='public.users'::regclass AND c.conname='UQ_users_email' AND c.contype='u'
    AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred
    AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='email')]::smallint[]
    AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL`);
  const added = await q.query(`SELECT table_name||'.'||column_name AS name FROM information_schema.columns
    WHERE table_schema='public' AND (column_name LIKE 'phone_%' OR column_name LIKE 'smsMarketing%') ORDER BY 1`);
  const checks = await q.query(`SELECT conname AS name FROM pg_constraint WHERE connamespace='public'::regnamespace
    AND (conname LIKE 'CK_users_phone%' OR conname LIKE 'CK_marketing_sms%') ORDER BY 1`);
  const catalog: CatalogObject[] = await q.query(PHONE_CATALOG_SQL);
  return { identity: identityRows[0], history, emailUnique: unique.length === 1 && unique[0].count === 1,
    addedColumns: added.map((r: { name: string }) => r.name), addedConstraints: checks.map((r: { name: string }) => r.name),
    catalogObjects: orderedKeys(catalog),
    schemaSha256: fingerprintPhoneCatalog(catalog, after ? a.afterObjects : a.beforeObjects) };
}
