import {execFile} from 'node:child_process';
import {readFile,realpath} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {AdmissionPolicy,COMPOSE_FILE,configDigest,TEMPLATE_SHA256} from './admission';
import {normalizeCompose} from './collector';
import {REGISTRATION_PHONE_EXPECTED as E,registrationPeerFingerprint,registrationNetworkFingerprint} from './legacy-source/src/docker-phone-registration-target';

/** Independent owner assertions, not populated from observations by this collector. */
export interface ExistingPostgresPolicy extends AdmissionPolicy {
  existingPostgresBaseline?: {
    containerId:string;networkId:string;templateSha256:string;effectiveComposeSha256:string;
    postgresSha256:string;networkSha256:string;volumeSha256:string;
  };
}
type Reason='POLICY_INCOMPLETE'|'IDENTITY_MISMATCH'|'UNEXPECTED_RESOURCE'|'DOCKER_UNAVAILABLE';
class BaselineBlocked extends Error {constructor(readonly reason:Reason){super(reason);}}
function stop(reason:Reason):never {throw new BaselineBlocked(reason);}
const hash=(v:any)=>configDigest(v);
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export interface BaselineIO {
  docker(args:readonly string[]):Promise<string>;
  template():Promise<string>;
  now():number;
}
function productionIO(root:string,executable:string):BaselineIO {
  const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA']
    .flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]!]]));
  return {now:Date.now,template:async()=>{
    const file=resolve(root,COMPOSE_FILE);
    if(await realpath(file)!==file)stop('IDENTITY_MISMATCH');
    return readFile(file,'utf8');
  },docker:args=>new Promise((ok,no)=>{
    execFile(executable,[...args],{cwd:root,env:{...env,COMPOSE_DISABLE_ENV_FILE:'1'},shell:false,windowsHide:true,timeout:10000,maxBuffer:16*1024*1024},
      (error,stdout)=>error?no(new BaselineBlocked('DOCKER_UNAVAILABLE')):ok(stdout));
  })};
}
const closed={SERVICE_ADMITTED:false,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED:false,
  creation:'CREATION_AUTHORITY_NOT_PROVISIONED',clusterIdentifier:'NOT_CHECKED_NO_SQL'} as const;
const protectedProject=(name:string)=>name==='cashback-docker-test'||name==='cashback-finance-security-9f';

