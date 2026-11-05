import { functionalStagingRequested } from './staging-functional';
import { isIP } from 'node:net';
import { localConfiguration, requiredJwtSecret } from './local-configuration';

export type BackendProfile = 'development' | 'staging' | 'production';
const refuse = (code: string): never => { throw new Error('BACKEND_CONFIG_' + code); };
function value(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  if (!v || v !== v.trim() || /[\r\n\0]/.test(v)) return refuse('REQUIRED_' + key);
  return v;
}
export function backendProfile(env: NodeJS.ProcessEnv = process.env): BackendProfile {
  const p = env.CASHBACK_BACKEND_PROFILE;
  if (p === undefined) return 'development'; // Existing historical launchers are unchanged.
  if (p !== 'development' && p !== 'staging' && p !== 'production') return refuse('PROFILE');
  return p;
}
function httpsOrigin(env: NodeJS.ProcessEnv, key: string): string {
  const s = value(env, key);
  let u: URL;
  try { u = new URL(s); } catch { return refuse('ORIGIN_' + key); }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (u.protocol !== 'https:' || u.origin !== s || u.username || u.password ||
      u.pathname !== '/' || u.search || u.hash || !host.includes('.') || host.endsWith('.') || isIP(host) ||
      /(^|\.)(localhost|local|internal)$/.test(host)) return refuse('ORIGIN_' + key);
  return u.origin;
}
function port(env: NodeJS.ProcessEnv, key: string): number {
  const s = value(env, key);
  if (!/^[1-9]\d{0,4}$/.test(s) || Number(s) > 65535) return refuse('PORT_' + key);
  return Number(s);
}
function host(env: NodeJS.ProcessEnv, key: string): string {
  const h = value(env, key);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(h) || /^(historical-postgres|historical-mailpit|localhost)$/i.test(h) ||
      h.toLowerCase().endsWith('.localhost') || h === '127.0.0.1') return refuse('HOST_' + key);
  return h;
}
export function backendConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const profile = backendProfile(env);
  const functional = functionalStagingRequested(env);
  if (profile === 'production') return refuse('PRODUCTION_NOT_APPROVED');
  if (profile === 'development') {
    if (env.CASHBACK_BACKEND_PROFILE === 'development' && env.NODE_ENV === 'production') return refuse('MODE_CONFLICT');
    const legacy = localConfiguration(env);
    return { ...legacy, profile, functional: false, verificationOrigin: legacy.origin, expectedCluster: null, smtp: null };
  }
  if (env.NODE_ENV !== 'production') return refuse('STAGING_NODE_ENV'); // Runtime optimization, not profile selection.
  const flags: Record<string, string> = {
    HISTORICAL_LOCAL: 'false', HISTORICAL_CONTAINER: 'false', USE_ETHEREAL: 'false',
    CASHBACK_DEMO_ONLY: 'true', CASHBACK_ACTIVITY_LIMITS: 'true', CASHBACK_FORUM_READ_ONLY: 'true',
    CASHBACK_PUBLIC_CONTENT: 'false', CASHBACK_CONTENT_MODERATION: 'false', CASHBACK_LOCAL_DEMO_REVIEWS: 'false',
    CASHBACK_FINANCIAL_ADMISSION: 'false', CASHBACK_FINANCIAL_API: 'false', CASHBACK_FINANCIAL_WRITES: 'false',
  };
  for (const [key, expected] of Object.entries(flags)) if (env[key] !== expected) return refuse('FLAG_' + key);
  for (const key of ['DATABASE_URL', 'DB_MIGRATIONS_RUN', 'TYPEORM_SYNCHRONIZE']) {
    if (env[key] !== undefined && env[key] !== '' && env[key] !== 'false') return refuse('OVERRIDE_' + key);
  }
  for (const [key, setting] of Object.entries(env)) {
    if (/^(CASHBACK_)?FINANC(?:E|IAL)_/.test(key) && setting !== undefined && setting !== '' && setting !== 'false') return refuse('FINANCIAL_FLAG');
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || env.SMTP_TLS_REJECT_UNAUTHORIZED === 'false') return refuse('TLS_OVERRIDE');
  const database = value(env, 'DB_NAME'), username = value(env, 'DB_USER');
  if (!/^cashback_staging_[a-z0-9_]{1,40}$/.test(database) || !/^cashback_staging_[a-z0-9_]{1,40}$/.test(username)) return refuse('STAGING_DB_NAMESPACE');
  const expectedCluster = value(env, 'STAGING_DB_SYSTEM_IDENTIFIER');
  if (!/^\d{19,20}$/.test(expectedCluster) || expectedCluster === '7698666936429441062') return refuse('STAGING_CLUSTER');
  if (env.DB_SSL !== 'true') return refuse('DB_TLS');
  const origin = httpsOrigin(env, 'FRONTEND_URL'), verificationOrigin = httpsOrigin(env, 'VERIFICATION_FRONTEND_URL');
  if (verificationOrigin !== origin) return refuse('VERIFICATION_ORIGIN_MISMATCH');
  const secret = requiredJwtSecret(env);
  if (secret.length < 32 || secret !== secret.trim()) return refuse('JWT_SECRET');
  const bind = value(env, 'HOST');
  if (!['127.0.0.1', '0.0.0.0'].includes(bind)) return refuse('BIND');
  const smtpHost = host(env, 'SMTP_HOST'), smtpPort = port(env, 'SMTP_PORT');
  if (env.SMTP_REQUIRE_TLS !== 'true' || !['true', 'false'].includes(env.SMTP_SECURE || '') ||
      (env.SMTP_SECURE === 'true' ? smtpPort !== 465 : smtpPort !== 587)) return refuse('SMTP_TLS');
  const from = value(env, 'SMTP_FROM');
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(from)) return refuse('SMTP_FROM');
  const smtp = { host: smtpHost, port: smtpPort, secure: env.SMTP_SECURE === 'true', requireTLS: true,
    auth: { user: value(env, 'SMTP_USER'), pass: value(env, 'SMTP_PASSWORD') },
    tls: { rejectUnauthorized: true }, from };
  return { profile, functional, host: bind, port: port(env, 'PORT'), origin, verificationOrigin, expectedCluster, smtp,
    database: { type: 'postgres' as const, host: host(env, 'DB_HOST'), port: port(env, 'DB_PORT'),
      username, password: value(env, 'DB_PASSWORD'), database, ssl: { rejectUnauthorized: true },
      autoLoadEntities: true, synchronize: false, migrationsRun: false, installExtensions: false,
      retryAttempts: 0, extra: { max: 3, connectionTimeoutMillis: 5000 }, logging: false as const } };
}
