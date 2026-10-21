import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { REGISTRATION_PHONE_EXPECTED as E } from '../../src/docker-phone-registration-target';
import { admitRegistrationResources, configDigest, AdmissionInput, AdmissionPolicy, COMPOSE_FILE, REGISTRATION_PROJECT, TEMPLATE_SHA256 } from './admission';

type Json = AdmissionInput['template'];
export class CollectorBlocked extends Error {
  constructor(readonly reason: string) { super(`REGISTRATION_COLLECTOR_BLOCKED:${reason}`); }
}
function block(reason: string): never { throw new CollectorBlocked(reason); }
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) block('INVALID_METADATA');
  return value as Record<string, any>;
}
function lines(raw: string): Record<string, any>[] {
  return raw.split(/\r?\n/).filter(Boolean).map(line => object(JSON.parse(line)));
}
const sha = (raw: Uint8Array) => `sha256:${createHash('sha256').update(raw).digest('hex')}`;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const accept = 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json';

/** Registry metadata only: bounded manifest/config GETs, never layers, Docker pull or credentials on disk. */
export async function verifyOfficialPostgres(reference: string, platform: string, request = fetch) {
  const expected = reference.match(/^postgres:17-bookworm@(sha256:[a-f0-9]{64})$/)?.[1];
  if (!expected || !/^linux\/(amd64|arm64)$/.test(platform)) block('UNAPPROVED_IMAGE');
  const get = async (url: string, headers: Record<string,string> = {}, redirects = 0, allowStorage = false): Promise<{raw:Buffer;digest:string|null}> => {
    const response = await request(url,{headers,redirect:'manual',signal:AbortSignal.timeout(10000)});
    // Blob storage redirects get NO Authorization header. TLS only, bounded hops.
    if ([301,302,303,307,308].includes(response.status)) {
      const next = new URL(response.headers.get('location') || '',url);
      if (!allowStorage || redirects >= 3 || next.protocol !== 'https:' || next.hostname !== 'production.cloudfront.docker.com' ||
          next.username || next.password || (next.port && next.port !== '443')) block('REGISTRY_REDIRECT_REFUSED');
      return get(next.href,{},redirects+1,true);
    }
    if (!response.ok || !response.body) block('REGISTRY_UNAVAILABLE');
    const reader = response.body.getReader(), chunks:Buffer[] = []; let size = 0;
    try {
      for (;;) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.length;
        if (size > 4*1024*1024) block('REGISTRY_METADATA_TOO_LARGE');
        chunks.push(Buffer.from(part.value));
      }
    } finally { await reader.cancel(); }
    return {raw:Buffer.concat(chunks),digest:response.headers.get('docker-content-digest')};
  };
  try {
    const auth = await get('https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/postgres:pull');
    const token = object(JSON.parse(auth.raw.toString())).token;
    if (typeof token !== 'string' || !token) block('REGISTRY_AUTH_FAILED');
    const headers = {Authorization:`Bearer ${token}`,Accept:accept};
    const base = 'https://registry-1.docker.io/v2/library/postgres/';
    const index = await get(`${base}manifests/17-bookworm`,headers);
    if (index.digest !== sha(index.raw)) block('REGISTRY_DIGEST_MISMATCH');
    const descriptors = object(JSON.parse(index.raw.toString())).manifests;
    if (!Array.isArray(descriptors)) block('REGISTRY_INDEX_REQUIRED');
    const matches = descriptors.filter(m=>m.platform?.os==='linux' && `linux/${m.platform?.architecture}`===platform);
    if (matches.length !== 1 || !digestPattern.test(matches[0].digest) || matches[0].digest !== expected) block('IMAGE_NOT_OFFICIAL_TAG_PLATFORM');
    const manifest = await get(`${base}manifests/${expected}`,headers);
    if (sha(manifest.raw) !== expected || (manifest.digest && manifest.digest !== expected)) block('REGISTRY_DIGEST_MISMATCH');
    const parsed = object(JSON.parse(manifest.raw.toString())), configHash = parsed.config?.digest;
    if (!digestPattern.test(configHash || '')) block('IMAGE_CONFIG_MISSING');
    const config = await get(`${base}blobs/${configHash}`,headers,0,true);
    if (sha(config.raw) !== configHash) block('REGISTRY_DIGEST_MISMATCH');
    const image = object(JSON.parse(config.raw.toString())), env = image.config?.Env;
    if (`${image.os}/${image.architecture}` !== platform || !Array.isArray(env) ||
        JSON.stringify(env.filter(v=>/^PG_MAJOR=/.test(v))) !== '["PG_MAJOR=17"]' ||
        env.filter(v=>/^PG_VERSION=/.test(v)).length !== 1 || !env.some(v=>/^PG_VERSION=17\./.test(v))) block('POSTGRES_VERSION_UNCONFIRMED');
    return {indexDigest:index.digest!,manifestDigest:expected,platform,postgresMajor:17,
      version:env.find(v=>v.startsWith('PG_VERSION=')).slice(11) as string};
  } catch (error) { if (error instanceof CollectorBlocked) throw error; return block('REGISTRY_VERIFICATION_FAILED'); }
}

