import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuthService } from './auth.service';
import { RegistrationReadiness, RegistrationFacts, RegistrationPolicy, REGISTRATION_HISTORY, validateRegistrationReadiness } from './registration-readiness';
const config = JSON.parse(readFileSync(resolve(__dirname, '../../docker/local-registration/compose.registration.json'), 'utf8'));
const env = config.services.backend.environment;
const policy: RegistrationPolicy = {
  cluster: '123', databaseOid: '456', serverVersionNum: '170010', schemaSha256: 'a'.repeat(64), smtpPeer: 'synthetic-private-peer',
  privileges: ['database:CONNECT', 'schema:USAGE', 'users:SELECT', 'users:INSERT', 'users:UPDATE', 'users_id_seq:USAGE',
    'marketing_preferences:SELECT', 'marketing_preferences:INSERT', 'marketing_preferences:UPDATE',
    'marketing_preferences_id_seq:USAGE', 'migrations:SELECT'],
  phoneHarnessEvidence: 'reviewed-after-authorized-harness-apply', targetResolution: 'independently-reviewed',
};
function fixture(): RegistrationFacts {
  return {observedAt: 100000, cluster: policy.cluster, databaseOid: policy.databaseOid, serverVersionNum: policy.serverVersionNum,
    database: 'cashback_docker_test', role: 'cashback_test', schemaSha256: policy.schemaSha256,
    history: REGISTRATION_HISTORY, privileges: [...policy.privileges], memberships: [], superuser: false,
    createDb: false, createRole: false, replication: false, bypassRls: false, ownsObjects: false,
    smtpPeer: policy.smtpPeer, smtpHandshake: true};
}
test('pure policy accepts fresh complete synthetic readiness evidence', () => {
  expect(() => validateRegistrationReadiness(fixture(), policy, env, 100000)).not.toThrow();
});
const changes: [string, (facts: RegistrationFacts) => void][] = [
  ['stale observation', f => {f.observedAt = 94999;}], ['future observation', f => {f.observedAt = 100001;}],
  ['other cluster', f => {f.cluster = '999';}], ['other database OID', f => {f.databaseOid = '999';}],
  ['wrong version', f => {f.serverVersionNum = '180000';}], ['wrong database', f => {f.database = 'user-db';}],
  ['wrong role', f => {f.role = 'registration_bootstrap';}], ['schema drift', f => {f.schemaSha256 = 'b'.repeat(64);}],
  ['baseline only', f => {f.history = REGISTRATION_HISTORY.slice(0,6);}], ['history reordered', f => {f.history = [...REGISTRATION_HISTORY].reverse();}],
  ['extra privilege', f => {f.privileges = [...f.privileges, 'users:DELETE'];}], ['missing privilege', f => {f.privileges = [];}],
  ['role membership', f => {f.memberships = ['other-role'];}], ['superuser', f => {f.superuser = true;}],
  ['create DB', f => {f.createDb = true;}], ['create role', f => {f.createRole = true;}],
  ['replication', f => {f.replication = true;}], ['RLS bypass', f => {f.bypassRls = true;}],
  ['object owner', f => {f.ownsObjects = true;}], ['SMTP not ready', f => {f.smtpHandshake = false;}],
  ['other SMTP peer', f => {f.smtpPeer = 'unapproved-peer';}],
];
test.each(changes)('refuses %s', (_name, change) => {
  const facts = fixture(); change(facts);
  expect(() => validateRegistrationReadiness(facts, policy, env, 100000)).toThrow();
});
test('does not accept an absent independent policy or changed Mailpit guard config', () => {
  expect(() => validateRegistrationReadiness(fixture(), {} as RegistrationPolicy, env, 100000)).toThrow();
  expect(() => validateRegistrationReadiness(fixture(), policy, {...env, DB_HOST: 'localhost'}, 100000)).toThrow();
  expect(() => validateRegistrationReadiness(fixture(), {...policy, privileges: [...policy.privileges, 'users:DELETE']}, env, 100000)).toThrow();
});

const saved = process.env.REGISTRATION_ISOLATED;
afterEach(() => {
  if (saved === undefined) delete process.env.REGISTRATION_ISOLATED;
  else process.env.REGISTRATION_ISOLATED = saved;
  jest.useRealTimers();
});
test('a hanging trusted probe times out without accepting registration', async () => {
  process.env.REGISTRATION_ISOLATED = 'true'; jest.useFakeTimers();
  let observedSignal!: AbortSignal;
  const readiness = new RegistrationReadiness({inspect: signal => {observedSignal = signal; return new Promise(() => {});}}, policy);
  const result = expect(readiness.assertReady()).rejects.toThrow('Isolated registration is blocked');
  jest.advanceTimersByTime(3000);
  await result;
  expect(observedSignal.aborted).toBe(true);
});
test('probe failures return a safe refusal without private diagnostics', async () => {
  process.env.REGISTRATION_ISOLATED = 'true';
  const readiness = new RegistrationReadiness({inspect: async () => {throw new Error('private-synthetic-diagnostic');}}, policy);
  await expect(readiness.assertReady()).rejects.toThrow(/^Isolated registration is blocked:/);
});
test.each(['true', 'TRUE', '', 'typo'])('missing trusted collector/policy blocks isolated flag %s', async flag => {
  process.env.REGISTRATION_ISOLATED = flag;
  await expect(new RegistrationReadiness().assertReady()).rejects.toThrow('Isolated registration is blocked');
});
test('ordinary backend path remains unchanged', async () => {
  delete process.env.REGISTRATION_ISOLATED;
  await expect(new RegistrationReadiness().assertReady()).resolves.toBeUndefined();
  process.env.REGISTRATION_ISOLATED = 'false';
  await expect(new RegistrationReadiness().assertReady()).resolves.toBeUndefined();
});
test('AuthService rejects isolated registration before validation, users lookup/write or mail', async () => {
  process.env.REGISTRATION_ISOLATED = 'true';
  const users = {create: jest.fn(), getByEmail: jest.fn()};
  const mail = {sendVerificationEmail: jest.fn()};
  const service = new AuthService(users as any, {} as any, mail as any);
  await expect(service.register('synthetic@example.test', 'Synthetic1!', 'Synthetic', '+442079460123')).rejects.toThrow('Isolated registration is blocked');
  expect(users.create).not.toHaveBeenCalled(); expect(users.getByEmail).not.toHaveBeenCalled();
  expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
});
