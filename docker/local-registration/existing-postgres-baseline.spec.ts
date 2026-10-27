import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {collectExistingRegistrationPostgresBaseline as collect,ExistingPostgresPolicy,BaselineIO,runExistingPostgresCLI} from './existing-postgres-baseline';
import {serviceFixture} from './service-phase.fixture';
import {configDigest,TEMPLATE_SHA256} from './admission';
import {normalizeCompose} from './collector';
import {REGISTRATION_PHONE_EXPECTED as E,registrationPeerFingerprint,registrationNetworkFingerprint} from './legacy-source/src/docker-phone-registration-target';

function fixture(){
  const s=serviceFixture().input.servicePhase!;
  s.network.Containers={[E.containerId]:s.network.Containers[E.containerId]};
  const template=readFileSync(resolve(__dirname,'compose.registration.json'),'utf8');
  const effective=normalizeCompose(JSON.parse(template));
  const policy:ExistingPostgresPolicy={context:E.context,daemonId:E.daemonId,platform:E.platform,postgresImage:E.image,
    existingPostgresBaseline:{containerId:E.containerId,networkId:s.network.Id,templateSha256:TEMPLATE_SHA256,
      effectiveComposeSha256:configDigest(effective),postgresSha256:registrationPeerFingerprint(s.postgres),networkSha256:registrationNetworkFingerprint(s.network),volumeSha256:configDigest(s.volume)}};
  const inv:{containers:{id:string;name:string;project:string}[];networks:{id:string;name:string;project:string}[];volumes:{name:string;project:string}[]}={containers:[{id:E.containerId,name:E.container,project:E.project}],networks:[{id:s.network.Id,name:E.network,project:E.project}],volumes:[{name:E.volume,project:E.project}]};
  const state:{daemon:string;context:string;time:number;unavailable:boolean}={daemon:E.daemonId,context:E.context,time:200000,unavailable:false};
  const objects=new Map<string,any>([[E.containerId,s.postgres],[E.image,s.postgresImage],[E.volume,s.volume],[s.network.Id,s.network]]);
  const docker=jest.fn(async(args:readonly string[])=>{
    if(state.unavailable)throw Error('sensitive error must not escape');
    if(args.join(' ')==='context show')return state.context;
    expect(args.slice(0,2)).toEqual(['--context',E.context]);const a=args.slice(2);
    if(a[0]==='info')return JSON.stringify({id:state.daemon,os:'linux',arch:'x86_64'});
    if(a[0]==='ps')return inv.containers.map(v=>JSON.stringify(v)).join('\n');
    if(a[0]==='network'&&a[1]==='ls')return inv.networks.map(v=>JSON.stringify(v)).join('\n');
    if(a[0]==='volume'&&a[1]==='ls')return inv.volumes.map(v=>JSON.stringify(v)).join('\n');
    if(a[0]==='compose'){
      expect(a).toContain('--no-interpolate');expect(a).not.toContain('up');
      return JSON.stringify(effective);
    }
    if(a[1]==='inspect'&&objects.has(a[2]))return JSON.stringify([objects.get(a[2])]);
    throw Error('unexpected command');
  });
  const io:BaselineIO={docker,now:()=>state.time,template:async()=>template};
  return {s,policy,inv,state,io,docker,objects,effective};
}
test('existing PostgreSQL without helpers is verified; all higher gates remain closed',async()=>{
  const f=fixture();const result=await collect('.',f.policy,'docker',f.io);
  expect(result).toMatchObject({status:'POSTGRES_BASELINE_VERIFIED',SERVICE_ADMITTED:false,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED:false,creation:'CREATION_AUTHORITY_NOT_PROVISIONED',clusterIdentifier:'NOT_CHECKED_NO_SQL'});
  expect(f.docker.mock.calls.every(([args])=>!args.some(v=>['create','run','start','stop','exec','pull','build','up','connect'].includes(v)))).toBe(true);
  expect(JSON.stringify(result)).not.toContain('Config');
});
test.each(['daemon','container','digest','platform','labels','healthy','compose','network-peer','extra-network','mount','volume','port','extra-container','extra-volume','extra-project-network'])('rejects %s mismatch',async kind=>{
  const f=fixture(),c=f.s.postgres;
  if(kind==='daemon')f.state.daemon='wrong';
  if(kind==='container')c.Id='f'.repeat(64);
  if(kind==='digest')f.s.postgresImage.Descriptor.digest='sha256:'+'0'.repeat(64);
  if(kind==='platform')f.s.postgresImage.Architecture='arm64';
  if(kind==='labels')c.Config.Labels['com.docker.compose.service']='backend';
  if(kind==='healthy')c.State.Health.Status='unhealthy';
  if(kind==='compose')(f.effective as any).services['postgres-test'].command=['override'];
  if(kind==='network-peer')f.s.network.Containers['f'.repeat(64)]={IPv4Address:'172.30.0.9/24'};
  if(kind==='extra-network')c.NetworkSettings.Networks.old={};
  if(kind==='mount')c.Mounts.push({Type:'bind',Source:'C:/unapproved'});
  if(kind==='volume')f.s.volume.Name='old-volume';
  if(kind==='port')c.HostConfig.PortBindings={'5432/tcp':[{HostPort:'5432'}]};
  if(kind==='extra-container')f.inv.containers.push({id:'f'.repeat(64),name:E.project+'-observer-1',project:E.project});
  if(kind==='extra-volume')f.inv.volumes.push({name:E.project+'-extra',project:E.project});
  if(kind==='extra-project-network')f.inv.networks.push({id:'f'.repeat(64),name:E.project+'-extra',project:E.project});
  expect(await collect('.',f.policy,'docker',f.io)).toMatchObject({status:'BLOCKED',SERVICE_ADMITTED:false,APPLY_ELIGIBLE:false});
});
test('existing four-field owner policy needs independent baseline assertions, without touching Docker',async()=>{
  const f=fixture();delete f.policy.existingPostgresBaseline;
  expect(await collect('.',f.policy,'docker',f.io)).toMatchObject({status:'BLOCKED',reason:'POLICY_INCOMPLETE'});
  expect(f.docker).not.toHaveBeenCalled();
});
test('missing base policy assertion blocks before daemon access',async()=>{
  const f=fixture();delete (f.policy as any).daemonId;
  expect(await collect('.',f.policy,'docker',f.io)).toMatchObject({status:'BLOCKED',reason:'POLICY_INCOMPLETE'});
  expect(f.docker).not.toHaveBeenCalled();
});
test('draft is never treated as approval',async()=>{
  const f=fixture();(f.policy as any).status='DRAFT';
  expect(await collect('.',f.policy,'docker',f.io)).toMatchObject({status:'BLOCKED',reason:'POLICY_INCOMPLETE'});
  expect(f.docker).not.toHaveBeenCalled();
});
test('unavailable CLI returns sanitized non-success',async()=>{
  const f=fixture();f.state.unavailable=true;
  expect(await collect('.',f.policy,'docker',f.io)).toMatchObject({status:'BLOCKED',reason:'DOCKER_UNAVAILABLE'});
});
test('CLI rejects extra approval switches and relative executable path without execution',async()=>{
  expect(await runExistingPostgresCLI(['policy','--approve'])).toMatchObject({status:'BLOCKED'});
  expect(await runExistingPostgresCLI(['policy','--docker-cli','relative.exe'])).toMatchObject({status:'BLOCKED'});
});
test('protected project fingerprint changes block baseline',async()=>{
  const f=fixture(),id='f'.repeat(64),name='cashback-finance-security-9f-pg-1';
  f.inv.containers.push({id,name,project:'cashback-finance-security-9f'});
  f.objects.set(id,{Id:id,Config:{Image:'unchanged'},HostConfig:{},Mounts:[],NetworkSettings:{Networks:{},Ports:{}},State:{Status:'running'}});
  const original=f.io.docker;let observations=0;
  f.io.docker=async args=>{
    if(args.includes('inspect')&&args.includes(id)&&++observations===2)f.objects.get(id).Config.Image='changed';
    return original(args);
  };
  expect(await collect('.',f.policy,'docker',f.io)).toMatchObject({status:'BLOCKED',reason:'UNEXPECTED_RESOURCE'});
});
test('expired evidence cannot verify baseline',async()=>{
  const f=fixture();let tick=0;f.io.now=()=>tick++===0?200000:230001;
  expect(await collect('.',f.policy,'docker',f.io)).toMatchObject({status:'BLOCKED',reason:'IDENTITY_MISMATCH'});
});
