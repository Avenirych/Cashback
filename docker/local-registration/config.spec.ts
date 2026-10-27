import {localConfiguration} from '../../src/local-configuration';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateLocalDemoMailpit } from './legacy-source/src/mail/local-demo-mailpit';

// In-memory parsing only. No dotenv, AppModule, datasource, child process or sockets.
const root = resolve(__dirname, '../..');
const text = readFileSync(resolve(__dirname, 'compose.registration.json'), 'utf8');
const config = JSON.parse(text);
const project = 'cashback-registration-20261016-4f8c2a96b17d';
const services = config.services;
const env = services.backend.environment;

test('standalone JSON is valid YAML with a distinct project and exact service roster', () => {
  const yaml = require('js-yaml') as {load: (text: string) => unknown};
  expect(yaml.load(text)).toEqual(config);
  expect(config.name).toBe(project);
  expect(Object.keys(services).sort()).toEqual(['backend', 'frontend', 'mailpit', 'mailpit-ui', 'postgres-test']);
  expect(config).not.toHaveProperty('include');
});

test('one private fresh cluster volume has no existing-data mount or init hook', () => {
  expect(Object.keys(config.volumes)).toEqual(['registration-pg17-data']);
  expect(config.volumes['registration-pg17-data'].name).toBe(`${project}-pg17-data`);
  expect(config.volumes['registration-pg17-data']).not.toHaveProperty('external');
  expect(services['postgres-test'].volumes).toEqual([{
    type: 'volume', source: 'registration-pg17-data', target: '/var/lib/postgresql/data', volume: {nocopy: true},
  }]);
  expect(services['postgres-test'].environment.POSTGRES_USER).toBe('registration_bootstrap');
  expect(env.DB_USER).toBe('cashback_test');
  expect(env.DB_PASSWORD).not.toBe(services['postgres-test'].environment.POSTGRES_PASSWORD);
  expect(services['postgres-test'].image).toBe('${REGISTRATION_POSTGRES17_IMAGE:?Reviewed PostgreSQL 17 image with digest required}');
  for (const service of Object.values(services) as Record<string, unknown>[]) {
    for (const key of ['env_file', 'extends', 'container_name', 'network_mode', 'extra_hosts', 'links', 'privileged', 'configs', 'secrets']) {
      expect(service).not.toHaveProperty(key);
    }
    expect(service).not.toHaveProperty('post_start');
    expect(service).not.toHaveProperty('pre_stop');
  }
  expect(text).not.toMatch(/docker-entrypoint-initdb|synchronize|migration:run|typeorm|docker\.sock|sqlite|finance-security/i);
});

test('private networks do not attach backend or SMTP to an external-routed bridge', () => {
  expect(Object.keys(config.networks).sort()).toEqual(['application', 'database', 'mail', 'mail-ui'].sort());
  for (const [key, network] of Object.entries(config.networks) as [string, Record<string, unknown>][]) {
    expect(network.name).toBe(`${project}-${key}`);
    expect(network).not.toHaveProperty('external');
    if (key !== 'mail-ui') expect(network.internal).toBe(true);
  }
  expect(services.backend.networks).toEqual(['application', 'database', 'mail']);
  expect(services['postgres-test'].networks).toEqual(['database']);
  expect(services.mailpit.networks).toEqual(['mail']);
  expect(services.frontend.networks).toEqual(['application']);
  expect(services['mailpit-ui'].networks).toEqual(['mail', 'mail-ui']);
});

test('only intended UI/API ports publish on loopback; all app services require explicit profile', () => {
  expect(services.backend.ports).toEqual(['127.0.0.1:3001:3001']);
  expect(services.frontend.ports).toEqual(['127.0.0.1:3003:3000']);
  expect(services['mailpit-ui'].ports).toEqual(['127.0.0.1:8025:8025']);
  for (const name of ['postgres-test', 'mailpit']) expect(services[name]).not.toHaveProperty('ports');
  for (const name of ['backend', 'frontend', 'mailpit', 'mailpit-ui']) {
    expect(services[name].profiles).toEqual(['registration-after-schema-approval']);
    expect(services[name].security_opt).toContain('no-new-privileges:true');
    expect(services[name].cap_drop).toEqual(['ALL']);
  }
});

test('the only bind is the existing read-only fixed-upstream Mailpit proxy', () => {
  const mounts = Object.values(services).flatMap((service: any) => service.volumes ?? []);
  expect(mounts.filter((mount: any) => mount.type === 'bind')).toEqual([{
    type: 'bind', source: '../mailpit-ui.nginx.conf', target: '/etc/nginx/nginx.conf',
    read_only: true, bind: {create_host_path: false},
  }]);
  expect(existsSync(resolve(__dirname, '../mailpit-ui.nginx.conf'))).toBe(true);
  const proxy = readFileSync(resolve(__dirname, '../mailpit-ui.nginx.conf'), 'utf8');
  expect(proxy).toContain('proxy_pass http://mailpit:8025;');
  expect(proxy).toContain('access_log off;');
  expect(services.mailpit.tmpfs).toContain('/mailpit-data:size=64m,mode=1777,noexec,nosuid,nodev');
  expect(services.backend).not.toHaveProperty('volumes');
});

