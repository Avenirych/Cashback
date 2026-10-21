import { createHash } from 'node:crypto';
import { REGISTRATION_PHONE_EXPECTED as E, validateRegistrationPeers, registrationPeerFingerprint, registrationNetworkFingerprint } from '../../src/docker-phone-registration-target';
import type { RegistrationNetworkApproval } from '../../src/docker-phone-registration-target';

export const REGISTRATION_PROJECT = 'cashback-registration-20261016-4f8c2a96b17d';
export const COMPOSE_FILE = 'docker/local-registration/compose.registration.json';
// Updated only after review of the standalone template; not computed from submitted config.
export const TEMPLATE_SHA256 = '8b758bc66bf69c82da23c9d230a7c537fb1c4e319be51051b1661c10241a5443';
type Json = null | string | number | boolean | Json[] | {[key: string]: Json};
function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k]!)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function configDigest(value: Json): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export interface AdmissionPolicy {
  // Owner-reviewed boundary. Never derive approval from the same untrusted observation.
  daemonId: string;
  context: string;
  postgresImage: string;
  platform: string;
  /** Separate future owner-reviewed phase policy. Existing approved policy does not contain it. */
  servicePhase?:RegistrationNetworkApproval & {phase:'baseline'|'phone';file:string;templateSha256:string;effectiveSha256:string;
    postgresSha256:string;networkSha256:string;volumeSha256:string};
}
export interface AdmissionInput {
  template: Json;
  effectiveConfig: Json;
  invocation: {files: string[]; project: string; profiles: string[]; services: string[]; overrides: string[]};
  environment: Record<string, string>;
  inventory: {
    daemonId: string; context: string; observedAt: number; complete: boolean;
    containers: {name: string; composeProject?: string}[];
    networks: {name: string; composeProject?: string}[];
    volumes: {name: string; composeProject?: string}[];
  };
  image: {reference: string; platform: string; postgresMajor: number; digestVerified: boolean; observedAt: number};
  servicePhase?:{phase:'baseline'|'phone';observedAt:number;postgres:any;postgresImage:any;volume:any;network:any;
    controlNetwork?:any;peers:readonly {container:any;image:any}[]};
}
function deny(): never { throw new Error('REGISTRATION_RESOURCE_ADMISSION_BLOCKED'); }
function render(value: Json, env: Record<string, string>): Json {
  if (typeof value === 'string') return value.replace(/\$\{([A-Z0-9_]+):\?[^}]+\}/g, (_all, key: string) => env[key] ?? deny());
  if (Array.isArray(value)) return value.map(v => render(v, env));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, render(v, env)]));
  return value;
}

/** Pure decision only: no engine calls, image pulls, secret generation or resource creation.
 * Evidence must later come from a trusted read-only collector, not caller-written receipts.
 * PASS covers creation of an EMPTY cluster only, never schema writes or app startup.
 */
