/** Configuration only: no database activity or application imports. */
export function required(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name];
  if (!value || /[\r\n\0]/.test(value)) throw new Error('HISTORICAL_CONFIG_REQUIRED_' + name);
  return value;
}
/** Validate without trimming/replacing the signing key used by existing sessions. */
export function requiredJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.JWT_SECRET;
  if (typeof value !== 'string' || !value.trim() || /[\r\n\0]/.test(value)) {
    throw new Error('HISTORICAL_CONFIG_REQUIRED_JWT_SECRET');
  }
  return value;
}
export function localConfiguration(env: NodeJS.ProcessEnv = process.env) {
  if (required('HISTORICAL_LOCAL', env) !== 'true') throw new Error('HISTORICAL_LOCAL_OPT_IN_REQUIRED');
  if (required('DB_HOST', env) !== 'historical-postgres' || required('DB_NAME', env) !== 'cashback_historical_03573b7' || !['cashback_hist_runtime','cashback_hist_moderated_runtime'].includes(required('DB_USER', env)) || required('DB_PORT', env) !== '5432') throw new Error('HISTORICAL_DATABASE_BOUNDARY');
  if(env.CASHBACK_CONTENT_MODERATION==='true' && env.DB_USER!=='cashback_hist_moderated_runtime')throw new Error('MODERATION_REQUIRES_VERSIONED_RUNTIME_ROLE');
  if (required('FRONTEND_URL', env) !== 'http://localhost:3004' || required('PORT', env) !== '3006') throw new Error('HISTORICAL_ORIGIN_BOUNDARY');
  const host=required('HOST',env);
  if (host !== '127.0.0.1' && !(host === '0.0.0.0' && env.HISTORICAL_CONTAINER === 'true')) throw new Error('HISTORICAL_BIND_BOUNDARY');
  if (required('SMTP_HOST',env) !== 'historical-mailpit' || required('SMTP_PORT',env) !== '1025' || env.USE_ETHEREAL !== 'false') throw new Error('HISTORICAL_MAIL_BOUNDARY');
  if (requiredJwtSecret(env).length < 32) throw new Error('HISTORICAL_JWT_REQUIRED');
  return {host,port:3006,origin:'http://localhost:3004',database:{type:'postgres' as const,host:'historical-postgres',port:5432,username:required('DB_USER',env),password:required('DB_PASSWORD',env),database:'cashback_historical_03573b7',autoLoadEntities:true,synchronize:false,migrationsRun:false,installExtensions:false,retryAttempts:0,extra:{max:3,connectionTimeoutMillis:5000},logging:false as const}};
}
