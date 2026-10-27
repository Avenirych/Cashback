import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type { QueryRunner } from 'typeorm';
import type { PhoneTarget } from './docker-phone-migration-data-source';
import { PHONE_PREVIOUS, PHONE_CATALOG_SQL, fingerprintPhoneCatalog } from './docker-phone-migration-preflight';

/** Expected boundary, NEVER evidence of the current daemon or database. */
export const REGISTRATION_PHONE_EXPECTED = Object.freeze({
  context: 'desktop-linux', daemonId: 'ec3d6303-4d66-4410-8317-b739cebc046c',
  project: 'cashback-registration-20261016-4f8c2a96b17d',
  container: 'cashback-registration-20261016-4f8c2a96b17d-postgres-test-1',
  containerId: 'e0818fd64b0149f50ed975d8a519ffc4b615dcff9544a403f224fd82a2291d88',
  image: 'postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df',
  platform: 'linux/amd64', database: 'cashback_docker_test', oid: '16384',
  systemIdentifier: '7697703338450784294', serverVersionNum: '170011',
  owner: 'registration_bootstrap',
  volume: 'cashback-registration-20261016-4f8c2a96b17d-pg17-data',
  network: 'cashback-registration-20261016-4f8c2a96b17d-database',
});
export type RegistrationPhase = 'baseline'|'phone'|'runtime';
export const registrationExecutor = (phase:RegistrationPhase) => phase==='runtime'?'cashback_test' as const:'registration_migrator' as const;
export interface RegistrationPhoneBinding { proof: object; securitySha256: string; phase:RegistrationPhase }
export interface RegistrationTargetApproval {
  operation: 'registration-phone-target';
  // Independently owner-reviewed for the intended role/ACL stage; never learn this from a live observation.
  securitySha256: string;
  phase?:RegistrationPhase; // This factory's historical operation defaults to seventh preflight, never runtime.
  network?:RegistrationNetworkApproval;
  observationRole?:'registration_bootstrap'|'registration_observer';
}
function blocked(): never { throw new Error('PHONE_REGISTRATION_EVIDENCE_REQUIRED'); }
function canonical(v: any): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
export const registrationSecurityDigest = (v: unknown): string => createHash('sha256').update(canonical(v)).digest('hex');
const proofs = new WeakMap<object,{at:number;target:string;securitySha256:string;clock:()=>number}>();
const targetKey = (t:PhoneTarget) => canonical({host:t.host,port:t.port,database:t.database,role:t.role,
  address:t.address,oid:t.oid,systemIdentifier:t.systemIdentifier,serverVersionNum:t.serverVersionNum,phase:t.registration?.phase??null});

/** Applied to measured security, in addition to the independently reviewed exact hash. */
export function validateRegistrationRoles(security:any,phase:RegistrationPhase):void {
  if(!['baseline','phone','runtime'].includes(phase)||!Array.isArray(security?.roles))blocked();
  const runtime=security.roles.filter((r:any)=>r.name==='cashback_test');
  const executor=security.roles.filter((r:any)=>r.name===registrationExecutor(phase));
  if(executor.length!==1||(phase==='runtime'?runtime.length!==1:runtime.length!==0))blocked();
  if(['super','createRole','createDb','replication','bypassRls'].some(k=>executor[0][k]!==false)||
    !Array.isArray(security.memberships)||security.memberships.some((m:any)=>m.member===registrationExecutor(phase)))blocked();
}

/** No passwords/user rows. Includes ALL roles/memberships and database/schema/default ACLs. */
export const REGISTRATION_PHONE_SQL = `SELECT jsonb_build_object(
 'identity',jsonb_build_object('database',current_database(),'role',current_user,
 'oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),
 'systemIdentifier',(SELECT system_identifier::text FROM pg_control_system()),
 'serverVersionNum',current_setting('server_version_num'),
 'owner',(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())),
 'security',jsonb_build_object(
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,
 'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,
 'bypassRls',rolbypassrls,'config',rolconfig,'connections',rolconnlimit,'validUntil',rolvaliduntil) ORDER BY rolname COLLATE "C") FROM pg_roles),
 'memberships',(SELECT COALESCE(jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),
 'member',pg_get_userbyid(member),'grantor',pg_get_userbyid(grantor),'admin',admin_option,
 'inherit',inherit_option,'set',set_option) ORDER BY roleid,member,grantor),'[]'::jsonb) FROM pg_auth_members),
 'database',(SELECT jsonb_build_object('owner',pg_get_userbyid(datdba),'acl',datacl) FROM pg_database WHERE datname=current_database()),
 'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl) ORDER BY nspname COLLATE "C") FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname<>'information_schema'),
 'defaults',(SELECT COALESCE(jsonb_agg(jsonb_build_object('role',pg_get_userbyid(defaclrole),'schema',defaclnamespace::regnamespace::text,'type',defaclobjtype,'acl',defaclacl) ORDER BY defaclrole,defaclnamespace,defaclobjtype),'[]'::jsonb) FROM pg_default_acl)
 )) AS facts`;

