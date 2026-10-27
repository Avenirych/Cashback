import { execFile } from 'node:child_process';
import { Client } from 'pg';
import { isIP } from 'node:net';
import { REGISTRATION_PHONE_EXPECTED as E, REGISTRATION_PHONE_SQL, registrationSecurityDigest as digest, validateRegistrationRoles, validateRegistrationPeers, validateRegistrationObserver } from './docker-phone-registration-target';
import { PHONE_CATALOG_SQL, PHONE_UNSUPPORTED_SQL, PHONE_PREVIOUS, fingerprintPhoneCatalog, fingerprintEmptyPhoneCatalog } from './docker-phone-migration-preflight';
import type { RegistrationNetworkApproval } from './docker-phone-registration-target';
import type { SessionEnrollment } from './docker-phone-concurrency';
import type { CatalogObject } from './docker-phone-migration-preflight';
import type { ExclusivityBinding } from './docker-phone-concurrency';
import type { IndependentDockerObservation, IndependentPostgresObservation, IndependentMigrationSources } from './docker-phone-access-sources';
import { ApprovedFingerprintsAdapter, ApprovedReceiptsAdapter, ApprovedSessionDirectory, SignedApprovalReader } from './docker-phone-approved-evidence';
import { productionMigrationComponents } from './docker-phone-production-configuration';
import type { LoadedProductionMigrationConfiguration } from './docker-phone-production-configuration';
import type { AdministrativeExclusion } from './docker-phone-access-sources';

