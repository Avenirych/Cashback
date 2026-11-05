import { randomBytes } from 'node:crypto';
import { backendConfiguration, backendProfile } from './backend-configuration';
import { MailService } from './mail/mail.service';
import * as nodemailer from 'nodemailer';
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
import { createBackendDataSource, initializeBackendSource } from './backend-database';
import { verificationFrontendOrigin } from './mail/verification-origin';

function staging(): NodeJS.ProcessEnv {
  return { CASHBACK_BACKEND_PROFILE: 'staging', NODE_ENV: 'production', HISTORICAL_LOCAL: 'false', HISTORICAL_CONTAINER: 'false',
    HOST: '127.0.0.1', PORT: '3106', DB_HOST: 'postgres.staging.example.test', DB_PORT: '5432', DB_NAME: 'cashback_staging_test',
    DB_USER: 'cashback_staging_runtime', DB_PASSWORD: randomBytes(16).toString('hex'), DB_SSL: 'true', STAGING_DB_SYSTEM_IDENTIFIER: '7700000000000000001',
    JWT_SECRET: randomBytes(32).toString('hex'), FRONTEND_URL: 'https://stage.example.test', VERIFICATION_FRONTEND_URL: 'https://stage.example.test',
    SMTP_HOST: 'smtp.staging.example.test', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_REQUIRE_TLS: 'true', SMTP_FROM: 'noreply@example.test',
    SMTP_USER: 'isolated-test', SMTP_PASSWORD: randomBytes(16).toString('hex'), USE_ETHEREAL: 'false', CASHBACK_DEMO_ONLY: 'true',
    CASHBACK_ACTIVITY_LIMITS: 'true', CASHBACK_FORUM_READ_ONLY: 'true', CASHBACK_PUBLIC_CONTENT: 'false', CASHBACK_CONTENT_MODERATION: 'false',
    CASHBACK_LOCAL_DEMO_REVIEWS: 'false', CASHBACK_FINANCIAL_ADMISSION: 'false', CASHBACK_FINANCIAL_API: 'false', CASHBACK_FINANCIAL_WRITES: 'false' };
}
test('separate staging profile uses non-migrating TLS DB, explicit HTTPS origins and SMTP', () => {
  const c = backendConfiguration(staging());
  expect(c).toMatchObject({profile:'staging',origin:'https://stage.example.test',verificationOrigin:'https://stage.example.test',port:3106});
  expect(c.database).toMatchObject({database:'cashback_staging_test',synchronize:false,migrationsRun:false,installExtensions:false,ssl:{rejectUnauthorized:true}});
  expect(c.smtp).toMatchObject({port:465,secure:true,requireTLS:true,tls:{rejectUnauthorized:true}});
});
test.each(Object.keys(staging()))('missing mandatory staging %s refuses', key => {
  const env=staging(); delete env[key]; expect(()=>backendConfiguration(env)).toThrow();
});
test.each(['FRONTEND_URL','VERIFICATION_FRONTEND_URL'])('%s rejects non-public or malformed origins', key => {
  for(const origin of ['http://stage.example.test','https://localhost','https://127.0.0.1','https://127.1','https://[::1]','https://foo.localhost','https://user:pass@stage.example.test','https://stage.example.test/path','https://stage.example.test?x=1','https://stage.example.test#x','https://stage.example.test/','null','https://stage.example.test\n']) {
    expect(()=>backendConfiguration({...staging(),[key]:origin})).toThrow();
  }
});
test.each([
  {DB_NAME:'cashback_historical_03573b7'},{DB_HOST:'historical-postgres'},{DB_USER:'cashback_hist_runtime'},
  {STAGING_DB_SYSTEM_IDENTIFIER:'7698666936429441062'},{STAGING_DB_SYSTEM_IDENTIFIER:'unproven'},
  {HISTORICAL_LOCAL:'true'},{HISTORICAL_CONTAINER:'true'},{NODE_ENV:'development'},
  {CASHBACK_BACKEND_PROFILE:'unknown'},{DB_SSL:'false'},{DATABASE_URL:'not-used'},
  {DB_MIGRATIONS_RUN:'true'},{TYPEORM_SYNCHRONIZE:'true'},{NODE_TLS_REJECT_UNAUTHORIZED:'0'},
  {CASHBACK_FINANCE_ENABLED:'true'},{CASHBACK_FINANCIAL_WRITES:'true'},{CASHBACK_FINANCIAL_API:'true'},
  {CASHBACK_FINANCIAL_ADMISSION:'true'},{CASHBACK_PUBLIC_CONTENT:'true'},
  {SMTP_HOST:'historical-mailpit'},{SMTP_PORT:'1025'},{SMTP_REQUIRE_TLS:'false'},{SMTP_SECURE:'unknown'},
  {SMTP_PORT:'587',SMTP_SECURE:'true'},{SMTP_FROM:'bad\r\nvalue'}, {USE_ETHEREAL:'true'},
  {VERIFICATION_FRONTEND_URL:'https://other.example.test'},{JWT_SECRET:'too-short'},{PORT:'0'},{DB_PORT:'65536'}, {DB_PASSWORD:'\n'}
])('staging fail-closed %#', change => expect(()=>backendConfiguration({...staging(),...change})).toThrow());
test('explicit STARTTLS587 is accepted without certificate bypass',()=>expect(backendConfiguration({...staging(),SMTP_PORT:'587',SMTP_SECURE:'false'}).smtp).toMatchObject({secure:false,requireTLS:true,tls:{rejectUnauthorized:true}}));
test('staging mail ignores every request Origin and uses configured verification origin',()=>{
  for(const origin of ['https://evil.example.test','http://localhost:3005',undefined]) expect(verificationFrontendOrigin(origin,staging())).toBe('https://stage.example.test');
});
test('production is not an alias for staging and is reserved/closed',()=>expect(()=>backendConfiguration({...staging(),CASHBACK_BACKEND_PROFILE:'production'})).toThrow('PRODUCTION_NOT_APPROVED'));
test('mode is not selected from NODE_ENV; historical launcher default remains development',()=>expect(backendProfile({NODE_ENV:'production'})).toBe('development'));
const identity={database:'cashback_staging_test',username:'cashback_staging_runtime',cluster:'7700000000000000001',version:170011,rolsuper:false,rolcreaterole:false,rolcreatedb:false,rolbypassrls:false};
function source(actual:unknown=identity) { return {isInitialized:true,initialize:jest.fn(async()=>undefined),query:jest.fn(async(_sql?: string)=>_sql?.includes('pg_is_in_recovery')?[{primary:true,ready:true}]:_sql?.includes('has_column_privilege')?[{readable:true,writable:true}]:[actual]),destroy:jest.fn(async()=>undefined)}; }
test('connection identity checked before returning staged source; only SELECT issued',async()=>{
  const s=source();await initializeBackendSource(s as any,backendConfiguration(staging()));expect(s.query).toHaveBeenCalledTimes(3);for(const [sql] of s.query.mock.calls)expect(sql).toMatch(/^SELECT/);expect(s.destroy).not.toHaveBeenCalled();
});
test.each([{cluster:'7698666936429441062'},{cluster:'7700000000000000002'},{database:'cashback_historical_03573b7'},{username:'cashback_hist_owner'},{version:160000},{version:undefined},{version:null},{version:'170011'},{rolsuper:true},{rolcreaterole:true},{rolcreatedb:true},{rolbypassrls:true}])('connection alias/spoof/privilege mismatch fails %#',async change=>{
  const s=source({...identity,...change});await expect(initializeBackendSource(s as any,backendConfiguration(staging()))).rejects.toThrow('STAGING_DATABASE_IDENTITY_REFUSED');expect(s.destroy).toHaveBeenCalledTimes(1);
});
test('identity permission denied: close source, no grant/repair, no sensitive driver error',async()=>{
  const s=source();s.query.mockRejectedValueOnce(new Error('sensitive driver detail') as never);await expect(initializeBackendSource(s as any,backendConfiguration(staging()))).rejects.toThrow('STAGING_DATABASE_IDENTITY_REFUSED');expect(s.destroy).toHaveBeenCalled();
});

