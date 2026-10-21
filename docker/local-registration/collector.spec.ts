import childProcess from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { collectRegistrationAdmission, normalizeCompose, verifyOfficialPostgres, CollectorIO } from './collector';
import { AdmissionPolicy, REGISTRATION_PROJECT } from './admission';

const raw = readFileSync(resolve(__dirname,'compose.registration.json'),'utf8');
const template = JSON.parse(raw);
const policy:AdmissionPolicy={context:'synthetic-context',daemonId:'synthetic-engine',platform:'linux/amd64',
  postgresImage:`postgres:17-bookworm@sha256:${'a'.repeat(64)}`};
const secrets={REGISTRATION_ADMIN_PASSWORD:'ab1'.repeat(16),REGISTRATION_APP_PASSWORD:'bc2'.repeat(16),
  REGISTRATION_JWT_SECRET:'cd3'.repeat(16),REGISTRATION_POSTGRES17_IMAGE:policy.postgresImage};
function setup() {
  let context=policy.context, now=100000;
  const identity={id:policy.daemonId,os:'linux',arch:'x86_64'};
  const groups={containers:[{id:'synthetic-container',name:'unrelated-stopped-container',composeProject:'other'}],
    networks:[{id:'synthetic-network',name:'unrelated-network',composeProject:''}],
    volumes:[{name:'unrelated-volume',composeProject:''}]};
  const effective=JSON.parse(raw.replace(/\$\{([A-Z0-9_]+):\?[^}]+\}/g,(_all,key:keyof typeof secrets)=>secrets[key]));
  const docker=jest.fn(async(args:readonly string[],env:Record<string,string>):Promise<string>=>{
    if(args.join(' ')==='context show') return context+'\n';
    expect(args.slice(0,2)).toEqual(['--context',policy.context]);
    if(args[2]==='info') return JSON.stringify(identity);
    if(args[2]==='ps') return groups.containers.map(x=>JSON.stringify(x)).join('\n');
    if(args[2]==='network') return groups.networks.map(x=>JSON.stringify(x)).join('\n');
    if(args[2]==='volume') return groups.volumes.map(x=>JSON.stringify(x)).join('\n');
    if(args[2]==='compose') {
      expect(env.COMPOSE_DISABLE_ENV_FILE).toBe('1');
      expect(args).toContain('--env-file');expect(args).toContain('--no-path-resolution');
      return JSON.stringify(effective);
    }
    throw new Error('Unexpected command');
  });
  const registry=jest.fn().mockResolvedValue({indexDigest:`sha256:${'b'.repeat(64)}`,manifestDigest:`sha256:${'a'.repeat(64)}`,
    platform:policy.platform,postgresMajor:17,version:'17.0-synthetic'});
  const io:CollectorIO={docker,registry,template:jest.fn().mockResolvedValue(raw),now:()=>now};
  return {io,docker,registry,identity,groups,effective,setContext:(v:string)=>{context=v;},advance:()=>{now+=30001;}};
}
test('collects full stopped/running inventory twice and calls existing admission without exposing secrets',async()=>{
  const m=setup(),report=await collectRegistrationAdmission('.',policy,secrets,m.io);
  expect(report.status).toBe('PASS');expect(report.counts).toEqual({containers:1,networks:1,volumes:1});
  expect(m.docker.mock.calls.filter(([a])=>a[2]==='ps')).toHaveLength(2);
  expect(m.docker.mock.calls.find(([a])=>a[2]==='ps')![0]).toContain('--all');
  const text=JSON.stringify(report);
  for(const value of [secrets.REGISTRATION_ADMIN_PASSWORD,secrets.REGISTRATION_APP_PASSWORD,secrets.REGISTRATION_JWT_SECRET]) expect(text).not.toContain(value);
  expect(m.docker.mock.calls.every(([a])=>!a.some(x=>['pull','up','run','build','create','rm','start','stop','inspect'].includes(x)))).toBe(true);
});
test.each(['containers','networks','volumes'] as const)('reserved %s name refuses, including stopped containers',async kind=>{
  const m=setup();m.groups[kind][0].name=REGISTRATION_PROJECT+'-reserved';
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow('ADMISSION_REFUSED');
});
test.each(['containers','networks','volumes'] as const)('project-labelled unrelated %s name refuses',async kind=>{
  const m=setup();m.groups[kind][0].composeProject=REGISTRATION_PROJECT;
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow('ADMISSION_REFUSED');
});
test.each(['context','daemon','architecture','missing-daemon'])('refuses %s drift',async kind=>{
  const m=setup();if(kind==='context')m.setContext('other');
  if(kind==='daemon')m.identity.id='other';if(kind==='missing-daemon')m.identity.id='';
  if(kind==='architecture')m.identity.arch='arm64';
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow();
});
test('daemon unavailable fails closed, never interprets failed listing as empty',async()=>{
  const m=setup();m.docker.mockRejectedValue(new Error('synthetic-private-command-error'));
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow('OBSERVATION_FAILED');
});
test('unknown/malformed inventory refuses',async()=>{
  const m=setup();(m.groups.volumes[0] as any).composeProject=null;
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow('INVENTORY_INCOMPLETE');
});
test('inventory changes between observations refuse',async()=>{
  const m=setup(),original=m.docker.getMockImplementation()!;let seen=0;
  m.docker.mockImplementation(async(a,e)=>{if(a[2]==='ps' && ++seen===2)m.groups.containers[0].id='replacement';return original(a,e);});
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow('INVENTORY_CHANGED');
});
test('stale image/inventory evidence refuses',async()=>{
  const m=setup(),original=m.docker.getMockImplementation()!;
  m.docker.mockImplementation(async(a,e)=>{if(a[2]==='compose')m.advance();return original(a,e);});
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow('ADMISSION_REFUSED');
});
test.each(['missing-secret','weak-secret','equal-secrets','extra-env'])('does not invent credentials: %s',async kind=>{
  const m=setup(),env:Record<string,string>={...secrets};
  if(kind==='missing-secret')delete env.REGISTRATION_APP_PASSWORD;
  if(kind==='weak-secret')env.REGISTRATION_APP_PASSWORD='placeholder';
  if(kind==='equal-secrets')env.REGISTRATION_APP_PASSWORD=env.REGISTRATION_ADMIN_PASSWORD!;
  if(kind==='extra-env')env.COMPOSE_FILE='other-file';
  await expect(collectRegistrationAdmission('.',policy,env,m.io)).rejects.toThrow('ADMISSION_REFUSED');
});
test.each(['DB','mount','service','port','default-network'])('effective config %s drift cannot be normalized away',async kind=>{
  const m=setup();
  if(kind==='DB')m.effective.services.backend.environment.DB_HOST='host.docker.internal';
  if(kind==='mount')m.effective.services['postgres-test'].volumes[0].source='existing';
  if(kind==='service')m.effective.services['unexpected']={image:'unreviewed'};
  if(kind==='port')m.effective.services['postgres-test'].ports=['5432:5432'];
  if(kind==='default-network')m.effective.networks.database.external=true;
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow();
});
test('only equivalent port/network/depends_on expansions normalize',()=>{
  const expected=structuredClone(template),expanded=structuredClone(template);
  expanded.services.backend.networks={application:null,database:{priority:0},mail:{}};
  expanded.services.backend.ports=[{mode:'ingress',host_ip:'127.0.0.1',target:3001,published:'3001',protocol:'tcp'}];
  expanded.services.backend.depends_on['postgres-test'].required=true;
  expect(normalizeCompose(expanded)).toEqual(expected);
  expanded.services.backend.networks.database={aliases:['existing-db']};
  expect(()=>normalizeCompose(expanded)).toThrow('COMPOSE_NETWORK_OPTIONS_UNREVIEWED');
});
test('template edits refuse before Docker or registry operations',async()=>{
  const m=setup();(m.io.template as jest.Mock).mockResolvedValue('{}');
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow('TEMPLATE_CHANGED');
  expect(m.docker).not.toHaveBeenCalled();expect(m.registry).not.toHaveBeenCalled();
});

