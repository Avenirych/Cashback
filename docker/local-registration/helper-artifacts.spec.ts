import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {configDigest} from './admission';
import {REGISTRATION_PHONE_EXPECTED as E} from '../../src/docker-phone-registration-target';

// Offline only: importing artifacts never invokes a Docker or PostgreSQL command.
const base = resolve(__dirname, 'helpers');
const read = (name:string) => readFileSync(resolve(base,name),'utf8');
const compose = JSON.parse(read('compose.helpers.json'));
const manifest = JSON.parse(read('manifest.draft.json'));
const entry = require('./helpers/helper-entrypoint.cjs') as {main:(args:string[])=>Record<string,unknown>};

describe('source-only helper build and deployment artifacts', () => {
  test('has exactly two helpers and cannot implicitly create or start PostgreSQL/apps', () => {
    expect(compose.name).toBe(E.project);
    expect(Object.keys(compose.services).sort()).toEqual(['migration-executor','observer']);
    for (const service of Object.values(compose.services) as any[]) {
      for (const key of ['build','depends_on','extends','profiles','env_file','environment','ports','expose','links','network_mode','pid','ipc','devices','privileged','volumes_from','post_start','pre_stop']) {
        expect(service).not.toHaveProperty(key);
      }
    }
    expect(compose).not.toHaveProperty('volumes');
    expect(compose).not.toHaveProperty('include');
  });

  test('existing database network is external; only authority network is new/internal', () => {
    expect(compose.networks).toEqual({
      database:{name:E.network,external:true},
      authority:{name:`${E.project}-authority`,internal:true},
    });
    for (const service of Object.values(compose.services) as any[]) {
      expect(service.networks).toEqual(['database','authority']);
    }
    expect(JSON.stringify(compose)).not.toMatch(/cashback-docker-test|cashback-finance-security|docker\.sock|host-gateway/);
  });

  test.each(['migration-executor','observer'])('%s has no host ports, capabilities or writable host bind', serviceName => {
    const s = compose.services[serviceName];
    expect(s.container_name).toBe(`${E.project}-${serviceName}-1`);
    expect(s.platform).toBe('linux/amd64');
    expect(s.user).toBe('999:999');
    expect(s.read_only).toBe(true);
    expect(s.cap_drop).toEqual(['ALL']);
    expect(s).not.toHaveProperty('cap_add');
    expect(s.security_opt).toEqual(['no-new-privileges:true']);
    expect(s.restart).toBe('no');
    expect(s.pids_limit).toBe(64);
    expect(s).not.toHaveProperty('healthcheck'); // A blocked dispatcher must not report readiness.
    expect(s.entrypoint).toEqual(['/usr/local/bin/node']);
    expect(s.command).toEqual(['/opt/cashback/helpers/helper-entrypoint.cjs',serviceName]);
    for (const mount of s.volumes) {
      expect(mount.type).toBe('bind');
      expect(mount.source).toMatch(/^C:\/approved-registration-infrastructure\/(public|executor|observer|review-payloads)$/);
      expect(mount.source).not.toContain('..');
      expect(mount.read_only).toBe(true);
      expect(mount.bind).toEqual({create_host_path:false});
      expect(mount.target).toMatch(/^\/run\/registration\//);
      expect(mount.source).not.toMatch(/fingerprints|receipts|enrollment|ledger/);
    }
    const requiredVariable = serviceName==='observer'?'REGISTRATION_OBSERVER_IMAGE':'REGISTRATION_EXECUTOR_IMAGE';
    expect(s.image).toMatch(new RegExp(`^\\$\\{${requiredVariable}:\\?[^}]+\\}$`));
  });

  test('manifest binds exact template, topology and all hardening configuration without inventing identities', () => {
    expect(manifest.format).toBe('registration-helper-artifacts/v1');
    expect(manifest.status).toBe('DRAFT');
    expect(manifest.target).toEqual({
      context:E.context,daemonId:E.daemonId,project:E.project,platform:E.platform,
      postgresContainerId:E.containerId,postgresImage:E.image,databaseNetwork:E.network,
    });
    expect(manifest.composeFile).toBe('docker/local-registration/helpers/compose.helpers.json');
    expect(manifest.composeTemplateSha256).toBe(configDigest(compose));
    expect(manifest.effectiveComposeSha256).toBeNull();
    expect(manifest.baseImages.node).toBeNull();
    expect(manifest.baseImages.postgres).toBe(E.image);
    expect(manifest.authorityNetwork).toEqual({name:`${E.project}-authority`,id:null,configurationSha256:null,internal:true});
    for (const helper of manifest.helpers) {
      const s = compose.services[helper.service];
      expect(helper.image).toBeNull();
      expect(helper.containerId).toBeNull();
      expect(helper.configurationSha256).toBeNull();
      expect(helper.credentialConfigurationSha256).toBeNull();
      expect(helper.mounts).toEqual(s.volumes);
      expect(helper.networks).toEqual([E.network,`${E.project}-authority`]);
      for(const key of ['user','read_only','cap_drop','security_opt','entrypoint','command']) expect(helper[key]).toEqual(s[key]);
      expect(helper.ports).toEqual([]);
      expect(helper.cap_add).toEqual([]);
    }
    expect(manifest.authorityEndpoints).toBeNull();
    expect(manifest.externalFencingProvider).toBeNull();
    expect(manifest.taskTransport.endpoint).toBe('/helper-task');
    expect(manifest.taskTransport.operations).toEqual(['helper.describe','migration.plan','migration.catalog','observer.identity']);
    expect(manifest.taskTransport.configurationFile).toBe('/run/registration/private/helper.production.json');
    for(const gate of ['SERVICE_ADMITTED','APPLY_ELIGIBLE','PHONE_APPLY_CONCURRENCY_VERIFIED']) expect(manifest[gate]).toBe(false);
  });

  test.each(['executor','observer'])('%s Dockerfile requires immutable base inputs and overrides database startup', kind => {
    const text=read(`Dockerfile.${kind}`);
    expect(text).toMatch(/^ARG REGISTRATION_NODE_IMAGE$/m);
    expect(text).toContain(`ARG REGISTRATION_POSTGRES_IMAGE=${E.image}`);
    expect(text).toContain('^node:24\\.21\\.0-bookworm@sha256:[a-f0-9]{64}$');
    expect(text).not.toMatch(/ARG REGISTRATION_NODE_IMAGE=/);
    expect(text.match(/^FROM /gm)).toHaveLength(3);
    expect(text).toContain('FROM --platform=linux/amd64 ${REGISTRATION_POSTGRES_IMAGE}');
    expect(text).toContain('FROM scratch\nCOPY --from=postgres-client / /');
    expect(text).not.toMatch(/^(?:VOLUME|EXPOSE) /m);
    expect(text).toContain('USER 999:999');
    expect(text).toContain('ENTRYPOINT ["/usr/local/bin/node"]');
    expect(text).not.toMatch(/(?:curl|wget|apt-get|ADD https?:|docker\.sock|docker-entrypoint-initdb|start:backend|migration:run)/);
    expect(text).not.toMatch(/^COPY \. /m);
  });

  test('executor packages existing Harness only and does not introduce a second runner', () => {
    const dockerfile=read('Dockerfile.executor');
    expect(dockerfile).toContain('COPY src/docker-phone-*.ts ./src/');
    expect(dockerfile).toContain('COPY src/migrations/ ./src/migrations/');
    expect(dockerfile).toContain('npm ci --ignore-scripts');
    const config=JSON.parse(read('tsconfig.executor.json'));
    expect(config.include).toEqual(['../../../src/docker-phone-*.ts','../../../src/migrations/*.ts']);
    expect(config.exclude).toContain('../../../src/**/*.spec.ts');
    const runner=readFileSync(resolve(__dirname,'../../src/docker-phone-migration-runner.ts'),'utf8');
    expect(runner).toContain('PHONE_APPLY_CONCURRENCY_VERIFIED: boolean = false;');
    expect(read('helper-entrypoint.cjs')).not.toMatch(/require\([^)]*(?:pg|child_process|net|https|migration-runner)/);
    expect(read('helper-entrypoint.cjs')).toContain("require('../dist/docker-phone-helper-runtime').runHelperProcess");
  });

  test.each([['migration-executor'],['observer'],[],['migration-executor','--apply'],['backend'],['observer','--approve']])('default task transport fails closed for %j', (...args) => {
    const result=entry.main(args);
    expect(result.status).toBe('BLOCKED');
    expect(result.SERVICE_ADMITTED).toBe(false);
    expect(result.APPLY_ELIGIBLE).toBe(false);
    expect(result.PHONE_APPLY_CONCURRENCY_VERIFIED).toBe(false);
    expect(result.reason).toBe(args.length===1&&['migration-executor','observer'].includes(args[0])?
      'HELPER_RUNTIME_CONFIGURATION_REQUIRED':'HELPER_INVOCATION_INVALID');
  });
});
