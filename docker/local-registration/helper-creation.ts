import {execFile} from 'node:child_process';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,isAbsolute} from 'node:path';
import {randomBytes} from 'node:crypto';
import {RegistrationInfrastructureLedger} from './legacy-source/src/docker-phone-infrastructure-ledger';
import {LedgerDockerCreation,validateCreationPlan} from './legacy-source/src/docker-phone-creation-contract';
import type {CreationPlan,CreationHelper,CreatedHelperIdentity,CreatedNetworkIdentity,CreationAuthorizationEnvelope,CreationFence} from './legacy-source/src/docker-phone-creation-contract';
import {REGISTRATION_PHONE_EXPECTED as E,registrationSecurityDigest as hash,registrationPeerFingerprint,registrationNetworkFingerprint} from './legacy-source/src/docker-phone-registration-target';
import {normalizeCompose} from './collector';
import type {ExistingPostgresPolicy} from './existing-postgres-baseline';

const TEMPLATE='docker/local-registration/helpers/compose.helpers.json';
const hex=/^[a-f0-9]{64}$/;
const closed={SERVICE_ADMITTED:false,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED:false} as const;
export class HelperCreationBlocked extends Error {constructor(readonly reason:string){super('HELPER_CREATION_BLOCKED:'+reason);}}
function stop(reason:string):never{throw new HelperCreationBlocked(reason);}
/** Test injection is explicit; production composition below supplies the actual daemon and ledger.
 * None of these operations run at import, Preflight, or on a bare First-Start invocation. */
export interface HelperCreationIO {
  credentials():Promise<void>;fence:CreationFence;
  observe(plan:Readonly<CreationPlan>):Promise<void>;
  authorize(plan:Readonly<CreationPlan>,challenge:string):Promise<CreationAuthorizationEnvelope>;
  createNetwork(plan:Readonly<CreationPlan>,recordReturned:(id:string)=>Promise<void>):Promise<{name:string;id:string;configurationSha256:string}|undefined>;
  createHelper(plan:Readonly<CreationPlan>,helper:CreationHelper):Promise<string>;
  verifyCreated(plan:Readonly<CreationPlan>,ids:readonly CreatedHelperIdentity[],network?:CreatedNetworkIdentity):Promise<void>;
}
/** The single creation action in the existing control-plane. A crash after reserve always
 * requires read-only reconciliation. Neither a new process nor another approval retries it. */
export async function firstStartHelpers(input:CreationPlan,journal:Pick<LedgerDockerCreation,'reserve'|'assertReserved'|'progress'|'record'|'unknown'>,io:HelperCreationIO){
  const plan=validateCreationPlan(input,Date.now());
  await io.credentials();await io.observe(plan);
  if(!await io.fence.held(plan))stop('EXTERNAL_FENCING_NOT_HELD');
  const challenge=randomBytes(32).toString('hex'),approval=await io.authorize(plan,challenge);
  const reservation=await journal.reserve(approval,plan as CreationPlan,challenge);
  const ids:CreatedHelperIdentity[]=[];
  let network:Awaited<ReturnType<HelperCreationIO['createNetwork']>>;
  // All mutations are downstream of the durable one-use reservation.
  try {
    await io.credentials();await io.observe(plan);
    if(Date.now()>=plan.expiresAt||!await io.fence.held(plan))stop('FENCING_LOST_OR_PLAN_EXPIRED');
    await journal.assertReserved(reservation,plan as CreationPlan);
    network=await io.createNetwork(plan,async returnedNetworkId=>journal.progress(reservation,plan as CreationPlan,{returnedNetworkId}));
    if(network)await journal.progress(reservation,plan as CreationPlan,{network});
    for(const helper of plan.helpers){
      await io.credentials();
      if(Date.now()>=plan.expiresAt||!await io.fence.held(plan))stop('FENCING_LOST_OR_PLAN_EXPIRED');
      await journal.assertReserved(reservation,plan as CreationPlan);
      const id=(await io.createHelper(plan,helper)).trim();
      if(!hex.test(id)||id===E.containerId||ids.some(v=>v.id===id))stop('CREATE_RESULT_IDENTITY_INVALID');
      ids.push({service:helper.service,id});
      await journal.progress(reservation,plan as CreationPlan,{identities:ids,...(network?{network}:{})});
    }
    // Record actual returned identities before any attestation. A failed inspect leaves
    // CREATED_UNVERIFIED, not an automatic retry or a caller-approved service identity.
    await journal.record(reservation,plan as CreationPlan,ids,network);
    await io.verifyCreated(plan,ids,network);
    return {status:'CREATED_UNVERIFIED' as const,reservationId:reservation,identities:ids,...closed,
      next:'STOP_INDEPENDENT_IDENTITY_ATTESTATION_AND_SEPARATE_START_PERMISSION_REQUIRED'};
  }catch(error){
    // If result is already durable, unknown() refuses rather than rewriting it. Preserve
    // the durable result and refuse recovery here. Never remove, adopt, start or retry.
    try{await journal.unknown(reservation,plan as CreationPlan,{identities:ids,...(network?{network}:{})});}catch{}
    if(error instanceof HelperCreationBlocked)throw error;
    stop('CREATE_OUTCOME_RECONCILIATION_REQUIRED');
  }
}