function registryFixture() {
  const hash=(value:string)=>`sha256:${createHash('sha256').update(value).digest('hex')}`;
  const config=JSON.stringify({os:'linux',architecture:'amd64',config:{Env:['PG_MAJOR=17','PG_VERSION=17.0-synthetic']}});
  const manifest=JSON.stringify({schemaVersion:2,config:{digest:hash(config)},layers:[{digest:'never-requested'}]});
  const index=JSON.stringify({manifests:[{digest:hash(manifest),platform:{os:'linux',architecture:'amd64'}}]});
  const request=jest.fn(async(url: string|URL|Request, _init?: RequestInit)=>{
    const u=String(url),raw=u.includes('auth.docker.io')?JSON.stringify({token:'synthetic-memory-only-token'}):
      u.endsWith('/17-bookworm')?index:u.includes('/manifests/')?manifest:config;
    return new Response(raw,{headers:{'docker-content-digest':hash(raw)}});
  });
  return {request,reference:`postgres:17-bookworm@${hash(manifest)}`,manifest,index,config};
}
test('registry validates official tag -> platform manifest -> config byte hashes, never layers',async()=>{
  const m=registryFixture();const result=await verifyOfficialPostgres(m.reference,'linux/amd64',m.request as typeof fetch);
  expect(result.postgresMajor).toBe(17);expect(result.platform).toBe('linux/amd64');
  expect(m.request).toHaveBeenCalledTimes(4);
  expect(JSON.stringify(m.request.mock.calls)).not.toContain('never-requested');
  expect(JSON.stringify(result)).not.toContain('synthetic-memory-only-token');
});
test('registry byte tampering refuses',async()=>{
  const m=registryFixture(),original=m.request.getMockImplementation()!;
  m.request.mockImplementation(async u=>String(u).endsWith('/17-bookworm')?new Response(m.index,{headers:{'docker-content-digest':`sha256:${'0'.repeat(64)}`}}):original(u));
  await expect(verifyOfficialPostgres(m.reference,'linux/amd64',m.request as typeof fetch)).rejects.toThrow('DIGEST_MISMATCH');
});
test.each(['linux/arm64','windows/amd64'])('registry does not guess platform %s',async platform=>{
  const m=registryFixture();await expect(verifyOfficialPostgres(m.reference,platform,m.request as typeof fetch)).rejects.toThrow();
});
test('untrusted registry redirects refuse without following or forwarding token',async()=>{
  const m=registryFixture();m.request.mockResolvedValue(new Response(null,{status:302,headers:{location:'https://untrusted.invalid/'}}));
  await expect(verifyOfficialPostgres(m.reference,'linux/amd64',m.request as typeof fetch)).rejects.toThrow('REDIRECT_REFUSED');
  expect(m.request).toHaveBeenCalledTimes(1);
});