import { ProductionSource, adapterDeny, AccessAdapterBlocked } from './docker-phone-adapter-common';
export { AccessAdapterBlocked } from './docker-phone-adapter-common';
export interface DockerMetadataTransport {read(args:readonly string[],signal:AbortSignal):Promise<string>}
function scopedDockerTransport(extra:readonly (readonly string[])[]=[],executable='docker'):DockerMetadataTransport {return {read:(args,signal)=>new Promise((resolve,reject)=>{
  const fixed=[['context','show'],
    ['--context',E.context,'info','--format','{"id":{{json .ID}},"os":{{json .OSType}},"arch":{{json .Architecture}}}'],
    ['--context',E.context,'inspect',E.containerId],
    ['--context',E.context,'image','inspect','--platform',E.platform,E.image],
    ['--context',E.context,'volume','inspect',E.volume],['--context',E.context,'network','inspect',E.network]];
  if(![...fixed,...extra].some(command=>JSON.stringify(command)===JSON.stringify(args))){reject(new AccessAdapterBlocked('DOCKER_COMMAND_NOT_ALLOWED'));return;}
  const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA']
    .flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]!]]));
  execFile(executable,[...args],{env,shell:false,windowsHide:true,signal,timeout:2000,maxBuffer:2*1024*1024},
    (error,stdout)=>error?reject(new AccessAdapterBlocked('DOCKER_UNAVAILABLE')):resolve(stdout));
})};}
export const productionDockerTransport=scopedDockerTransport();
export class ProductionDockerAdapter extends ProductionSource {
  private readonly transport:DockerMetadataTransport;
  constructor(transport:DockerMetadataTransport|undefined=undefined, private readonly topology:RegistrationNetworkApproval={phase:'phone',peers:[]}){super('registration-docker-daemon');
    if(topology.peers.some(p=>!/^[a-f0-9]{64}$/.test(p.id)||!/^.+@sha256:[a-f0-9]{64}$/.test(p.image)))adapterDeny('INVALID_PEER_APPROVAL');
    if(topology.controlNetwork&&(topology.controlNetwork.name!==E.project+'-authority'||!/^[a-f0-9]{64}$/.test(topology.controlNetwork.id)))adapterDeny('INVALID_PEER_APPROVAL');
    this.transport=transport??scopedDockerTransport([...topology.peers.flatMap(p=>[['--context',E.context,'inspect',p.id],['--context',E.context,'image','inspect','--platform',E.platform,p.image]]),
      ...(topology.controlNetwork?[['--context',E.context,'network','inspect',topology.controlNetwork.name]]:[])]);
    this.topology=Object.freeze({...topology,...(topology.controlNetwork?{controlNetwork:Object.freeze({...topology.controlNetwork})}:{}),peers:topology.peers.map(p=>Object.freeze({...p}))});}
  assertReady(){} // A read-only transport exists; this does not attest daemon state.
  inspect(signal:AbortSignal):Promise<IndependentDockerObservation>{return this.guarded(signal,async s=>{
    const read=(a:string[])=>this.transport.read(['--context',E.context,...a],s);
    const parse=(raw:string)=>{if(raw.length>2*1024*1024)adapterDeny('INVALID_DOCKER_METADATA');return JSON.parse(raw);};
    if((await this.transport.read(['context','show'],s)).trim()!==E.context)adapterDeny('DOCKER_IDENTITY_MISMATCH');
    const info=parse(await read(['info','--format','{"id":{{json .ID}},"os":{{json .OSType}},"arch":{{json .Architecture}}}']));
    if(info.id!==E.daemonId||info.os!=='linux'||!['amd64','x86_64'].includes(info.arch))adapterDeny('DOCKER_IDENTITY_MISMATCH');
    const one=(v:any)=>{if(!Array.isArray(v)||v.length!==1||!v[0]||typeof v[0]!=='object')adapterDeny('INVALID_DOCKER_METADATA');return v[0];};
    const c=one(parse(await read(['inspect',E.containerId])));
    if(c.Id!==E.containerId||c.Name!=='/'+E.container||c.Config?.Image!==E.image||
      c.Config.Labels?.['com.docker.compose.project']!==E.project||c.Config.Labels?.['com.docker.compose.service']!=='postgres-test')adapterDeny('DOCKER_IDENTITY_MISMATCH');
    if(c.State?.Status!=='running'||c.State.Health?.Status!=='healthy'||c.Mounts?.length!==1||c.Mounts[0].Type!=='volume'||
      c.Mounts[0].Name!==E.volume||c.Mounts[0].Destination!=='/var/lib/postgresql/data'||
      digest(Object.keys(c.NetworkSettings?.Networks||{}))!==digest([E.network])||c.HostConfig?.PublishAllPorts!==false||
      Object.keys(c.HostConfig?.PortBindings||{}).length||Object.values(c.NetworkSettings?.Ports||{}).some((x:any)=>x!==null&&(!Array.isArray(x)||x.length)))adapterDeny('DOCKER_BOUNDARY_MISMATCH');
    const [image,volume,network]=await Promise.all([
      read(['image','inspect','--platform',E.platform,E.image]),read(['volume','inspect',E.volume]),read(['network','inspect',E.network]),
    ]).then(values=>values.map(v=>one(parse(v))));
    if(image.Descriptor?.digest!==E.image.split('@')[1]||image.Os!=='linux'||image.Architecture!=='amd64'||image.Id!==c.Image||
      (Object.hasOwn(image.Descriptor,'platform')&&(image.Descriptor.platform?.os!=='linux'||image.Descriptor.platform?.architecture!=='amd64')))adapterDeny('DOCKER_IMAGE_MISMATCH');
    const address=c.NetworkSettings.Networks[E.network].IPAddress;
    if(volume.Name!==E.volume||volume.Labels?.['com.docker.compose.project']!==E.project||network.Name!==E.network||
      network.Labels?.['com.docker.compose.project']!==E.project||network.Internal!==true||
      network.Containers[E.containerId]?.IPv4Address?.split('/')[0]!==address||network.Id!==c.NetworkSettings.Networks[E.network].NetworkID||isIP(address)!==4)adapterDeny('DOCKER_BOUNDARY_MISMATCH');
    const peers=[];
    for(const p of this.topology.peers){
      const container=one(parse(await read(['inspect',p.id])));
      const image=one(parse(await read(['image','inspect','--platform',E.platform,p.image])));
      peers.push({container,image});
    }
    const control=this.topology.controlNetwork?one(parse(await read(['network','inspect',this.topology.controlNetwork.name]))):undefined;
    validateRegistrationPeers(network,this.topology,peers,control);
    const finalNetwork=one(parse(await read(['network','inspect',E.network])));
    if(digest(finalNetwork)!==digest(network))adapterDeny('DOCKER_OBSERVATION_CHANGED');
    if(control&&digest(one(parse(await read(['network','inspect',this.topology.controlNetwork!.name]))))!==digest(control))adapterDeny('DOCKER_OBSERVATION_CHANGED');
    // Repeat exact identity/context to detect replacement during collection; no exec/run/up.
    const again=one(parse(await read(['inspect',E.containerId])));
    if(digest(again.Config)!==digest(c.Config)||digest(again.Mounts)!==digest(c.Mounts)||
      digest(again.HostConfig)!==digest(c.HostConfig)||digest(again.NetworkSettings)!==digest(c.NetworkSettings)||again.Id!==c.Id||again.State?.Status!=='running'||again.State.Health?.Status!=='healthy'||
      (await this.transport.read(['context','show'],s)).trim()!==E.context)adapterDeny('DOCKER_OBSERVATION_CHANGED');
    const finalInfo=parse(await read(['info','--format','{"id":{{json .ID}},"os":{{json .OSType}},"arch":{{json .Architecture}}}']));
    if(digest(finalInfo)!==digest(info))adapterDeny('DOCKER_OBSERVATION_CHANGED');
    const identity=Object.fromEntries(['context','daemonId','project','container','containerId','image','platform','volume','network'].map(k=>[k,E[k as keyof typeof E]]));
    const result={identity,address,service:'postgres-test',mountedVolumes:[E.volume],networks:[E.network],running:true,healthy:true,hostPortPublished:false};
    this.remember(result);return {...result,observedAt:Date.now()};
  });}
}
export interface EnrolledMigrationSession extends SessionEnrollment {backendPid:string;backendStart:string;transaction:string;operation:'phone-baseline-six-only'|'phone-seventh-only'}
export interface TrustedSessionDirectory {onInvalidated?(listener:()=>void):()=>void;resolve(sessionSha256:string,signal:AbortSignal):Promise<EnrolledMigrationSession>}
export interface ObserverCredentialSource {password(signal:AbortSignal):Promise<string>}
export interface ReadOnlyPgConnection {
  connect():Promise<void>;query(sql:string,values?:unknown[]):Promise<{rows:any[]}>;end():Promise<void>;
}
export interface PgObservationTransport {open(address:string,password:string):ReadOnlyPgConnection}
export const productionPgTransport:PgObservationTransport={open:(address,password)=>{const client=new Client({
  host:address,port:5432,database:E.database,user:'registration_observer',password,
  application_name:'cashback-independent-observer',connectionTimeoutMillis:1500,query_timeout:1500,
  ssl:false,
  options:'-c default_transaction_read_only=on -c statement_timeout=1000 -c lock_timeout=500 -c idle_in_transaction_session_timeout=2000',
});client.on('error',()=>{});return {connect:async()=>{await client.connect();},query:async(sql,values)=>({rows:(await client.query(sql,values)).rows}),end:async()=>{await client.end();}};}};
export const OBSERVER_SESSION_SQL=`SELECT pid::text AS "backendPid",backend_start::text AS "backendStart",xact_start::text AS transaction
 FROM pg_stat_activity WHERE pid=$1::int AND datid=$2::oid AND usename='registration_migrator' AND backend_type='client backend' AND xact_start IS NOT NULL`;