type Docker=(args:readonly string[],extra?:Record<string,string>)=>Promise<string>;
/** Full-path CLI, no shell or inherited Docker/Compose overrides. Errors never expose
 * subprocess stderr (inspect and config can contain sensitive material). */
export function helperDockerTransport(root:string,executable:string):Docker {
  if(!isAbsolute(executable)||!/[\\/]docker(?:\.exe)?$/i.test(executable))stop('EXPLICIT_DOCKER_CLI_REQUIRED');
  const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]!]]));
  return async(args,extra={})=>new Promise((ok,no)=>execFile(executable,[...args],{cwd:root,env:{...env,COMPOSE_DISABLE_ENV_FILE:'1',...extra},shell:false,windowsHide:true,timeout:10000,maxBuffer:16*1024*1024},
    (error,stdout)=>error?no(new HelperCreationBlocked('DOCKER_OPERATION_FAILED_UNKNOWN_IF_MUTATING')):ok(stdout)));
}
function projectItems(group:any[]){return group.filter(v=>v.project===E.project||v.name.startsWith(E.project));}
function noPorts(c:any){return c.HostConfig?.PublishAllPorts===false&&!Object.keys(c.HostConfig.PortBindings??{}).length&&
  Object.values(c.NetworkSettings?.Ports??{}).every((p:any)=>p===null||(Array.isArray(p)&&!p.length));}
function sourcePath(s:string){return s.replace(/\\/g,'/').replace(/^\/run\/desktop\/mnt\/host\/c\//,'C:/');}
/** Exact desired configuration projection; image defaults may not introduce privileges,
 * volumes, environment, endpoints or a different command behind the reviewed template. */
export function verifyCreatedHelper(helper:CreationHelper,c:any,image:any,networkIds:Record<string,string>,expectedState:'created'|'running'='created'):void{
  const mounts=(c.Mounts??[]).map((m:any)=>({type:m.Type,source:sourcePath(m.Source??''),target:m.Destination,readOnly:m.RW===false}));
  const expected=helper.mounts.map(m=>({...m,source:sourcePath(m.source)}));
  const sorted=(a:any[])=>[...a].sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)));
  if(c.Name!=='/'+helper.name||c.Config?.Image!==helper.image||image.Id!==c.Image||image.Os!=='linux'||image.Architecture!=='amd64'||
    image.Descriptor?.digest!==helper.image.split('@')[1]||(image.Descriptor?.platform&&(image.Descriptor.platform.os!=='linux'||image.Descriptor.platform.architecture!=='amd64'))||
    c.State?.Status!==expectedState||!noPorts(c)||hash(sorted(mounts))!==hash(sorted(expected))||
    hash(c.Config?.Entrypoint??[])!==hash(helper.entrypoint)||hash(c.Config?.Cmd??[])!==hash(helper.command)||c.Config?.User!==helper.user||
    c.HostConfig?.ReadonlyRootfs!==true||hash(c.HostConfig.CapAdd??[])!==hash([])||hash(c.HostConfig.CapDrop??[])!==hash(['ALL'])||c.HostConfig.PidsLimit!==64||
    hash(c.HostConfig.SecurityOpt??[])!==hash(helper.securityOpt)||c.HostConfig.Privileged!==false||
    !['','private'].includes(c.HostConfig.PidMode??'')||!['','private'].includes(c.HostConfig.IpcMode??'')||
    (c.HostConfig.Devices??[]).length||(c.HostConfig.DeviceRequests??[]).length||Object.keys(c.HostConfig.Tmpfs??{}).length||
    hash(c.Config.Labels??{})!==hash(helper.labels)||hash(Object.keys(c.NetworkSettings?.Networks??{}).sort())!==hash(helper.networks.map(n=>n.name).sort())||
    helper.networks.some(n=>c.NetworkSettings.Networks[n.name]?.NetworkID!==networkIds[n.name]))stop('POST_CREATE_CONFIGURATION_MISMATCH');
}
/** Build bounded exact Docker arguments from the SIGNED desired spec, not caller CLI
 * switches or a Compose override. Docker create never starts a helper or executes SQL. */