/** Source-test injection is a trusted code boundary, NOT a CLI/HTTP/env evidence input. */
export interface RegistrationPhoneIO {
  docker(args: readonly string[], input?: string): Promise<string>;
  now(): number;
}
function productionIO(): RegistrationPhoneIO {
  const env = Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA']
    .flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]!]]));
  return {now:Date.now,docker:(args,input)=>new Promise((resolve,reject)=>{
    const child=execFile('docker',[...args],{env,shell:false,windowsHide:true,timeout:10000,maxBuffer:4*1024*1024},
      (error,stdout)=>error?reject(new Error('PHONE_REGISTRATION_OBSERVATION_FAILED')):resolve(stdout));
    child.stdin?.on('error',()=>reject(new Error('PHONE_REGISTRATION_OBSERVATION_FAILED')));
    child.stdin?.end(input);
  })};
}
function validateSql(f:any, role:string): void {
  const e=REGISTRATION_PHONE_EXPECTED;
  if (!f?.identity || Object.entries({database:e.database,oid:e.oid,systemIdentifier:e.systemIdentifier,
    serverVersionNum:e.serverVersionNum,owner:e.owner,role}).some(([k,v])=>f.identity[k]!==v) || !f.security) blocked();
}

/** Future read-only acquisition only. No invocation on import and no CLI entry point.
 * Password is a separately supplied NEW bootstrap credential, transported only in stdin.
 * A token authorizes target selection, never SQL writes or opening the concurrency gate.
 */