export const OBSERVER_CATALOG_SQL=PHONE_CATALOG_SQL.replace(/\bcurrent_user\b/g,"'registration_migrator'");
export class ProductionPostgresAdapter extends ProductionSource {
  constructor(private readonly docker:ProductionDockerAdapter,private readonly credentials:ObserverCredentialSource|null,
    private readonly directory:TrustedSessionDirectory|null,private readonly transport:PgObservationTransport=productionPgTransport){super('registration-independent-postgres');directory?.onInvalidated?.(()=>this.invalidate());}
  assertReady(){if(!this.credentials||!this.directory)adapterDeny('OBSERVER_AUTHORITY_MISSING');}
  inspect(binding:Readonly<ExclusivityBinding>,signal:AbortSignal):Promise<IndependentPostgresObservation>{return this.guarded(signal,async s=>{
    this.assertReady();if(!/^[a-f0-9]{64}$/.test(binding.sessionSha256))adapterDeny('INVALID_SESSION_BINDING');
    const before=await this.docker.inspect(s),enrolled=structuredClone(await this.directory!.resolve(binding.sessionSha256,s));
    if(!/^[1-9][0-9]*$/.test(enrolled.backendPid)||!enrolled.backendStart||!enrolled.transaction||
      !['phone-baseline-six-only','phone-seventh-only'].includes(enrolled.operation)||
      digest([enrolled.backendPid,enrolled.backendStart,enrolled.transaction])!==binding.sessionSha256||
      enrolled.sessionSha256!==binding.sessionSha256||enrolled.reviewSha256!==binding.reviewSha256||
      enrolled.executor!=='registration_migrator'||enrolled.phase!==(enrolled.operation==='phone-seventh-only'?'phone':'baseline')||
      digest(enrolled.identity)!==digest(E)||!enrolled.enrollmentId||enrolled.expiresAt<=Date.now()||
      !/^[1-9][0-9]*$/.test(enrolled.fencingEpoch))adapterDeny('SESSION_MISMATCH');
    const password=await this.credentials!.password(s);if(!password||/[\r\n\0]/.test(password))adapterDeny('OBSERVER_CREDENTIAL_MISSING');
    const q=this.transport.open(before.address,password);let transaction=false,ended=false;
    const abort=()=>{if(!ended){ended=true;void q.end().catch(()=>{});}};s.addEventListener('abort',abort,{once:true});
    try{
      if(s.aborted)adapterDeny('ABORTED');await q.connect();
      await q.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');transaction=true;
      const read=async(sql:string,values?:unknown[])=>{if(s.aborted)adapterDeny('ABORTED');return (await q.query(sql,values)).rows;};
      const settings=await read("SELECT current_setting('default_transaction_read_only') AS defaults,current_setting('transaction_read_only') AS readonly,current_setting('transaction_isolation') AS isolation,inet_server_addr()::text AS address,inet_server_port()::int AS port");
      if(settings.length!==1||settings[0].defaults!=='on'||settings[0].readonly!=='on'||settings[0].isolation!=='repeatable read'||settings[0].address!==before.address||settings[0].port!==5432)adapterDeny('SQL_READ_ONLY_OR_PEER_MISMATCH');
      const rows=await read(REGISTRATION_PHONE_SQL),facts=rows[0]?.facts;
      if(rows.length!==1||!facts?.security||Object.entries({database:E.database,role:'registration_observer',oid:E.oid,
        systemIdentifier:E.systemIdentifier,serverVersionNum:E.serverVersionNum,owner:E.owner}).some(([k,v])=>facts.identity?.[k]!==v))adapterDeny('SQL_IDENTITY_MISMATCH');
      validateRegistrationRoles(facts.security,enrolled.phase);
      if(digest(facts.security)!==enrolled.securitySha256)adapterDeny('ENROLLMENT_STATE_CHANGED');
      try{validateRegistrationObserver(facts.security);}catch{adapterDeny('OBSERVER_PRIVILEGES_UNAPPROVED');}
      const session=await read(OBSERVER_SESSION_SQL,[enrolled.backendPid,E.oid]);
      if(session.length!==1||digest(session[0])!==digest({backendPid:enrolled.backendPid,backendStart:enrolled.backendStart,transaction:enrolled.transaction}))adapterDeny('SESSION_MISMATCH');
      const unsupported=await read(PHONE_UNSUPPORTED_SQL);if(unsupported.length!==1||unsupported[0].count!=='0')adapterDeny('UNSUPPORTED_CATALOG');
      const historyTable=await read("SELECT to_regclass('public.migrations')::text AS name");
      if(historyTable.length!==1)adapterDeny('HISTORY_MISMATCH');
      const history=historyTable[0].name===null?[]:(await read('SELECT timestamp::text AS timestamp,name FROM public.migrations ORDER BY id')).map(r=>[r.timestamp,r.name]);
      if(digest(history)!==digest(enrolled.operation==='phone-seventh-only'?PHONE_PREVIOUS:[]))adapterDeny('HISTORY_MISMATCH');
      if(enrolled.operation==='phone-baseline-six-only'&&historyTable[0].name!==null)adapterDeny('BASELINE_NOT_EMPTY');
      const catalog:CatalogObject[]=await read(OBSERVER_CATALOG_SQL);
      const schemaSha256=enrolled.operation==='phone-seventh-only'?fingerprintPhoneCatalog(catalog,catalog):fingerprintEmptyPhoneCatalog(catalog);
      const extra=await read('SELECT ((SELECT count(*) FROM pg_subscription WHERE subdbid=(SELECT oid FROM pg_database WHERE datname=current_database())) + (SELECT count(*) FROM pg_largeobject_metadata))::text AS count');
      if(extra.length!==1||extra[0].count!=='0')adapterDeny('UNSUPPORTED_CATALOG');
      await q.query('ROLLBACK');transaction=false;
      const finalSession=await read(OBSERVER_SESSION_SQL,[enrolled.backendPid,E.oid]);
      if(digest(finalSession)!==digest(session))adapterDeny('SESSION_MISMATCH');
      const after=await this.docker.inspect(s);if(digest({...before,observedAt:0})!==digest({...after,observedAt:0}))adapterDeny('DOCKER_OBSERVATION_CHANGED');
      const result={snapshot:{observedAt:Date.now(),identity:{...E},address:before.address,role:'registration_migrator',
        backendPid:enrolled.backendPid,backendStart:enrolled.backendStart,transaction:enrolled.transaction,
        schemaSha256,securitySha256:digest(facts.security),history,enrollment:enrolled},security:facts.security};
      this.remember({...result,snapshot:{...result.snapshot,observedAt:0}});return result;
    }finally{
      s.removeEventListener('abort',abort);
      if(!ended){try{if(transaction)await q.query('ROLLBACK');}finally{ended=true;await q.end();}}
    }
  });}
}
export class ProductionConnectionControlAdapter extends ProductionSource {
  constructor(private readonly external:SignedApprovalReader|null=null){
    super('registration-administrative-fencing');external?.onInvalidated(()=>this.invalidate());
  }
  assertReady(){
    if(!this.external)adapterDeny('EXCLUSIVITY_NOT_ENFORCED');
    if(this.external.purpose!=='fencing')adapterDeny('EXTERNAL_FENCING_AUTHORITY_REQUIRED');
    this.external.assertReady();
  }
  async inspect(b:Readonly<ExclusivityBinding>,s:AbortSignal):Promise<AdministrativeExclusion>{
    this.assertReady();
    return this.guarded(s,async signal=>{
      const p=await this.external!.readPayload(b.reviewSha256,signal);
      if(Array.isArray(p)||digest(p.identity)!==digest(E)||p.sessionSha256!==b.sessionSha256||p.snapshotSha256!==b.snapshotSha256||
        p.mechanism!=='independently-enforced-maintenance-boundary'||p.scope!=='cluster-ddl-acl-roles-and-admin-entrypoints'||
        p.continuousEnforcement!==true||p.competingRunners!==0||p.uncontrolledPrivilegedSessions!==0||p.uncontrolledEntryPoints!==0||
        !p.leaseId||!/^[1-9][0-9]*$/.test(p.fencingEpoch))adapterDeny('EXCLUSIVITY_NOT_ENFORCED');
      this.remember({...p,observedAt:0,expiresAt:0});return p;
    });
  }
}
/** Lazy composition only; no credentials/keys/session authority or network IO on import. */
export function createProductionMigrationSources(configuration?:LoadedProductionMigrationConfiguration):IndependentMigrationSources {
  if(configuration){
    const c=productionMigrationComponents(configuration),t=c.topology;
    const commands=[...t.peers.flatMap(p=>[['--context',E.context,'inspect',p.id],['--context',E.context,'image','inspect','--platform',E.platform,p.image]]),
      ...(t.controlNetwork?[['--context',E.context,'network','inspect',t.controlNetwork.name]]:[])];
    const docker=new ProductionDockerAdapter(scopedDockerTransport(commands,c.dockerCli),t);
    const directory=new ApprovedSessionDirectory(c.authorities.enrollment.anchor,c.transport('enrollment'));
    return {docker,postgres:new ProductionPostgresAdapter(docker,{password:s=>c.observerPassword(s)},directory),
      administrative:new ProductionConnectionControlAdapter(c.externalFencing?new SignedApprovalReader('fencing',c.externalFencing.anchor,c.transport('fencing')):null),
      fingerprints:new ApprovedFingerprintsAdapter(c.authorities.fingerprints.anchor,c.transport('fingerprints')),
      receipts:new ApprovedReceiptsAdapter(c.authorities.receipts.anchor,c.transport('receipts'))};
  }
  const docker=new ProductionDockerAdapter();
  return {docker,postgres:new ProductionPostgresAdapter(docker,null,null),administrative:new ProductionConnectionControlAdapter(),
    fingerprints:new ApprovedFingerprintsAdapter(null),receipts:new ApprovedReceiptsAdapter(null)};
}