export function helperCreateArguments(p:Readonly<CreationPlan>,h:CreationHelper):string[]{
  const args=['--context',E.context,'container','create','--pull=never','--platform',p.platform,'--name',h.name,'--user',h.user,
    '--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--restart','no','--pids-limit','64','--ipc','private'];
  for(const [k,v] of Object.entries(h.labels).sort(([a],[b])=>a.localeCompare(b)))args.push('--label',`${k}=${v}`);
  for(const n of h.networks)args.push('--network',n.name);
  for(const m of h.mounts)args.push('--mount',`type=bind,source=${m.source},target=${m.target},readonly`);
  if(h.entrypoint.length!==1)stop('SCALAR_ENTRYPOINT_REQUIRED');
  args.push('--entrypoint',h.entrypoint[0],h.image,...h.command);return args;
}

/** Post-Start verifies actual running configuration against the SIGNED desired plan,
 * in addition to the independent phase fingerprint. A phase hash cannot silently
 * approve a different command, mount, privilege or network than the creation action. */
export async function verifyRunningCreationPlan(plan:CreationPlan,policy:ExistingPostgresPolicy,docker:Docker):Promise<void>{
  const p=policy.servicePhase;if(!p?.controlNetwork||!policy.existingPostgresBaseline)stop('APPROVED_PHASE_POLICY_REQUIRED');
  const networks={[E.network]:policy.existingPostgresBaseline.networkId,[E.project+'-authority']:p.controlNetwork.id};
  const inspect=async(kind:string,id:string)=>{const values=JSON.parse(await docker(['--context',E.context,kind,'inspect',id]));if(!Array.isArray(values)||values.length!==1)stop('INCOMPLETE_INSPECT');return values[0];};
  for(const h of plan.helpers){const peer=p.peers.find(v=>v.service===h.service);if(!peer)stop('HELPER_IDENTITY_REQUIRED');
    const c=await inspect('container',peer.id),image=await inspect('image',h.image);
    if(c.Id!==peer.id||registrationPeerFingerprint(c)!==peer.configurationSha256)stop('POST_START_CONFIGURATION_CHANGED');
    verifyCreatedHelper(h,c,image,networks,'running');
  }
}

/** Trusted real daemon collector for creation. Policy stays read-only. Expected hashes
 * must be independently approved, never filled from this observation. */