test('failed connection initialization is generic and never discloses driver details',async()=>{
 const s=source();s.isInitialized=false;s.initialize.mockRejectedValueOnce(new Error('credential detail') as never);
 await expect(initializeBackendSource(s as any,backendConfiguration(staging()))).rejects.toThrow('STAGING_DATABASE_IDENTITY_REFUSED');expect(s.query).not.toHaveBeenCalled();
});
test('ambiguous identity result is refused',async()=>{
 const s=source();s.query.mockResolvedValueOnce([identity,identity]);
 await expect(initializeBackendSource(s as any,backendConfiguration(staging()))).rejects.toThrow('STAGING_DATABASE_IDENTITY_REFUSED');
});
test('development source requires session schema even without the staging identity query',async()=>{
 const legacy={HISTORICAL_LOCAL:'true',HISTORICAL_CONTAINER:'true',DB_HOST:'historical-postgres',DB_NAME:'cashback_historical_03573b7',DB_USER:'cashback_hist_runtime',DB_PORT:'5432',DB_PASSWORD:randomBytes(16).toString('hex'),JWT_SECRET:randomBytes(32).toString('hex'),FRONTEND_URL:'http://localhost:3004',PORT:'3006',HOST:'0.0.0.0',SMTP_HOST:'historical-mailpit',SMTP_PORT:'1025',USE_ETHEREAL:'false'};
 const s=source();await initializeBackendSource(s as any,backendConfiguration(legacy));expect(s.query).toHaveBeenCalledTimes(2);expect(s.query.mock.calls[0]?.[0]).toContain('pg_is_in_recovery');expect(s.destroy).not.toHaveBeenCalled();
});