test('actual unchanged Mailpit policy accepts the proposed backend config', () => {
  expect(validateLocalDemoMailpit(env)).toBe(true);
  expect(env.DATABASE_URL).toBe('');
  expect(env.DB_MIGRATIONS_RUN).toBe('false');
  expect(services.mailpit.environment.MP_SMTP_ALLOWED_RECIPIENTS).toBe('@example\\.test$');
  expect(services.mailpit.environment.MP_SMTP_RELAY_ALL).toBe('false');
  expect(services.frontend.environment.REACT_APP_GOOGLE_AUTH_ENABLED).toBe('false');
  expect(services.frontend.environment.REACT_APP_REGISTRATION_ISOLATED).toBe('true');
  expect(env.REGISTRATION_ISOLATED).toBe('true');
});

test.each(['NODE_ENV', 'LOCAL_DEMO_SCENARIO', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
  'USE_ETHEREAL', 'SMTP_FROM', 'FRONTEND_URL', 'DB_HOST', 'DB_PORT', 'DB_NAME',
  'DATABASE_URL', 'SMTP_USER', 'SMTP_PASSWORD'])('Mailpit refuses drift in %s', key => {
  expect(() => validateLocalDemoMailpit({...env, [key]: 'invalid-synthetic-setting'})).toThrow();
});

test('credentials and PG image have no fallback; example contains no usable values', () => {
  const expected = ['REGISTRATION_ADMIN_PASSWORD', 'REGISTRATION_APP_PASSWORD', 'REGISTRATION_JWT_SECRET', 'REGISTRATION_POSTGRES17_IMAGE'];
  const found = [...text.matchAll(/\$\{([A-Z0-9_]+):\?[^}]+\}/g)].map(match => match[1]);
  expect(found.sort()).toEqual(expected.sort());
  expect(text).not.toMatch(/\$\{[^}]+:-/);
  const example = readFileSync(resolve(__dirname, 'registration.env.example'), 'utf8');
  const lines = example.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
  expect(lines.sort()).toEqual(expected.map(key => `${key}=`).sort());
});

test('no backend/schema startup override and existing concurrency gate stays closed', () => {
  expect(services.backend).not.toHaveProperty('command');
  expect(services.backend).not.toHaveProperty('entrypoint');
  expect(services['postgres-test']).not.toHaveProperty('command');
  expect(services['postgres-test']).not.toHaveProperty('entrypoint');
  // Current application delegates database options to this pure, fail-closed factory.
  const current=localConfiguration({HISTORICAL_LOCAL:'true',HISTORICAL_CONTAINER:'true',DB_HOST:'historical-postgres',DB_NAME:'cashback_historical_03573b7',DB_USER:'cashback_hist_runtime',DB_PORT:'5432',DB_PASSWORD:'synthetic-only',JWT_SECRET:'x'.repeat(40),FRONTEND_URL:'http://localhost:3004',PORT:'3006',HOST:'0.0.0.0',SMTP_HOST:'historical-mailpit',SMTP_PORT:'1025',USE_ETHEREAL:'false'});
  expect(current.database).toMatchObject({synchronize:false,migrationsRun:false,installExtensions:false});
  expect(readFileSync(resolve(root,'src/app.module.ts'),'utf8')).toContain('TypeOrmModule.forRoot(localConfiguration().database)');
  // The old generic CLI data source was deliberately archived, not reactivated.
  expect(existsSync(resolve(root,'src/data-source.ts'))).toBe(false);
  const historicalSource=readFileSync(resolve(__dirname,'legacy-source/src/docker-phone-migration-data-source.ts'),'utf8');
  expect(historicalSource).toMatch(/synchronize:\s*false/);
  expect(historicalSource).toMatch(/migrationsRun:\s*false/);
  expect(historicalSource).toContain('PHONE_GENERIC_CLI_FORBIDDEN');
  const runner = readFileSync(resolve(root, 'docker/local-registration/legacy-source/src/docker-phone-migration-runner.ts'), 'utf8');
  expect(runner).toContain('PHONE_APPLY_CONCURRENCY_VERIFIED: boolean = false;');
  expect(readFileSync(resolve(root, 'docker/local-registration/legacy-source/src/docker-phone-migration-data-source.ts'), 'utf8'))
    .toContain('cashback_phone_migration_check_');
});

test('recovered historical dependencies retain independently recorded snapshot hashes', () => {
  const {createHash}=require('node:crypto') as typeof import('node:crypto');
  const archive=resolve(__dirname,'legacy-source');
  const manifest=JSON.parse(readFileSync(resolve(archive,'PROVENANCE.json'),'utf8'));
  expect(manifest.activation).toBe('NOT_AUTHORIZED');
  expect(manifest.files).toHaveLength(24);
  for(const file of manifest.files){
    expect(file.path).toMatch(/^src\/[A-Za-z0-9_./-]+\.ts$/);
    expect(file.path).not.toContain('..');
    const data=readFileSync(resolve(archive,file.path));
    expect(data.length).toBe(file.bytes);
    expect(createHash('sha256').update(data).digest('hex')).toBe(file.sha256);
  }
});

test('recovered historical migrations and modules remain outside application build roots', () => {
  const ts=require('typescript') as typeof import('typescript');
  const file=resolve(root,'tsconfig.build.json');
  const source=ts.readConfigFile(file,ts.sys.readFile);
  expect(source.error).toBeUndefined();
  const parsed=ts.parseJsonConfigFileContent(source.config,ts.sys,root);
  expect(parsed.errors).toHaveLength(0);
  expect(parsed.fileNames.length).toBeGreaterThan(0);
  expect(parsed.fileNames.some(p=>p.includes('legacy-source'))).toBe(false);
  expect(existsSync(resolve(root,'src/migrations/1792195200000-AddUserPhoneAndSmsConsent.ts'))).toBe(false);
  expect(readFileSync(resolve(root,'src/app.module.ts'),'utf8')).not.toContain('legacy-source');
});
