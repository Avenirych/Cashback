import {localConfiguration} from './local-configuration';
const env={HISTORICAL_LOCAL:'true',HISTORICAL_CONTAINER:'true',DB_HOST:'historical-postgres',DB_NAME:'cashback_historical_03573b7',DB_USER:'cashback_hist_runtime',DB_PORT:'5432',DB_PASSWORD:'synthetic-only',JWT_SECRET:'x'.repeat(40),FRONTEND_URL:'http://localhost:3004',PORT:'3006',HOST:'0.0.0.0',SMTP_HOST:'historical-mailpit',SMTP_PORT:'1025',USE_ETHEREAL:'false'};
test('explicit isolated configuration disables every automatic schema mechanism',()=>{const c=localConfiguration(env);expect(c.database).toMatchObject({synchronize:false,migrationsRun:false,installExtensions:false,retryAttempts:0,extra:{max:3}});});
test.each(['HISTORICAL_LOCAL','DB_HOST','DB_NAME','DB_USER','DB_PORT','DB_PASSWORD','JWT_SECRET','FRONTEND_URL','PORT','HOST','SMTP_HOST','SMTP_PORT'])('missing %s fails closed',key=>{expect(()=>localConfiguration({...env,[key]:undefined})).toThrow();});
test.each([{DB_HOST:'localhost'},{DB_NAME:'cashback'},{DB_USER:'postgres'},{HOST:'0.0.0.0',HISTORICAL_CONTAINER:'false'},{USE_ETHEREAL:'true'},{SMTP_HOST:'smtp.example.com'},{FRONTEND_URL:'https://example.com'},{JWT_SECRET:'weak'}])('rejects unsafe configuration %p',change=>expect(()=>localConfiguration({...env,...change})).toThrow());
test('moderation activation requires the separately restricted versioned runtime role',()=>{
 expect(()=>localConfiguration({...env,CASHBACK_CONTENT_MODERATION:'true'})).toThrow('MODERATION_REQUIRES_VERSIONED_RUNTIME_ROLE');
 expect(localConfiguration({...env,DB_USER:'cashback_hist_moderated_runtime',CASHBACK_CONTENT_MODERATION:'true'}).database.username).toBe('cashback_hist_moderated_runtime');
});