/** Reverse only reviewed equivalent Compose expansions. Unknown additions remain and fail the gate. */
export function normalizeCompose(value: Json): Json {
  const config = structuredClone(object(value));
  for (const service of Object.values(object(config.services)) as Record<string,any>[]) {
    // Compose's typed JSON model emits null for omitted image defaults.
    // Empty strings/lists override image defaults and must NOT be discarded.
    for (const key of ['command','entrypoint']) if (service[key] === null) delete service[key];
    if (service.networks && !Array.isArray(service.networks)) {
      const networks = object(service.networks);
      for (const options of Object.values(networks)) {
        if (options !== null) {
          const values = object(options), keys = Object.keys(values);
          if (keys.length !== 0 && !(keys.length === 1 && values.priority === 0)) block('COMPOSE_NETWORK_OPTIONS_UNREVIEWED');
        }
      }
      service.networks = Object.keys(networks);
    }
    if (Array.isArray(service.ports)) service.ports = service.ports.map((port:any)=>{
      if (typeof port === 'string') return port;
      object(port);
      if (Object.keys(port).some(k=>!['host_ip','published','target','protocol','mode'].includes(k)) ||
          port.protocol !== 'tcp' || (port.mode !== undefined && port.mode !== 'ingress') ||
          port.host_ip !== '127.0.0.1' || !/^\d+$/.test(String(port.published)) || !Number.isInteger(port.target)) block('COMPOSE_PORT_UNREVIEWED');
      return `${port.host_ip}:${port.published}:${port.target}`;
    });
    if (service.depends_on) for (const dependency of Object.values(object(service.depends_on)) as Record<string,any>[]) {
      if (dependency.required === true) delete dependency.required;
      if (dependency.restart === false) delete dependency.restart;
    }
  }
  for (const network of Object.values(object(config.networks)) as Record<string,any>[]) {
    if (network.ipam && typeof network.ipam === 'object' && !Array.isArray(network.ipam) &&
        Object.keys(network.ipam).length === 0) delete network.ipam;
  }
  // Compose v5.6.0 config.go runConfig escapes every output dollar for reloading.
  // Reverse ONLY the exact reviewed Mailpit anchor, never arbitrary regex edits.
  const mail = config.services.mailpit?.environment;
  if (mail?.MP_SMTP_ALLOWED_RECIPIENTS === '@example\\.test$$') {
    mail.MP_SMTP_ALLOWED_RECIPIENTS = '@example\\.test$';
  }
  return config as Json;
}

// Test injection belongs to trusted source composition only. CLI always uses production IO.
export interface CollectorIO {
  phaseTemplate?(file:string): Promise<string>;
  docker(args: readonly string[], env: Record<string,string>): Promise<string>;
  template(root:string): Promise<string>;
  registry: typeof verifyOfficialPostgres;
  now(): number;
}
export function productionCollectorIO(root:string,executable='docker'): CollectorIO {
  const childEnv = Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA']
    .flatMap(key=>process.env[key] === undefined ? [] : [[key,process.env[key]!]]));
  return {
    phaseTemplate: async file => {
      if (!isPhaseTemplateFile(file)) block('PHASE_FILE_REFUSED');
      const path = resolve(root,file);
      if (await realpath(path) !== path) block('COMPOSE_SYMLINK_REFUSED');
      return readFile(path,'utf8');
    },
    now:Date.now,registry:verifyOfficialPostgres,
    template: async () => {
      const path = resolve(root,COMPOSE_FILE);
      if (await realpath(path) !== path) block('COMPOSE_SYMLINK_REFUSED');
      return readFile(path,'utf8');
    },
    docker: (args,env)=>new Promise((ok,no)=>{
      execFile(executable,[...args],{cwd:root,env:{...childEnv,COMPOSE_DISABLE_ENV_FILE:'1',...env},shell:false,windowsHide:true,
        timeout:10000,maxBuffer:8*1024*1024},(error,stdout)=>{
        // Never return stderr/execFile errors: Compose output can contain secrets.
        if (error) no(new CollectorBlocked('DOCKER_COMMAND_FAILED')); else ok(stdout);
      });
    }),
  };
}
const productionIO=productionCollectorIO;
function isPhaseTemplateFile(file:string){return file!==COMPOSE_FILE&&(/^docker\/local-registration\/[a-zA-Z0-9_.-]+\.json$/.test(file)||file==='docker/local-registration/helpers/compose.helpers.json');}
const format = (fields: string) => `{${fields},"composeProject":{{json (.Label "com.docker.compose.project")}}}`;