export function admitRegistrationResources(input: AdmissionInput, policy: AdmissionPolicy, now: number): void {
  try {
    if(input.servicePhase){admitServicePhase(input,policy,now);return;}
    const {invocation: call, environment: env, inventory, image} = input;
    const fresh = (at: number) => Number.isFinite(now) && Number.isFinite(at) && at <= now && now - at <= 30000;
    if (configDigest(input.template) !== TEMPLATE_SHA256 ||
        JSON.stringify(call.files) !== JSON.stringify([COMPOSE_FILE]) || call.project !== REGISTRATION_PROJECT ||
        call.profiles.length || call.overrides.length || JSON.stringify(call.services) !== '["postgres-test"]' ||
        !policy.daemonId || !policy.context || !policy.platform ||
        inventory.daemonId !== policy.daemonId || inventory.context !== policy.context ||
        inventory.complete !== true || !fresh(inventory.observedAt) || !fresh(image.observedAt) ||
        !/^postgres:17-bookworm@sha256:[a-f0-9]{64}$/.test(policy.postgresImage) ||
        env.REGISTRATION_POSTGRES17_IMAGE !== policy.postgresImage || image.reference !== policy.postgresImage ||
        image.platform !== policy.platform || image.postgresMajor !== 17 || image.digestVerified !== true) deny();
    const keys = ['REGISTRATION_ADMIN_PASSWORD', 'REGISTRATION_APP_PASSWORD', 'REGISTRATION_JWT_SECRET', 'REGISTRATION_POSTGRES17_IMAGE'];
    if (JSON.stringify(Object.keys(env).sort()) !== JSON.stringify(keys.sort())) deny();
    const secrets = keys.filter(k => k !== 'REGISTRATION_POSTGRES17_IMAGE').map(k => env[k]!);
    if (secrets.some(v => !v || v.length < 32 || /placeholder|example|changeme|\$\{|\s/i.test(v)) || new Set(secrets).size !== 3) deny();
    for (const resources of [inventory.containers, inventory.networks, inventory.volumes]) {
      if (!Array.isArray(resources)) deny();
      for (const item of resources) {
        if (!item || typeof item.name !== 'string' || !item.name ||
            item.name.replace(/^\//, '').startsWith(REGISTRATION_PROJECT) || item.composeProject === REGISTRATION_PROJECT) deny();
      }
    }
    // Exact template locks DB target, private networks, volume, mounts and absence of
    // init SQL/migration hooks. Exact rendered comparison refuses any added overrides.
    if (configDigest(input.effectiveConfig) !== configDigest(render(input.template, env))) deny();
  } catch { deny(); }
}

/** Opt-in verification of already identified service peers; never creates/replaces PostgreSQL.
 * Not wired into the creation collector/CLI. No existing runtime policy enables this branch.
 * Full IDs can only be approved after separately authorised quarantined provisioning.
 */
function admitServicePhase(input:AdmissionInput,policy:AdmissionPolicy,now:number):void {
  const p=policy.servicePhase,f=input.servicePhase!,c=f.postgres,image=f.postgresImage,call=input.invocation;
  const fresh=(at:number)=>Number.isFinite(now)&&Number.isFinite(at)&&at<=now&&now-at<=30000;
  if(!p||!['baseline','phone'].includes(p.phase)||f.phase!==p.phase||p.peers.length!==2||
    p.peers.map(x=>x.service).sort().join(',')!=='migration-executor,observer'||
    policy.daemonId!==E.daemonId||policy.context!==E.context||policy.platform!==E.platform||policy.postgresImage!==E.image||
    input.inventory.daemonId!==E.daemonId||input.inventory.context!==E.context||!input.inventory.complete||
    !fresh(input.inventory.observedAt)||!fresh(f.observedAt)||!fresh(input.image.observedAt)||
    input.image.reference!==E.image||input.image.platform!==E.platform||input.image.postgresMajor!==17||input.image.digestVerified!==true||
    (!/^docker\/local-registration\/[a-zA-Z0-9_.-]+\.json$/.test(p.file)&&p.file!=='docker/local-registration/helpers/compose.helpers.json')||p.file===COMPOSE_FILE||
    JSON.stringify(call.files)!==JSON.stringify([p.file])||call.project!==E.project||call.overrides.length||call.profiles.length||
    [...call.services].sort().join(',')!=='migration-executor,observer'||call.services.length!==2||Object.keys(input.environment).length||
    ![p.templateSha256,p.effectiveSha256,p.postgresSha256,p.networkSha256,p.volumeSha256].every(v=>/^[a-f0-9]{64}$/.test(v))||
    configDigest(input.template)!==p.templateSha256||configDigest(input.effectiveConfig)!==p.effectiveSha256)deny();
  if(c?.Id!==E.containerId||c.Name!=='/'+E.container||c.Config?.Image!==E.image||
    c.Config.Labels?.['com.docker.compose.project']!==E.project||c.Config.Labels?.['com.docker.compose.service']!=='postgres-test'||
    c.State?.Status!=='running'||c.State.Health?.Status!=='healthy'||c.Mounts?.length!==1||
    c.Mounts[0].Type!=='volume'||c.Mounts[0].Name!==E.volume||c.Mounts[0].Destination!=='/var/lib/postgresql/data'||
    JSON.stringify(Object.keys(c.NetworkSettings?.Networks??{}))!==JSON.stringify([E.network])||
    c.HostConfig?.PublishAllPorts!==false||Object.keys(c.HostConfig.PortBindings??{}).length||
    Object.values(c.NetworkSettings.Ports??{}).some((v:any)=>v!==null&&(!Array.isArray(v)||v.length))||
    registrationPeerFingerprint(c)!==p.postgresSha256||image?.Id!==c.Image||!/^sha256:[a-f0-9]{64}$/.test(image.Id)||image.Os!=='linux'||image.Architecture!=='amd64'||
    image.Descriptor?.digest!==E.image.split('@')[1]||
    (image.Descriptor?.platform&&(image.Descriptor.platform.os!=='linux'||image.Descriptor.platform.architecture!=='amd64')))deny();
  const n=f.network,v=f.volume;
  if(n?.Name!==E.network||!/^[a-f0-9]{64}$/.test(n.Id)||n.Internal!==true||n.Labels?.['com.docker.compose.project']!==E.project||
    registrationNetworkFingerprint(n)!==p.networkSha256||c.NetworkSettings.Networks[E.network].NetworkID!==n.Id||
    n.Containers?.[E.containerId]?.IPv4Address?.split('/')[0]!==c.NetworkSettings.Networks[E.network].IPAddress||
    v?.Name!==E.volume||v.Driver!=='local'||Object.keys(v.Options??{}).length||c.Mounts[0].Source!==v.Mountpoint||
    v.Labels?.['com.docker.compose.project']!==E.project||configDigest(v)!==p.volumeSha256)deny();
  validateRegistrationPeers(n,p,f.peers,f.controlNetwork);
  const services=(input.effectiveConfig as any).services;
  if(!services||Object.keys(services).sort().join(',')!=='migration-executor,observer')deny();
  for(const peer of p.peers){
    const actual=f.peers.find(o=>o.container.Id===peer.id)!.container,s=services[peer.service];
    if(s?.image!==peer.image||s.build||s.ports?.length||actual.HostConfig?.Privileged||
      ['host'].includes(actual.HostConfig?.PidMode)||actual.HostConfig?.IpcMode==='host'||actual.HostConfig?.CapAdd?.length||actual.HostConfig?.Devices?.length||
      (actual.Mounts??[]).some((m:any)=>m.Type!=='bind'||m.RW!==false||
        !/^(c:\/approved-registration-infrastructure\/|\/run\/desktop\/mnt\/host\/c\/approved-registration-infrastructure\/)/i.test(String(m.Source).replace(/\\/g,'/'))||
        String(m.Source).replace(/\\/g,'/').split('/').includes('..')))deny();
  }
  const allowed:Record<'containers'|'networks'|'volumes',string[]>={containers:[E.container,...p.peers.map(x=>x.name)],networks:[E.network,...(p.controlNetwork?[p.controlNetwork.name]:[])],volumes:[E.volume]};
  for(const kind of ['containers','networks','volumes'] as const){
    const items=input.inventory[kind];if(!Array.isArray(items))deny();
    const registration=items.filter(x=>x.composeProject===E.project||x.name?.replace(/^\//,'').startsWith(E.project));
    if(registration.length!==allowed[kind].length||registration.some(x=>x.composeProject!==E.project||!allowed[kind].includes(x.name.replace(/^\//,'')))||
      new Set(registration.map(x=>x.name.replace(/^\//,''))).size!==registration.length)deny();
  }
}