test('config CDN redirects drop Authorization and still require the expected byte digest',async()=>{
  const m=registryFixture(),original=m.request.getMockImplementation()!;
  m.request.mockImplementation(async(url,init)=>{
    if(String(url).includes('/blobs/')) return new Response(null,{status:307,headers:{location:'https://production.cloudfront.docker.com/config'}});
    if(String(url).includes('production.cloudfront.docker.com')) {
      expect(init?.headers).toEqual({});return new Response(m.config);
    }
    return original(url,init);
  });
  await expect(verifyOfficialPostgres(m.reference,'linux/amd64',m.request as typeof fetch)).resolves.toMatchObject({postgresMajor:17});
});
test('registry HTTP failure never becomes verified metadata',async()=>{
  const m=registryFixture();m.request.mockResolvedValue(new Response(null,{status:429}));
  await expect(verifyOfficialPostgres(m.reference,'linux/amd64',m.request as typeof fetch)).rejects.toThrow('REGISTRY_UNAVAILABLE');
});
test('production adapter uses argument arrays and strips inherited Docker/Compose overrides',async()=>{
  const m=setup(),registry=registryFixture();
  const supplied={...secrets,REGISTRATION_POSTGRES17_IMAGE:registry.reference};
  m.effective.services['postgres-test'].image=registry.reference;
  const keys=['DOCKER_HOST','DOCKER_CONTEXT','COMPOSE_FILE','COMPOSE_PROFILES','DOCKER_DEFAULT_PLATFORM','NODE_OPTIONS'];
  const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  for(const key of keys) process.env[key]='synthetic-untrusted-override';
  const fetchMock=jest.spyOn(global,'fetch').mockImplementation(registry.request as typeof fetch);
  const execMock=jest.spyOn(childProcess,'execFile').mockImplementation(((file:any,args:any,options:any,callback:any)=>{
    expect(file).toBe('docker');expect(Array.isArray(args)).toBe(true);expect(options.shell).toBe(false);
    expect(options.windowsHide).toBe(true);expect(options.timeout).toBe(10000);
    for(const key of keys) expect(options.env[key]).toBeUndefined();
    void m.docker(args,options.env).then(stdout=>callback(null,stdout,''),error=>callback(error,'',''));
    return {};
  }) as any);
  try {
    const report=await collectRegistrationAdmission(resolve(__dirname,'../..'),{...policy,postgresImage:registry.reference},supplied);
    expect(report.status).toBe('PASS');expect(execMock).toHaveBeenCalled();
  } finally {
    execMock.mockRestore();fetchMock.mockRestore();
    for(const key of keys) {if(saved[key]===undefined) delete process.env[key];else process.env[key]=saved[key];}
  }
});

