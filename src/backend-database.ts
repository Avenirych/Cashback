import { verifyFunctionalStaging } from './staging-functional';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { backendConfiguration } from './backend-configuration';

type IdentitySource = Pick<DataSource, 'initialize' | 'query' | 'destroy' | 'isInitialized'>;
/** No DDL/DML. Connection identity must pass before Nest can instantiate feature modules. */
export async function initializeBackendSource(source: IdentitySource, config = backendConfiguration()) {
  try {
    await source.initialize();
    const requireSessions = async () => {
      const schema = await source.query(`SELECT NOT pg_is_in_recovery() AS primary,
        EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users'
          AND column_name='session_version' AND data_type='integer' AND is_nullable='NO' AND column_default='0')
        AND EXISTS(SELECT 1 FROM pg_catalog.pg_constraint c WHERE c.conrelid='public.users'::regclass
          AND c.conname='CK_users_session_version_nonnegative' AND c.contype='c' AND c.convalidated
          AND pg_catalog.pg_get_constraintdef(c.oid)='CHECK ((session_version >= 0))') AS ready`);
      if(schema.length!==1 || schema[0].primary!==true || schema[0].ready!==true)
        throw new Error('SESSION_SCHEMA_REQUIRED');
      const grants=await source.query("SELECT has_column_privilege(current_user,'public.users','session_version','SELECT') AS readable, has_column_privilege(current_user,'public.users','session_version','UPDATE') AS writable");
      if(grants.length!==1||grants[0].readable!==true||grants[0].writable!==true)throw new Error('SESSION_SCHEMA_REQUIRED');
    };
    if (config.profile !== 'staging') { await requireSessions(); return source; }
    const rows = await source.query(`SELECT pg_catalog.current_database() AS database, current_user AS username,
      (SELECT system_identifier::text FROM pg_catalog.pg_control_system()) AS cluster,
      pg_catalog.current_setting('server_version_num')::integer AS version,
      r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolbypassrls
      FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`);
    const actual = rows[0];
    if (rows.length !== 1 || !actual || !Number.isInteger(actual.version) || actual.cluster !== config.expectedCluster || actual.database !== config.database.database ||
        actual.username !== config.database.username || actual.version < 170000 || actual.version >= 180000 ||
        actual.rolsuper !== false || actual.rolcreaterole !== false || actual.rolcreatedb !== false || actual.rolbypassrls !== false) {
      throw new Error('STAGING_DATABASE_IDENTITY_REFUSED');
    }
    await requireSessions();
    await verifyFunctionalStaging(source, config.functional);
    return source;
  } catch (error) {
    if (source.isInitialized) { try { await source.destroy(); } catch { /* Preserve safe refusal. */ } }
    if (config.profile === 'staging') throw new Error('STAGING_DATABASE_IDENTITY_REFUSED');
    throw error;
  }
}
export async function createBackendDataSource(options?: DataSourceOptions): Promise<DataSource> {
  if (!options) throw new Error('BACKEND_DATABASE_OPTIONS_REQUIRED');
  const config = backendConfiguration();
  if (config.profile === 'staging') {
    const schema = options as { synchronize?: boolean; migrationsRun?: boolean; installExtensions?: boolean };
    if (schema.synchronize !== false || schema.migrationsRun !== false || schema.installExtensions !== false) throw new Error('STAGING_SCHEMA_AUTOMATION_REFUSED');
  }
  const source = new DataSource(options);
  await initializeBackendSource(source, config);
  return source;
}
