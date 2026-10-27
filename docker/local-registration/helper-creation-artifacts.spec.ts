import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {helperCreateArguments,verifyCreatedHelper,verifyRunningCreationPlan} from './helper-creation';
import type {CreationHelper,CreationPlan} from './legacy-source/src/docker-phone-creation-contract';
import {REGISTRATION_PHONE_EXPECTED as E,registrationPeerFingerprint} from './legacy-source/src/docker-phone-registration-target';

// Exact source artifact contract, with in-memory Docker metadata only.
const compose=JSON.parse(readFileSync(resolve(__dirname,'helpers/compose.helpers.json'),'utf8'));
const hex=(v:string)=>v.repeat(64);
function fixture(service:'migration-executor'|'observer'='migration-executor'){
  const s=compose.services[service];
  const networks={[E.network]:hex('1'),[`${E.project}-authority`]:hex('2')};
  const helper:CreationHelper={service,name:s.container_name,image:`example.test/synthetic-${service}@sha256:${hex('3')}`,configurationSha256:hex('4'),
    mounts:s.volumes.map((v:any)=>({type:v.type,source:v.source,target:v.target,readOnly:v.read_only})),
    networks:Object.entries(networks).map(([name,id])=>({name,id,configurationSha256:hex('5')})),
    labels:{'com.docker.compose.project':E.project,'com.docker.compose.service':service},
    capAdd:[],capDrop:['ALL'],securityOpt:['no-new-privileges:true'],readOnly:true,user:s.user,
    entrypoint:s.entrypoint,command:s.command,ports:[]};
  const image={Id:`sha256:${hex('6')}`,Os:'linux',Architecture:'amd64',Descriptor:{digest:hex('3').replace(/^/,'sha256:')}};
  const container={Id:hex('7'),Image:image.Id,Name:'/'+helper.name,State:{Status:'created'},
    Config:{Image:helper.image,Entrypoint:helper.entrypoint,Cmd:helper.command,User:helper.user,Labels:helper.labels},
    HostConfig:{PublishAllPorts:false,PortBindings:{},ReadonlyRootfs:true,CapAdd:[],CapDrop:['ALL'],SecurityOpt:helper.securityOpt,
      Privileged:false,PidMode:'',IpcMode:'private',PidsLimit:64,Devices:[],DeviceRequests:[],Tmpfs:{}},
    Mounts:helper.mounts.map(m=>({Type:m.type,Source:m.source,Destination:m.target,RW:false})),
    NetworkSettings:{Ports:{},Networks:Object.fromEntries(Object.entries(networks).map(([name,NetworkID])=>[name,{NetworkID}]))}};
  return {helper,image,container,networks};
}

test.each(['migration-executor','observer'] as const)('%s source entrypoint/Cmd survives Docker create exact projection',service=>{
  const f=fixture(service),args=helperCreateArguments({platform:'linux/amd64'} as CreationPlan,f.helper);
  expect(f.helper.entrypoint).toHaveLength(1);
  const index=args.indexOf('--entrypoint');
  expect(args.slice(index)).toEqual(['--entrypoint',f.helper.entrypoint[0],f.helper.image,...f.helper.command]);
  expect(args).not.toContain('run');expect(args).not.toContain('start');
  expect(args).toContain('--pull=never');expect(args).not.toContain('--publish');
  expect(()=>verifyCreatedHelper(f.helper,f.container,f.image,f.networks)).not.toThrow();
});

test.each(['extra-mount','writable-mount','host-port','privileged','cap-add','wrong-command','wrong-entrypoint','wrong-image','wrong-network','unknown-label','already-running','unbounded-pids'])(
  'post-create %s drift cannot be accepted as exact created identity',kind=>{
    const f=fixture();const c=JSON.parse(JSON.stringify(f.container)),image=JSON.parse(JSON.stringify(f.image));
    if(kind==='extra-mount')c.Mounts.push({Type:'volume',Source:'/unapproved',Destination:'/data',RW:true});
    if(kind==='writable-mount')c.Mounts[0].RW=true;
    if(kind==='host-port')c.HostConfig.PortBindings={'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'5432'}]};
    if(kind==='privileged')c.HostConfig.Privileged=true;
    if(kind==='cap-add')c.HostConfig.CapAdd=['SYS_ADMIN'];
    if(kind==='wrong-command')c.Config.Cmd=['/bin/sh'];
    if(kind==='wrong-entrypoint')c.Config.Entrypoint=['/bin/sh'];
    if(kind==='wrong-image')image.Descriptor.digest=`sha256:${hex('8')}`;
    if(kind==='wrong-network')c.NetworkSettings.Networks[E.network].NetworkID=hex('8');
    if(kind==='unknown-label')c.Config.Labels.unapproved='yes';
    if(kind==='already-running')c.State.Status='running';
    if(kind==='unbounded-pids')c.HostConfig.PidsLimit=-1;
    expect(()=>verifyCreatedHelper(f.helper,c,image,f.networks)).toThrow('POST_CREATE_CONFIGURATION_MISMATCH');
  });

test.each([false,true])('running desired-spec validation rejects drift even if a phase fingerprint includes it: %s',async drift=>{
  const values=[fixture('migration-executor'),fixture('observer')];
  const objects=new Map<string,unknown>();
  for(const [i,v]of values.entries()){
    v.container.Id=hex(String(i+7));v.container.State.Status='running';
    if(drift&&i===0)v.container.Config.Cmd=['/bin/sh'];
    objects.set(v.container.Id,v.container);objects.set(v.helper.image,v.image);
  }
  const peers=values.map(v=>({service:v.helper.service,id:v.container.Id,name:v.helper.name,image:v.helper.image,configurationSha256:registrationPeerFingerprint(v.container)}));
  const policy={existingPostgresBaseline:{networkId:hex('1')},servicePhase:{peers,controlNetwork:{id:hex('2')}}} as any;
  const docker=jest.fn(async(args:readonly string[])=>{
    expect(args.slice(0,2)).toEqual(['--context',E.context]);expect(args[3]).toBe('inspect');
    const object=objects.get(args[4]);if(!object)throw Error('Unknown fixture identity');return JSON.stringify([object]);
  });
  const result=verifyRunningCreationPlan({helpers:values.map(v=>v.helper)} as unknown as CreationPlan,policy,docker);
  if(drift)await expect(result).rejects.toThrow('POST_CREATE_CONFIGURATION_MISMATCH');else await expect(result).resolves.toBeUndefined();
  expect(docker.mock.calls.every(([args])=>!args.includes('create')&&!args.includes('start'))).toBe(true);
});