test('staging mail transport enforces TLS and sends only configured frontend origin (mock SMTP)',async()=>{
 const original=process.env;process.env=staging();
 const sendMail=jest.fn().mockResolvedValue({});(nodemailer.createTransport as jest.Mock).mockReturnValue({sendMail});
 try {
  await new MailService().sendVerificationEmail('fixture@example.test',randomBytes(32).toString('hex'),'Fixture','https://untrusted.example.test');
  expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({requireTLS:true,secure:true,port:465,tls:{rejectUnauthorized:true}}));
  expect(sendMail.mock.calls[0][0].html).toContain('https://stage.example.test/verify-email?token=');
  expect(sendMail.mock.calls[0][0].html).not.toContain('untrusted.example.test');
 } finally {process.env=original;}
});
test.each([{synchronize:true,migrationsRun:false,installExtensions:false},{synchronize:false,migrationsRun:true,installExtensions:false},{synchronize:false,migrationsRun:false,installExtensions:true}])('factory refuses automatic schema actions before creating connection %#',async flags=>{
 const original=process.env;process.env=staging();
 try {await expect(createBackendDataSource({type:'postgres',...flags})).rejects.toThrow('STAGING_SCHEMA_AUTOMATION_REFUSED');}
 finally {process.env=original;}
});


test.each([{primary:false,ready:true},{primary:true,ready:false}])('session schema/primary admission fails closed %#',async row=>{
  const s=source();const original=s.query.getMockImplementation()!;
  s.query.mockImplementation(async sql=>sql?.includes('pg_is_in_recovery')?[row]:original(sql));
  await expect(initializeBackendSource(s as any,backendConfiguration(staging()))).rejects.toThrow('STAGING_DATABASE_IDENTITY_REFUSED');
  expect(s.destroy).toHaveBeenCalledTimes(1);
});
test('session update permission missing prevents serving',async()=>{
  const s=source();const original=s.query.getMockImplementation()!;
  s.query.mockImplementation(async sql=>sql?.includes('has_column_privilege')?[{readable:true,writable:false}]:original(sql));
  await expect(initializeBackendSource(s as any,backendConfiguration(staging()))).rejects.toThrow('STAGING_DATABASE_IDENTITY_REFUSED');
  expect(s.destroy).toHaveBeenCalledTimes(1);
});