test('Compose null defaults, empty IPAM and serialized Mailpit anchor normalize without mutating input',async()=>{
  const m=setup();
  for(const name of ['postgres-test','backend','frontend','mailpit']) {
    m.effective.services[name].command=null;m.effective.services[name].entrypoint=null;
  }
  for(const network of Object.values(m.effective.networks) as any[]) network.ipam={};
  m.effective.services.mailpit.environment.MP_SMTP_ALLOWED_RECIPIENTS='@example\\.test$$';
  const before=structuredClone(m.effective);
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).resolves.toMatchObject({status:'PASS'});
  expect(m.effective).toEqual(before);
});

test.each([
  ['command-string',(c:any)=>{c.services['postgres-test'].command='postgres -c log_statement=all';}],
  ['command-empty-list',(c:any)=>{c.services['postgres-test'].command=[];}],
  ['command-empty-string',(c:any)=>{c.services['postgres-test'].command='';}],
  ['entrypoint-string',(c:any)=>{c.services['postgres-test'].entrypoint='sh';}],
  ['entrypoint-empty-list',(c:any)=>{c.services['postgres-test'].entrypoint=[];}],
  ['entrypoint-empty-string',(c:any)=>{c.services['postgres-test'].entrypoint='';}],
  ['required-command-null',(c:any)=>{c.services['mailpit-ui'].command=null;}],
  ['required-entrypoint-null',(c:any)=>{c.services['mailpit-ui'].entrypoint=null;}],
  ['IPAM-subnet',(c:any)=>{c.networks.database.ipam={config:[{subnet:'10.0.0.0/8'}]};}],
  ['IPAM-driver',(c:any)=>{c.networks.database.ipam={driver:'custom'};}],
  ['IPAM-null',(c:any)=>{c.networks.database.ipam=null;}],
  ['IPAM-array',(c:any)=>{c.networks.database.ipam=[];}],
  ['allowlist-wide',(c:any)=>{c.services.mailpit.environment.MP_SMTP_ALLOWED_RECIPIENTS='.*';}],
  ['allowlist-no-anchor',(c:any)=>{c.services.mailpit.environment.MP_SMTP_ALLOWED_RECIPIENTS='@example\\.test';}],
  ['allowlist-unescaped-dot',(c:any)=>{c.services.mailpit.environment.MP_SMTP_ALLOWED_RECIPIENTS='@example.test$$';}],
  ['allowlist-extra-dollar',(c:any)=>{c.services.mailpit.environment.MP_SMTP_ALLOWED_RECIPIENTS='@example\\.test$$$$';}],
  ['allowlist-other-domain',(c:any)=>{c.services.mailpit.environment.MP_SMTP_ALLOWED_RECIPIENTS='@other\\.test$$';}],
  ['unknown-service-field',(c:any)=>{c.services['postgres-test'].unexpected=null;}],
  ['unknown-network-field',(c:any)=>{c.networks.database.unexpected={};}],
  ['unknown-root-field',(c:any)=>{c.unexpected={};}],
  ['image',(c:any)=>{c.services['postgres-test'].image='postgres:17-bookworm';}],
  ['volume',(c:any)=>{c.volumes['registration-pg17-data'].name='existing';}],
  ['network',(c:any)=>{c.networks.database.internal=false;}],
  ['port',(c:any)=>{c.services.backend.ports=['0.0.0.0:3001:3001'];}],
] as const)('representation normalization preserves refusal for %s',async(_name,change)=>{
  const m=setup();change(m.effective);
  await expect(collectRegistrationAdmission('.',policy,secrets,m.io)).rejects.toThrow();
});