/** Explicit service-phase entry point. Never called by the PostgreSQL creation CLI.
 * Pre-start cannot mint identities or creation authority. Post-start uses the same
 * admission rules, with independently obtained daemon evidence, not policy fixtures.
 */
export async function collectRegistrationServicePhase(root:string, policy:AdmissionPolicy,
  mode:'pre-first-start'|'post-start', io:CollectorIO=productionIO(resolve(root))) {
  try {
    if (mode !== 'pre-first-start' && mode !== 'post-start') block('PHASE_MODE_REQUIRED');
    if (!policy.servicePhase || ('status' in policy && policy.status !== 'APPROVED')) block('APPROVED_PHASE_POLICY_REQUIRED');
    if (policy.context !== E.context || policy.daemonId !== E.daemonId || policy.platform !== E.platform || policy.postgresImage !== E.image) block('PHASE_TARGET_MISMATCH');
    // Creation uses the separate signed creation action + durable reservation in First-Start.
    // A service-phase observation or CLI flag still cannot confer that authority.
    if (mode === 'pre-first-start') block('CREATION_AUTHORITY_NOT_PROVISIONED');
    const reviewed = structuredClone(policy), phase = reviewed.servicePhase!;
    if (!io.phaseTemplate) block('PHASE_TEMPLATE_READER_REQUIRED');
    const docker = (args:string[]) => io.docker(['--context',E.context,...args],{});
    const current = async () => (await io.docker(['context','show'],{})).trim();
    const info = async () => object(JSON.parse(await docker(['info','--format','{"id":{{json .ID}},"os":{{json .OSType}},"arch":{{json .Architecture}}}'])));
    const identity = await info();
    if (await current() !== E.context || identity.id !== E.daemonId || identity.os !== 'linux' || !['amd64','x86_64'].includes(identity.arch)) block('DAEMON_MISMATCH');
    const at = io.now();
    const inventory = async () => {
      const containers = lines(await docker(['ps','--all','--no-trunc','--format',format('"id":{{json .ID}},"name":{{json .Names}}')]));
      const networks = lines(await docker(['network','ls','--no-trunc','--format',format('"id":{{json .ID}},"name":{{json .Name}}')]));
      const volumes = lines(await docker(['volume','ls','--format',format('"name":{{json .Name}}')]));
      for (const group of [containers,networks,volumes]) {
        if (group.some(v=>typeof v.name!=='string'||!v.name||typeof v.composeProject!=='string') || new Set(group.map(v=>v.name)).size!==group.length) block('INVENTORY_INCOMPLETE');
        group.sort((a,b)=>a.name.localeCompare(b.name));
      }
      if ([...containers,...networks].some(v=>!/^[a-f0-9]{64}$/.test(v.id))) block('INVENTORY_INCOMPLETE');
      return {containers,networks,volumes};
    };
    const first = await inventory();
    const inspect = async (kind:string,id:string) => {
      const result = JSON.parse(await docker([kind,'inspect',id]));
      if (!Array.isArray(result)||result.length!==1) block('INSPECT_INCOMPLETE');
      return object(result[0]);
    };
    // Validate submitted identities before they can become Docker command operands.
    if (!isPhaseTemplateFile(phase.file)) block('PHASE_FILE_REFUSED');
    if (!phase.peers || phase.peers.length!==2 || phase.peers.some(p=>!(/^[a-f0-9]{64}$/.test(p.id)) || !p.name.startsWith(E.project+'-') || !/^[a-z0-9/_.:-]+@sha256:[a-f0-9]{64}$/.test(p.image))) block('HELPER_IDENTITY_REQUIRED');
    if (!phase.controlNetwork || !/^[a-f0-9]{64}$/.test(phase.controlNetwork.id) || phase.controlNetwork.name!==E.project+'-authority') block('CONTROL_NETWORK_REQUIRED');
    const postgres = await inspect('container',E.containerId), postgresImage = await inspect('image',E.image);
    const volume = await inspect('volume',E.volume), network = await inspect('network',E.network);
    const controlNetwork = await inspect('network',phase.controlNetwork.id);
    const peers = [] as {container:any;image:any}[];
    for (const peer of phase.peers) peers.push({container:await inspect('container',peer.id),image:await inspect('image',peer.image)});
    const template = JSON.parse(await io.phaseTemplate(phase.file));
    const imageEnvironment:Record<string,string>=phase.file==='docker/local-registration/helpers/compose.helpers.json'?{
      REGISTRATION_EXECUTOR_IMAGE:phase.peers.find(p=>p.service==='migration-executor')!.image,
      REGISTRATION_OBSERVER_IMAGE:phase.peers.find(p=>p.service==='observer')!.image}:{};
    const rendered = await io.docker(['--context',E.context,'compose','--env-file',process.platform==='win32'?'NUL':'/dev/null','--project-name',E.project,'--file',phase.file,'config','--format','json','--no-normalize','--no-path-resolution'],imageEnvironment);
    const effectiveConfig = normalizeCompose(JSON.parse(rendered));
    const second = await inventory();
    if (configDigest(first)!==configDigest(second) || configDigest(identity)!==configDigest(await info()) || await current()!==E.context || configDigest(template)!==configDigest(JSON.parse(await io.phaseTemplate(phase.file)))) block('INVENTORY_CHANGED');
    // Inventory membership alone does not detect a mount/configuration or NIC change.
    // Reobserve security fingerprints and network membership before issuing evidence.
    const checks:[string,string,any][]=[['container',E.containerId,postgres],['image',E.image,postgresImage],
      ['volume',E.volume,volume],['network',E.network,network],['network',phase.controlNetwork.id,controlNetwork]];
    for(let i=0;i<phase.peers.length;i++) checks.push(['container',phase.peers[i].id,peers[i].container],['image',phase.peers[i].image,peers[i].image]);
    for(const [kind,id,observed] of checks) {
      const again=await inspect(kind,id);
      // Health timestamps and counters are not part of the configuration identity.
      const stable=(value:any)=>kind==='container'?{...value,State:{Status:value.State?.Status,Health:{Status:value.State?.Health?.Status}}}:value;
      if(configDigest(stable(observed))!==configDigest(stable(again))) block('RESOURCE_CHANGED');
    }
    admitRegistrationResources({template,effectiveConfig,environment:{},invocation:{files:[phase.file],project:E.project,profiles:[],services:['migration-executor','observer'],overrides:[]},
      inventory:{...second,daemonId:E.daemonId,context:E.context,complete:true,observedAt:at} as AdmissionInput['inventory'],
      image:{reference:E.image,platform:E.platform,postgresMajor:17,digestVerified:true,observedAt:at},
      servicePhase:{phase:phase.phase,observedAt:at,postgres,postgresImage,volume,network,controlNetwork,peers}},reviewed,io.now());
    return {status:'PASS' as const,mode,checkedAt:io.now(),policySha256:configDigest(reviewed as any),configSha256:configDigest(effectiveConfig)};
  } catch(error) {
    if (error instanceof CollectorBlocked) throw error;
    return block(error instanceof Error && error.message==='REGISTRATION_RESOURCE_ADMISSION_BLOCKED'?'ADMISSION_REFUSED':'OBSERVATION_FAILED');
  }
}