export function productionHelperCreationIO(root:string,docker:Docker,policy:ExistingPostgresPolicy,
  credentials:()=>Promise<void>,fence:CreationFence,authorize:HelperCreationIO['authorize']):HelperCreationIO {
  let protectedBefore:string|undefined;
  const d=(a:string[],env?:Record<string,string>)=>docker(['--context',E.context,...a],env);
  const inspect=async(kind:string,id:string)=>{const a=JSON.parse(await d([kind,'inspect',id]));if(!Array.isArray(a)||a.length!==1)stop('INCOMPLETE_INSPECT');return a[0];};
  const inventory=async()=>{
    const label='"project":{{json (.Label "com.docker.compose.project")}}';
    const list=async(a:string[])=>(await d(a)).split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s)).sort((a,b)=>a.name.localeCompare(b.name));
    const containers=await list(['ps','--all','--no-trunc','--format',`{"id":{{json .ID}},"name":{{json .Names}},${label}}`]);
    const networks=await list(['network','ls','--no-trunc','--format',`{"id":{{json .ID}},"name":{{json .Name}},${label}}`]);
    const volumes=await list(['volume','ls','--format',`{"name":{{json .Name}},${label}}`]);
    for(const g of [containers,networks,volumes])if(g.some(v=>typeof v.name!=='string'||typeof v.project!=='string')||new Set(g.map(v=>v.name)).size!==g.length)stop('INCOMPLETE_INVENTORY');
    if([...containers,...networks].some(v=>!hex.test(v.id)))stop('INCOMPLETE_INVENTORY');
    return {containers,networks,volumes};
  };
  const protectedSnapshot=async(inv:Awaited<ReturnType<typeof inventory>>)=>{
    const values=[];
    for(const [kind,g] of [['container',inv.containers],['network',inv.networks],['volume',inv.volumes]] as const)for(const r of g.filter(v=>v.project!==E.project&&!v.name.startsWith(E.project))){
      const x=await inspect(kind,r.id??r.name);
      values.push({kind,name:r.name,identity:kind==='container'?{fingerprint:registrationPeerFingerprint(x),state:x.State?.Status,networks:x.NetworkSettings?.Networks}:x});
    }
    return hash(values);
  };
  const checkDaemon=async()=>{
    const v=JSON.parse(await d(['info','--format','{"id":{{json .ID}},"os":{{json .OSType}},"arch":{{json .Architecture}}}']));
    if((await docker(['context','show'])).trim()!==E.context||v.id!==E.daemonId||v.os!=='linux'||!['amd64','x86_64'].includes(v.arch))stop('DAEMON_MISMATCH');
  };
  const checkPostgres=async(p:Readonly<CreationPlan>)=>{
    const b=policy.existingPostgresBaseline;
    if(!b||hash(b)!==p.postgresBaselineSha256||policy.context!==E.context||policy.daemonId!==E.daemonId||policy.platform!==E.platform||policy.postgresImage!==E.image||b.containerId!==E.containerId)stop('BASELINE_POLICY_MISMATCH');
    if(p.helpers.some(h=>{const db=h.networks.find(n=>n.name===E.network);return db?.id!==b.networkId||db?.configurationSha256!==b.networkSha256;}))stop('DATABASE_NETWORK_PLAN_MISMATCH');
    const c=await inspect('container',E.containerId),i=await inspect('image',E.image),n=await inspect('network',E.network),v=await inspect('volume',E.volume);
    if(c.Id!==E.containerId||c.Name!=='/'+E.container||c.Config?.Image!==E.image||c.Config?.Labels?.['com.docker.compose.project']!==E.project||c.Config?.Labels?.['com.docker.compose.service']!=='postgres-test'||
      c.State?.Status!=='running'||c.State.Health?.Status!=='healthy'||!noPorts(c)||registrationPeerFingerprint(c)!==b.postgresSha256||
      i.Id!==c.Image||i.Descriptor?.digest!==E.image.split('@')[1]||i.Os!=='linux'||i.Architecture!=='amd64'||
      (i.Descriptor?.platform&&(i.Descriptor.platform.os!=='linux'||i.Descriptor.platform.architecture!=='amd64'))||
      n.Id!==b.networkId||registrationNetworkFingerprint(n)!==b.networkSha256||n.Name!==E.network||n.Driver!=='bridge'||!n.Internal||n.Labels?.['com.docker.compose.project']!==E.project||
      hash(v)!==b.volumeSha256||v.Name!==E.volume||v.Driver!=='local'||Object.keys(v.Options??{}).length||
      c.Mounts?.length!==1||c.Mounts[0].Type!=='volume'||c.Mounts[0].Name!==E.volume||c.Mounts[0].Destination!=='/var/lib/postgresql/data'||c.Mounts[0].Source!==v.Mountpoint||
      hash(Object.keys(c.NetworkSettings?.Networks??{}))!==hash([E.network])||c.NetworkSettings.Networks[E.network].NetworkID!==n.Id)stop('POSTGRES_BASELINE_CHANGED');
    return n;
  };
  const checkImages=async(p:Readonly<CreationPlan>)=>{for(const h of p.helpers){const i=await inspect('image',h.image);
    if(i.Descriptor?.digest!==h.image.split('@')[1]||i.Os!=='linux'||i.Architecture!=='amd64'||
      (i.Descriptor?.platform&&(i.Descriptor.platform.os!=='linux'||i.Descriptor.platform.architecture!=='amd64'))||
      Object.keys(i.Config?.Volumes??{}).length||Object.keys(i.Config?.ExposedPorts??{}).length||i.Config?.OnBuild?.length)stop('HELPER_IMAGE_MISMATCH');}};
  const template=async()=>{const f=resolve(root,TEMPLATE);if(await realpath(f)!==f)stop('TEMPLATE_SYMLINK_REFUSED');return JSON.parse(await readFile(f,'utf8'));};
  const compareTemplate=async(p:Readonly<CreationPlan>)=>{
    const t=await template(),env={REGISTRATION_EXECUTOR_IMAGE:p.helpers.find(h=>h.service==='migration-executor')!.image,REGISTRATION_OBSERVER_IMAGE:p.helpers.find(h=>h.service==='observer')!.image};
    if(hash(t)!==p.templateSha256)stop('TEMPLATE_CHANGED');
    const effective=normalizeCompose(JSON.parse(await d(['compose','--env-file',process.platform==='win32'?'NUL':'/dev/null','--project-name',E.project,'--file',TEMPLATE,'config','--format','json','--no-normalize','--no-path-resolution'],env)));
    if(hash(effective)!==p.effectiveComposeSha256)stop('EFFECTIVE_COMPOSE_CHANGED');
    if(hash(Object.keys((effective as any).services).sort())!==hash(['migration-executor','observer'])||
      hash(Object.keys((effective as any).networks).sort())!==hash(['authority','database']))stop('TEMPLATE_ROSTER_MISMATCH');
    const serviceKeys=['image','container_name','platform','user','read_only','cap_drop','security_opt','entrypoint','command','restart','pids_limit','networks','volumes'];
    // Separate explicit plan must describe every service security field in this template.
    for(const h of p.helpers){const s=(effective as any).services[h.service];
      if(!s||Object.keys(s).some(k=>!serviceKeys.includes(k))||s.platform!==p.platform||s.restart!=='no'||s.pids_limit!==64||
        hash([...s.networks].sort())!==hash(['authority','database'])||s.image!==h.image||s.container_name!==h.name||s.user!==h.user||s.read_only!==true||hash(s.cap_drop)!==hash(h.capDrop)||
        hash(s.security_opt)!==hash(h.securityOpt)||hash(s.entrypoint)!==hash(h.entrypoint)||hash(s.command)!==hash(h.command)||
        (s.ports??[]).length||(s.volumes??[]).some((v:any)=>v.bind?.create_host_path!==false||Object.keys(v).some(k=>!['type','source','target','read_only','bind'].includes(k))||Object.keys(v.bind).length!==1)||
        hash((s.volumes??[]).map((v:any)=>({type:v.type,source:v.source,target:v.target,readOnly:v.read_only})))!==hash(h.mounts))stop('PLAN_TEMPLATE_MISMATCH');
    }
    const nets=(effective as any).networks;
    if(hash(nets.database)!==hash({name:E.network,external:true})||hash(nets.authority)!==hash({name:E.project+'-authority',internal:true}))stop('TEMPLATE_NETWORK_MISMATCH');
  };
  return {credentials,fence,authorize,
    observe:async p=>{
      const at=Date.now();await checkDaemon();const inv=await inventory(),n=await checkPostgres(p);await checkImages(p);await compareTemplate(p);
      if(projectItems(inv.containers).length!==1||projectItems(inv.containers)[0].id!==E.containerId||projectItems(inv.volumes).length!==1||projectItems(inv.volumes)[0].name!==E.volume||
        Object.keys(n.Containers??{}).join(',')!==E.containerId)stop('UNEXPECTED_RESOURCE');
      const newNetwork=(p as any).newNetwork;
      const authority=p.helpers[0].networks.find(x=>x.name!==E.network)!;
      if(newNetwork){if(projectItems(inv.networks).length!==1)stop('UNEXPECTED_RESOURCE');}
      else {if(projectItems(inv.networks).length!==2)stop('UNEXPECTED_RESOURCE');const network=await inspect('network',authority.id!);
        if(network.Name!==authority.name||registrationNetworkFingerprint(network)!==authority.configurationSha256||!network.Internal||network.Driver!=='bridge'||network.Labels?.['com.docker.compose.project']!==E.project||Object.keys(network.Containers??{}).length)stop('AUTHORITY_NETWORK_MISMATCH');}
      const protectedNow=await protectedSnapshot(inv);if(protectedBefore&&protectedNow!==protectedBefore)stop('PROTECTED_RESOURCES_CHANGED');protectedBefore=protectedNow;
      if(hash(inv)!==hash(await inventory())||Date.now()-at>30000)stop('INVENTORY_CHANGED_OR_STALE');await checkDaemon();
    },
    createNetwork:async(p,recordReturned)=>{
      const spec=(p as any).newNetwork;if(!spec)return undefined;
      const args=['network','create','--driver','bridge','--internal'];for(const [k,v]of Object.entries(spec.labels))args.push('--label',`${k}=${v}`);args.push(spec.name);
      const id=(await d(args)).trim();if(!hex.test(id))stop('NETWORK_CREATE_OUTCOME_UNKNOWN');
      await recordReturned(id); // fsync raw full ID before inspect can fail; this is NOT attestation.
      const n=await inspect('network',id);if(n.Name!==spec.name||n.Driver!=='bridge'||n.Internal!==true||hash(n.Labels)!==hash(spec.labels)||Object.keys(n.Containers??{}).length)stop('NETWORK_CREATE_IDENTITY_MISMATCH');
      return {name:n.Name,id,configurationSha256:registrationNetworkFingerprint(n)};
    },
    createHelper:async(p,h)=>docker(helperCreateArguments(p,h)),
    verifyCreated:async(p,ids,createdNetwork)=>{
      await checkDaemon();await checkPostgres(p);const inv=await inventory();
      if(projectItems(inv.containers).length!==3||projectItems(inv.networks).length!==2||projectItems(inv.volumes).length!==1)stop('UNEXPECTED_RESOURCE');
      const networks:Record<string,string>={};for(const name of [E.network,E.project+'-authority']){const n=await inspect('network',name);networks[name]=n.Id;
        const approved=p.helpers[0].networks.find(x=>x.name===name)!;
        if(approved.id!==null&&(n.Id!==approved.id||registrationNetworkFingerprint(n)!==approved.configurationSha256))stop('NETWORK_CHANGED');
        if(approved.id===null&&(!createdNetwork||n.Id!==createdNetwork.id||registrationNetworkFingerprint(n)!==createdNetwork.configurationSha256))stop('CREATED_NETWORK_CHANGED');
        const allowed=name===E.network?[E.containerId,...ids.map(x=>x.id)]:ids.map(x=>x.id);
        if(Object.keys(n.Containers??{}).some(id=>!allowed.includes(id)))stop('UNKNOWN_NETWORK_PEER');}
      for(const h of p.helpers){const identity=ids.find(x=>x.service===h.service)!;const c=await inspect('container',identity.id);if(c.Id!==identity.id)stop('POST_CREATE_CONTAINER_ID_MISMATCH');verifyCreatedHelper(h,c,await inspect('image',h.image),networks);}
      if(protectedBefore!==await protectedSnapshot(inv))stop('PROTECTED_RESOURCES_CHANGED');
    },
  };
}

/** Reconcile never writes, unlocks, adopts resources or repeats Docker creation. */
export async function inspectHelperCreation(ledger:RegistrationInfrastructureLedger){
  const s=await ledger.inspect();return {status:'READ_ONLY_RECONCILIATION_REQUIRED',creations:Object.values(s.creations).map(c=>({authorizationId:c.id,stage:c.stage,reservationId:c.reservation??null,identities:c.identities??[]})),...closed,
    next:'STOP_INDEPENDENT_REVIEW_REQUIRED_NO_RETRY_NO_AUTOMATIC_RECOVERY'};
}