async function collectTarget(
  approval:RegistrationTargetApproval|null, bootstrapPassword:string, io:RegistrationPhoneIO=productionIO(),
): Promise<PhoneTarget> {
  if (!approval || approval.operation!=='registration-phone-target' || !/^[a-f0-9]{64}$/.test(approval.securitySha256) ||
      !bootstrapPassword || /[\r\n\0]/.test(bootstrapPassword)) blocked();
  const reviewedHash=approval.securitySha256,e=REGISTRATION_PHONE_EXPECTED,at=io.now(),phase=approval.phase??'phone';
  const observationRole=approval.observationRole??'registration_bootstrap';
  if(!['registration_bootstrap','registration_observer'].includes(observationRole))blocked();
  if(!['baseline','phone','runtime'].includes(phase))blocked();
  const topology:RegistrationNetworkApproval=approval.network?{...approval.network,peers:approval.network.peers.map(p=>({...p}))}:{phase,peers:[]};
  if(topology.controlNetwork)topology.controlNetwork={...topology.controlNetwork};
  if(topology.phase!==phase)blocked();
  const observerPeers=topology.peers.filter(p=>p.service==='observer');
  if(observationRole==='registration_observer'&&observerPeers.length!==1)blocked();
  const d=(args:string[],input?:string)=>io.docker(['--context',e.context,...args],input);
  const observe=async()=>{
    if ((await io.docker(['context','show'])).trim()!==e.context) blocked();
    const info=JSON.parse(await d(['info','--format','{"id":{{json .ID}},"os":{{json .OSType}},"arch":{{json .Architecture}}}']));
    if(info.id!==e.daemonId||info.os!=='linux'||!['amd64','x86_64'].includes(info.arch)) blocked();
    const [c]=JSON.parse(await d(['inspect',e.containerId]));
    if(!c||c.Id!==e.containerId||c.Name!=='/'+e.container||c.Config?.Labels?.['com.docker.compose.project']!==e.project||
      c.Config.Labels['com.docker.compose.service']!=='postgres-test'||c.Config.Image!==e.image||
      c.State?.Status!=='running'||c.State.Health?.Status!=='healthy'||c.Mounts?.length!==1||
      c.Mounts[0].Type!=='volume'||c.Mounts[0].Name!==e.volume||c.Mounts[0].Destination!=='/var/lib/postgresql/data'||
      canonical(Object.keys(c.NetworkSettings?.Networks||{}))!==canonical([e.network])||
      Object.keys(c.HostConfig?.PortBindings||{}).length||c.HostConfig?.PublishAllPorts) blocked();
    const [image]=JSON.parse(await d(['image','inspect','--platform',e.platform,e.image]));
    if(image?.Descriptor?.digest!==e.image.split('@')[1]||image.Os!=='linux'||image.Architecture!=='amd64'||c.Image!==image.Id) blocked();
    const [volume]=JSON.parse(await d(['volume','inspect',e.volume]));
    const [network]=JSON.parse(await d(['network','inspect',e.network]));
    if(volume?.Name!==e.volume||network?.Name!==e.network||
      volume?.Labels?.['com.docker.compose.project']!==e.project||network?.Labels?.['com.docker.compose.project']!==e.project||
      network.Internal!==true||!network.Containers?.[e.containerId]||
      c.NetworkSettings.Networks[e.network].NetworkID!==network.Id) blocked();
    const peers=[];
    for(const p of topology.peers){
      const [container]=JSON.parse(await d(['inspect',p.id]));
      const [image]=JSON.parse(await d(['image','inspect','--platform',e.platform,p.image]));
      peers.push({container,image});
    }
    const control=topology.controlNetwork?JSON.parse(await d(['network','inspect',topology.controlNetwork.name]))[0]:undefined;
    validateRegistrationPeers(network,topology,peers,control);
    const address=c.NetworkSettings.Networks[e.network].IPAddress;
    if(isIP(address)!==4||network.Containers[e.containerId].IPv4Address?.split('/')[0]!==address) blocked();
    return {info,containerId:c.Id,image:c.Image,address,mount:c.Mounts[0],networkId:network.Id};
  };
  const before=await observe();
  const sql=`BEGIN READ ONLY; ${REGISTRATION_PHONE_SQL}; COMMIT;\n`;
  const raw=await d(['exec','-i',observationRole==='registration_observer'?observerPeers[0].id:e.containerId,'sh','-c',
    'IFS= read -r PGPASSWORD; export PGPASSWORD; export PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=5000"; exec psql -X -qAt -w -h '+(observationRole==='registration_observer'?before.address:'127.0.0.1')+' -U '+observationRole+' -d cashback_docker_test -v ON_ERROR_STOP=1'],bootstrapPassword+'\n'+sql);
  const facts=JSON.parse(raw.trim()); validateSql(facts,observationRole);
  if(observationRole==='registration_observer')validateRegistrationObserver(facts.security);
  validateRegistrationRoles(facts.security,phase);
  if(registrationSecurityDigest(facts.security)!==reviewedHash) blocked();
  const after=await observe();
  if(canonical(before)!==canonical(after)||!Number.isFinite(at)||io.now()<at||io.now()-at>30000) blocked();
  const proof=Object.freeze({});
  const target:PhoneTarget={host:'postgres-test',port:5432,role:registrationExecutor(phase),database:e.database,
    address:after.address,oid:e.oid,systemIdentifier:e.systemIdentifier,serverVersionNum:e.serverVersionNum,
    registration:Object.freeze({proof,securitySha256:reviewedHash,phase})};
  proofs.set(proof,{at,target:targetKey(target),securitySha256:reviewedHash,clock:io.now.bind(io)});
  return target;
}
export function assertRegistrationPhoneTarget(t:PhoneTarget):void {
  const b=t.registration,p=b&&proofs.get(b.proof),now=p?.clock();
  if(typeof now!=='number') blocked();
  if(!p||t.database!==REGISTRATION_PHONE_EXPECTED.database||targetKey(t)!==p.target||b!.securitySha256!==p.securitySha256||
    !Number.isFinite(now)||now<p.at||now-p.at>30000) blocked();
}
/** Sanitized public boundary: no raw Docker/psql errors, JSON or credentials escape. */
export async function collectRegistrationPhoneTarget(
  approval:RegistrationTargetApproval|null, bootstrapPassword:string, io:RegistrationPhoneIO=productionIO(),
):Promise<PhoneTarget> {
  try { return await collectTarget(approval,bootstrapPassword,io); }
  catch { return blocked(); }
}
/** Same migration session, before any baseline DDL and each seventh schema inspection. */
export async function verifyRegistrationPhoneSession(q:QueryRunner,t:PhoneTarget):Promise<void> {
  if(!t.registration) { if(t.database===REGISTRATION_PHONE_EXPECTED.database) blocked(); return; }
  assertRegistrationPhoneTarget(t);
  const rows=await q.query(REGISTRATION_PHONE_SQL);
  if(rows.length!==1) blocked();
  validateSql(rows[0].facts,t.role);
  validateRegistrationRoles(rows[0].facts.security,t.registration.phase);
  if(registrationSecurityDigest(rows[0].facts.security)!==t.registration.securitySha256) blocked();
  assertRegistrationPhoneTarget(t);
}