export async function collectRegistrationAdmission(
  root:string, reviewed:AdmissionPolicy, environment:Record<string,string>, io:CollectorIO=productionIO(resolve(root)),
) {
  try {
    const policy = structuredClone(reviewed), env = structuredClone(environment);
    if (!policy || typeof policy.context !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(policy.context) ||
        typeof policy.daemonId !== 'string' || !policy.daemonId || !/^linux\/(amd64|arm64)$/.test(policy.platform)) block('OWNER_POLICY_REQUIRED');
    const template = JSON.parse(await io.template(root));
    if (configDigest(template) !== TEMPLATE_SHA256) block('TEMPLATE_CHANGED');
    const imageAt = io.now();
    const image = await io.registry(policy.postgresImage,policy.platform);
    const docker = (args: string[], extra:Record<string,string>={}) => io.docker(['--context',policy.context,...args],extra);
    const current = () => io.docker(['context','show'],{}).then(x=>x.trim());
    const info = async () => object(JSON.parse(await docker(['info','--format','{"id":{{json .ID}},"os":{{json .OSType}},"arch":{{json .Architecture}}}'])));
    if (await current() !== policy.context) block('CONTEXT_MISMATCH');
    const identity = await info();
    const arch = ({x86_64:'amd64',aarch64:'arm64'} as Record<string,string>)[identity.arch] || identity.arch;
    if (!identity.id || identity.id !== policy.daemonId || `${identity.os}/${arch}` !== policy.platform) block('DAEMON_MISMATCH');
    const inventoryAt = io.now();
    const inventory = async () => {
      const containers = lines(await docker(['ps','--all','--no-trunc','--format',format('"id":{{json .ID}},"name":{{json .Names}}')]));
      const networks = lines(await docker(['network','ls','--no-trunc','--format',format('"id":{{json .ID}},"name":{{json .Name}}')]));
      const volumes = lines(await docker(['volume','ls','--format',format('"name":{{json .Name}}')]));
      for (const group of [containers,networks,volumes]) {
        if (new Set(group.map(x=>x.name)).size !== group.length || group.some(x=>typeof x.name!=='string' || !x.name || typeof x.composeProject!=='string')) block('INVENTORY_INCOMPLETE');
        group.sort((a,b)=>a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      }
      if ([...containers,...networks].some(x=>typeof x.id!=='string'||!x.id)) block('INVENTORY_INCOMPLETE');
      return {
        containers:containers as {id:string;name:string;composeProject:string}[],
        networks:networks as {id:string;name:string;composeProject:string}[],
        volumes:volumes as {name:string;composeProject:string}[],
      };
    };
    const first = await inventory();
    // Rendering only. All profiles expose hidden services to review; future creation has NO profiles.
    const rendered = await docker(['compose','--env-file',process.platform==='win32'?'NUL':'/dev/null',
      '--project-name',REGISTRATION_PROJECT,'--file',COMPOSE_FILE,'--profile','*',
      'config','--format','json','--no-normalize','--no-path-resolution'],{...env,COMPOSE_DISABLE_ENV_FILE:'1'});
    const effectiveConfig = normalizeCompose(JSON.parse(rendered));
    const second = await inventory();
    if (configDigest(first as Json) !== configDigest(second as Json) || await current() !== policy.context ||
        configDigest(await info() as Json) !== configDigest(identity as Json)) block('INVENTORY_CHANGED');
    if (configDigest(JSON.parse(await io.template(root))) !== TEMPLATE_SHA256) block('TEMPLATE_CHANGED');
    const input:AdmissionInput = {template,effectiveConfig,
      invocation:{files:[COMPOSE_FILE],project:REGISTRATION_PROJECT,profiles:[],services:['postgres-test'],overrides:[]},
      environment:env,inventory:{...second,daemonId:identity.id,context:policy.context,observedAt:inventoryAt,complete:true},
      image:{reference:policy.postgresImage,platform:image.platform,postgresMajor:image.postgresMajor,digestVerified:true,observedAt:imageAt}};
    admitRegistrationResources(input,policy,io.now());
    return {status:'PASS' as const,checkedAt:io.now(),context:policy.context,daemonId:identity.id as string,
      image:policy.postgresImage,platform:image.platform,configSha256:configDigest(effectiveConfig),
      counts:{containers:second.containers.length,networks:second.networks.length,volumes:second.volumes.length}};
  } catch (error) {
    if (error instanceof CollectorBlocked) throw error;
    // Parse/validation/CLI errors must not include secrets or raw rendered configuration.
    return block(error instanceof Error && error.message==='REGISTRATION_RESOURCE_ADMISSION_BLOCKED' ? 'ADMISSION_REFUSED' : 'OBSERVATION_FAILED');
  }
}

if (require.main === module) {
  // Owner-reviewed policy path only; no observations or fixture files are accepted.
  const policyFile = process.argv[2];
  const env = Object.fromEntries(['REGISTRATION_ADMIN_PASSWORD','REGISTRATION_APP_PASSWORD','REGISTRATION_JWT_SECRET','REGISTRATION_POSTGRES17_IMAGE']
    .flatMap(key=>process.env[key]===undefined?[]:[[key,process.env[key]!]]));
  void (async()=>{
    if (!policyFile || process.argv.length!==3) block('OWNER_POLICY_REQUIRED');
    const policy = JSON.parse(await readFile(policyFile,'utf8')) as AdmissionPolicy;
    const report = await collectRegistrationAdmission(process.cwd(),policy,env);
    process.stdout.write(`${JSON.stringify(report)}\n`);
  })().catch(error=>{process.stderr.write(`${error instanceof CollectorBlocked?error.message:'REGISTRATION_COLLECTOR_BLOCKED:OBSERVATION_FAILED'}\n`);process.exitCode=1;});
}