/** Docker-only baseline; no DB, secrets, authority issuance or mutation transport. */
export async function collectExistingRegistrationPostgresBaseline(root:string,reviewed:ExistingPostgresPolicy,
  dockerExecutable='docker',io:BaselineIO=productionIO(resolve(root),dockerExecutable)) {
  try {
    const policy=structuredClone(reviewed),p=policy?.existingPostgresBaseline;
    if(!p||['daemonId','context','postgresImage','platform'].some(key=>typeof (policy as any)[key]!=='string'||!(policy as any)[key])||
      ('status' in policy&&policy.status!=='APPROVED')||
      ![p.templateSha256,p.effectiveComposeSha256,p.postgresSha256,p.networkSha256,p.volumeSha256,p.networkId,p.containerId].every(hex))stop('POLICY_INCOMPLETE');
    if(policy.context!==E.context||policy.daemonId!==E.daemonId||policy.platform!==E.platform||policy.postgresImage!==E.image||p.containerId!==E.containerId||p.templateSha256!==TEMPLATE_SHA256)stop('IDENTITY_MISMATCH');
    const start=io.now();
    const docker=(args:string[])=>io.docker(['--context',E.context,...args]);
    const json=async(args:string[])=>JSON.parse(await docker(args));
    const context=async()=>(await io.docker(['context','show'])).trim();
    const info=()=>json(['info','--format','{"id":{{json .ID}},"os":{{json .OSType}},"arch":{{json .Architecture}}}']);
    const checkDaemon=async()=>{
      const v=await info();
      if(await context()!==E.context||v.id!==E.daemonId||v.os!=='linux'||!['amd64','x86_64'].includes(v.arch))stop('IDENTITY_MISMATCH');
    };
    const inventory=async()=>{
      const list=async(args:string[]) => (await docker(args)).split(/\r?\n/).filter(Boolean).map(v=>JSON.parse(v));
      // List all resources, including stopped containers. Compose project labels are
      // obtained using Docker's Label accessor rather than parsing display strings.
      const project='"project":{{json (.Label "com.docker.compose.project")}}';
      const containers=await list(['ps','--all','--no-trunc','--format',`{"id":{{json .ID}},"name":{{json .Names}},${project}}`]);
      const networks=await list(['network','ls','--no-trunc','--format',`{"id":{{json .ID}},"name":{{json .Name}},${project}}`]);
      const volumes=await list(['volume','ls','--format',`{"name":{{json .Name}},${project}}`]);
      for(const group of [containers,networks,volumes]) {
        if(group.some(v=>typeof v.name!=='string'||!v.name||typeof v.project!=='string')||new Set(group.map(v=>v.name)).size!==group.length)stop('DOCKER_UNAVAILABLE');
        group.sort((a,b)=>a.name.localeCompare(b.name));
      }
      if([...containers,...networks].some(v=>!hex(v.id)))stop('DOCKER_UNAVAILABLE');
      for(const [kind,expected] of [['containers',E.container],['networks',E.network],['volumes',E.volume]] as const){
        const items=({containers,networks,volumes})[kind].filter(v=>v.project===E.project||v.name.startsWith(E.project));
        if(items.length!==1||items[0].name!==expected||items[0].project!==E.project)stop('UNEXPECTED_RESOURCE');
      }
      if(containers.find(v=>v.name===E.container)?.id!==E.containerId||networks.find(v=>v.name===E.network)?.id!==p.networkId)stop('IDENTITY_MISMATCH');
      return {containers,networks,volumes};
    };
    const inspect=async(kind:string,id:string)=>{
      const v=await json([kind,'inspect',id]);
      if(!Array.isArray(v)||v.length!==1)stop('DOCKER_UNAVAILABLE');
      return v[0];
    };
    const stable=(kind:string,v:any)=>kind==='container'?{configuration:registrationPeerFingerprint(v),
      state:v.State?.Status,health:v.State?.Health?.Status??null,networks:v.NetworkSettings?.Networks,ports:v.NetworkSettings?.Ports}:v;
    const protectedSnapshot=async(inv:Awaited<ReturnType<typeof inventory>>)=>{
      const result:Record<string,string>={};
      for(const [kind,items] of [['container',inv.containers],['network',inv.networks],['volume',inv.volumes]] as const)
        for(const v of items.filter(v=>protectedProject(v.project)||v.name.startsWith('cashback-docker-test-')||v.name.startsWith('cashback-finance-security-9f-')))
          result[kind+':'+v.name]=hash(stable(kind,await inspect(kind,'id' in v?v.id:v.name)));
      return result;
    };
    await checkDaemon();
    const first=await inventory(),protectedBefore=await protectedSnapshot(first);
    const template=JSON.parse(await io.template());
    if(hash(template)!==p.templateSha256)stop('IDENTITY_MISMATCH');
    // No interpolation: preserve placeholders; never load registration.env or credentials.
    // The independently approved hash must describe THIS exact render mode.
    const render=async()=>normalizeCompose(await json(['compose','--env-file',process.platform==='win32'?'NUL':'/dev/null',
      '--project-name',E.project,'--file',COMPOSE_FILE,'--profile','*','config','--format','json','--no-interpolate','--no-normalize','--no-path-resolution']));
    const effective=await render();
    if(hash(effective)!==p.effectiveComposeSha256)stop('IDENTITY_MISMATCH');
    const c=await inspect('container',E.containerId),image=await inspect('image',E.image),v=await inspect('volume',E.volume),n=await inspect('network',p.networkId);
    if(c.Id!==E.containerId||c.Name!=='/'+E.container||c.Config?.Image!==E.image||c.Config.Labels?.['com.docker.compose.project']!==E.project||c.Config.Labels?.['com.docker.compose.service']!=='postgres-test'||
      c.State?.Status!=='running'||c.State.Health?.Status!=='healthy'||registrationPeerFingerprint(c)!==p.postgresSha256||
      image.Id!==c.Image||!/^sha256:[a-f0-9]{64}$/.test(image.Id)||image.Descriptor?.digest!==E.image.split('@')[1]||image.Os!=='linux'||image.Architecture!=='amd64'||
      (image.Descriptor.platform&&(image.Descriptor.platform.os!=='linux'||image.Descriptor.platform.architecture!=='amd64')))stop('IDENTITY_MISMATCH');
    if(c.HostConfig?.PublishAllPorts!==false||Object.keys(c.HostConfig.PortBindings??{}).length||
      Object.values(c.NetworkSettings?.Ports??{}).some((x:any)=>x!==null&&(!Array.isArray(x)||x.length)))stop('UNEXPECTED_RESOURCE');
    if(c.Mounts?.length!==1||c.Mounts[0].Type!=='volume'||c.Mounts[0].Name!==E.volume||c.Mounts[0].Destination!=='/var/lib/postgresql/data'||
      v.Name!==E.volume||v.Driver!=='local'||Object.keys(v.Options??{}).length||v.Labels?.['com.docker.compose.project']!==E.project||c.Mounts[0].Source!==v.Mountpoint||hash(v)!==p.volumeSha256)stop('UNEXPECTED_RESOURCE');
    if(n.Name!==E.network||n.Id!==p.networkId||n.Driver!=='bridge'||n.Internal!==true||n.Labels?.['com.docker.compose.project']!==E.project||registrationNetworkFingerprint(n)!==p.networkSha256||
      Object.keys(c.NetworkSettings.Networks).join(',')!==E.network||c.NetworkSettings.Networks[E.network].NetworkID!==n.Id||
      Object.keys(n.Containers??{}).join(',')!==E.containerId||!c.NetworkSettings.Networks[E.network].IPAddress||
      n.Containers[E.containerId].IPv4Address?.split('/')[0]!==c.NetworkSettings.Networks[E.network].IPAddress)stop('UNEXPECTED_RESOURCE');
    for(const [kind,id,value] of [['container',E.containerId,c],['image',E.image,image],['volume',E.volume,v],['network',p.networkId,n]])
      if(hash(stable(kind,value))!==hash(stable(kind,await inspect(kind,id))))stop('IDENTITY_MISMATCH');
    const second=await inventory();
    if(hash(first)!==hash(second)||hash(protectedBefore)!==hash(await protectedSnapshot(second)))stop('UNEXPECTED_RESOURCE');
    if(hash(JSON.parse(await io.template()))!==p.templateSha256||hash(await render())!==p.effectiveComposeSha256)stop('IDENTITY_MISMATCH');
    await checkDaemon();
    const end=io.now();if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>30000)stop('IDENTITY_MISMATCH');
    return {status:'POSTGRES_BASELINE_VERIFIED' as const,...closed,checkedAt:end,containerId:E.containerId,
      protectedResources:'UNCHANGED_DURING_COLLECTION',policySha256:hash(policy)};
  } catch(error) {
    return {status:'BLOCKED' as const,reason:error instanceof BaselineBlocked?error.reason:'DOCKER_UNAVAILABLE',...closed};
  }
}

export async function runExistingPostgresCLI(args:readonly string[]) {
  if(!(args.length===1||(args.length===3&&args[1]==='--docker-cli'&&isAbsolute(args[2]))))
    return {status:'BLOCKED',reason:'POLICY_INCOMPLETE',...closed};
  try {
    const policy=JSON.parse(await readFile(resolve(args[0]),'utf8'));
    return await collectExistingRegistrationPostgresBaseline(resolve(__dirname,'../..'),policy,args[2]??'docker');
  } catch {return {status:'BLOCKED',reason:'POLICY_INCOMPLETE',...closed};}
}
if(require.main===module)void runExistingPostgresCLI(process.argv.slice(2)).then(result=>{
  process.stdout.write(JSON.stringify(result)+'\n');if(result.status==='BLOCKED')process.exitCode=1;
}).catch(()=>{process.stdout.write(JSON.stringify({status:'BLOCKED',reason:'DOCKER_UNAVAILABLE',...closed})+'\n');process.exitCode=1;});