export interface RegistrationServicePeer {
  id:string;name:string;service:'migration-executor'|'observer'|'backend';image:string;
  configurationSha256:string;
}
export interface RegistrationNetworkApproval {
  phase:RegistrationPhase;peers:readonly RegistrationServicePeer[];
  runtimeProof?:object;
  controlNetwork?:{name:string;id:string;configurationSha256:string};
}
export function validateRegistrationObserver(security:any):void {
  const roles=security?.roles?.filter((r:any)=>r.name==='registration_observer');
  if(roles?.length!==1||['super','createRole','createDb','replication','bypassRls'].some(k=>roles[0][k]!==false)||
    !Array.isArray(security.memberships)||security.memberships.some((m:any)=>m.member==='registration_observer'&&
      (m.role!=='pg_read_all_stats'||m.admin!==false||m.inherit!==true||m.set!==false)))blocked();
}
export function registrationNetworkFingerprint(n:any):string {
  return registrationSecurityDigest({id:n.Id,name:n.Name,driver:n.Driver,internal:n.Internal,ipam:n.IPAM,options:n.Options,labels:n.Labels});
}
const runtimeProofs=new WeakMap<object,{at:number;security:string;schema:string}>();
export function registrationPeerFingerprint(c:any):string {
  return registrationSecurityDigest({config:c.Config,host:c.HostConfig,mounts:c.Mounts,networks:Object.keys(c.NetworkSettings?.Networks||{}).sort()});
}
/** Exact owner-reviewed peers plus daemon observations; names/labels alone never authorize. */
export function validateRegistrationPeers(network:any,approval:RegistrationNetworkApproval,observations:readonly {container:any;image:any}[],control?:any):void {
  if(!approval||!['baseline','phone','runtime'].includes(approval.phase)||!Array.isArray(approval.peers)||
    new Set(approval.peers.map(p=>p.id)).size!==approval.peers.length||observations.length!==approval.peers.length)blocked();
  const ids=Object.keys(network?.Containers||{}).sort();
  if(canonical(ids)!==canonical([REGISTRATION_PHONE_EXPECTED.containerId,...approval.peers.map(p=>p.id)].sort()))blocked();
  if(approval.controlNetwork){
    const a=approval.controlNetwork;
    if(approval.phase==='runtime'||a.name!==REGISTRATION_PHONE_EXPECTED.project+'-authority'||!/^[a-f0-9]{64}$/.test(a.id)||
      !/^[a-f0-9]{64}$/.test(a.configurationSha256)||control?.Name!==a.name||control.Id!==a.id||control.Internal!==true||control.Driver!=='bridge'||
      control.Labels?.['com.docker.compose.project']!==REGISTRATION_PHONE_EXPECTED.project||registrationNetworkFingerprint(control)!==a.configurationSha256||
      canonical(Object.keys(control.Containers||{}).sort())!==canonical(approval.peers.map(p=>p.id).sort()))blocked();
  }else if(control!==undefined)blocked();
  for(const p of approval.peers){
    if(!/^[a-f0-9]{64}$/.test(p.id)||p.id===REGISTRATION_PHONE_EXPECTED.containerId||
      !/^.+@sha256:[a-f0-9]{64}$/.test(p.image)||!p.name.startsWith(REGISTRATION_PHONE_EXPECTED.project+'-')||!['migration-executor','observer','backend'].includes(p.service)||
      !/^[a-f0-9]{64}$/.test(p.configurationSha256))blocked();
    if(p.service==='backend'){
      const proof=approval.runtimeProof&&runtimeProofs.get(approval.runtimeProof);
      if(approval.phase!=='runtime'||!proof||Date.now()<proof.at||Date.now()-proof.at>5000)blocked();
    } else if(approval.phase==='runtime'&&p.service==='migration-executor')blocked();
    const matches=observations.filter(o=>o.container?.Id===p.id);if(matches.length!==1)blocked();
    const {container:c,image}=matches[0];
    if(c.Name!=='/'+p.name||c.Config?.Image!==p.image||c.Config.Labels?.['com.docker.compose.project']!==REGISTRATION_PHONE_EXPECTED.project||
      c.Config.Labels?.['com.docker.compose.service']!==p.service||c.State?.Status!=='running'||
      canonical(Object.keys(c.NetworkSettings?.Networks||{}).sort())!==canonical([REGISTRATION_PHONE_EXPECTED.network,...(approval.controlNetwork?[approval.controlNetwork.name]:[])].sort())||
      c.NetworkSettings.Networks[REGISTRATION_PHONE_EXPECTED.network].NetworkID!==network.Id||
      network.Containers[p.id]?.IPv4Address?.split('/')[0]!==c.NetworkSettings.Networks[REGISTRATION_PHONE_EXPECTED.network].IPAddress||
      c.HostConfig?.PublishAllPorts||Object.keys(c.HostConfig?.PortBindings||{}).length||
      Object.values(c.NetworkSettings?.Ports||{}).some((v:any)=>v!==null&&(!Array.isArray(v)||v.length))||
      image?.Id!==c.Image||image.Os!=='linux'||image.Architecture!=='amd64'||image.Descriptor?.digest!==p.image.split('@')[1]||
      (image.Descriptor?.platform&&(image.Descriptor.platform.os!=='linux'||image.Descriptor.platform.architecture!=='amd64'))||
      registrationPeerFingerprint(c)!==p.configurationSha256)blocked();
    if(approval.controlNetwork&&(c.NetworkSettings.Networks[approval.controlNetwork.name]?.NetworkID!==approval.controlNetwork.id||
      control.Containers[p.id]?.IPv4Address?.split('/')[0]!==c.NetworkSettings.Networks[approval.controlNetwork.name].IPAddress))blocked();
  }
}
/** Actual independent QueryRunner observation; no env/JSON ready flag can issue this token. */
export async function inspectRegistrationRuntime(q:QueryRunner,expectedSecuritySha256:string,expectedSchemaSha256:string):Promise<object> {
  if(!q.isTransactionActive||q.isReleased||!/^[a-f0-9]{64}$/.test(expectedSecuritySha256)||!/^[a-f0-9]{64}$/.test(expectedSchemaSha256))blocked();
  const readonly=await q.query('SHOW transaction_read_only');if(readonly.length!==1||readonly[0].transaction_read_only!=='on')blocked();
  const rows=await q.query(REGISTRATION_PHONE_SQL);if(rows.length!==1)blocked();
  const facts=rows[0].facts;validateSql(facts,facts?.identity?.role);
  if(!['registration_observer','registration_bootstrap'].includes(facts.identity.role))blocked();
  validateRegistrationRoles(facts.security,'runtime');
  if(registrationSecurityDigest(facts.security)!==expectedSecuritySha256)blocked();
  const history=await q.query('SELECT timestamp::text AS timestamp,name FROM public.migrations ORDER BY id');
  if(canonical(history.map((r:any)=>[r.timestamp,r.name]))!==canonical([...PHONE_PREVIOUS,['1792195200000','AddUserPhoneAndSmsConsent1792195200000']]))blocked();
  const catalog=await q.query(PHONE_CATALOG_SQL.replace(/\bcurrent_user\b/g,"'cashback_test'"));
  if(fingerprintPhoneCatalog(catalog,catalog)!==expectedSchemaSha256||catalog.some((r:any)=>r.body?.owner==='cashback_test'))blocked();
  const proof=Object.freeze({});runtimeProofs.set(proof,{at:Date.now(),security:expectedSecuritySha256,schema:expectedSchemaSha256});return proof;
}
