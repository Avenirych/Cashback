import {firstStartHelpers,HelperCreationBlocked,productionHelperCreationIO} from './helper-creation';
import type {HelperCreationIO} from './helper-creation';
import {creationFenceFromProvider,executeCreationControlPlane} from './creation-control-plane';
import {creationHelperSpecDigest,creationFencingBindingDigest} from '../../src/docker-phone-creation-contract';
import type {CreationPlan,CreationHelper,CreationAuthorizationEnvelope} from '../../src/docker-phone-creation-contract';
import type {SignedApprovalReader} from '../../src/docker-phone-approved-evidence';
import {REGISTRATION_PHONE_EXPECTED as E,registrationSecurityDigest as hash} from '../../src/docker-phone-registration-target';

const h=(s:string)=>s.repeat(64);
function fixture(){
  const network:NonNullable<CreationPlan['newNetwork']>={name:E.project+'-authority',driver:'bridge',internal:true,
    labels:{'com.docker.compose.project':E.project,'com.docker.compose.network':'authority'},ipam:{},options:{}};
  const helpers=(['migration-executor','observer'] as const).map(service=>{
    const v:CreationHelper={service,name:`${E.project}-${service}-1`,image:`example.test/offline-${service}@sha256:${h('a')}`,configurationSha256:'',
      mounts:[{type:'bind',source:'C:/approved-registration-infrastructure/public',target:'/run/registration/public',readOnly:true}],
      networks:[{name:E.network,id:h('b'),configurationSha256:h('c')},{name:network.name,id:null,configurationSha256:hash(network)}],
      labels:{'com.docker.compose.project':E.project,'com.docker.compose.service':service},capAdd:[],capDrop:['ALL'],securityOpt:['no-new-privileges:true'],readOnly:true,user:'999:999',entrypoint:['node'],command:['helper.cjs',service],ports:[]};
    v.configurationSha256=creationHelperSpecDigest(v);return v;
  });
  const plan:CreationPlan={format:'registration-helper-creation/v1',identity:{context:E.context,daemonId:E.daemonId,project:E.project,postgresContainerId:E.containerId},
    platform:'linux/amd64',phase:'baseline',templateSha256:h('d'),effectiveComposeSha256:h('e'),postgresBaselineSha256:h('f'),newNetwork:network,helpers,
    fencing:{provider:'offline-test-enforcer',epoch:'1',bindingSha256:h('1')},expiresAt:Date.now()+50000};
  plan.fencing.bindingSha256=creationFencingBindingDigest(plan);
  let reserved=false;
  const journal={reserve:jest.fn(async()=>{reserved=true;return h('2');}),assertReserved:jest.fn(async()=>{}),progress:jest.fn(async()=>{}),record:jest.fn(async()=>{}),unknown:jest.fn(async()=>{})};
  const io:HelperCreationIO={credentials:jest.fn(async()=>{}),fence:{held:jest.fn(async()=>true)},observe:jest.fn(async()=>{}),
    authorize:jest.fn(async()=>({} as CreationAuthorizationEnvelope)),createNetwork:jest.fn(async(_p,recordReturned)=>{expect(reserved).toBe(true);await recordReturned(h('3'));return {name:network.name,id:h('3'),configurationSha256:h('4')};}),
    createHelper:jest.fn(async(_p,v)=>{expect(reserved).toBe(true);return v.service==='observer'?h('6'):h('5');}),verifyCreated:jest.fn(async()=>{})};
  return {plan,journal,io};
}
test('First-Start reserves durably before all Docker mutations, records IDs and stops unverified',async()=>{
  const f=fixture();const result=await firstStartHelpers(f.plan,f.journal,f.io);
  expect(result).toMatchObject({status:'CREATED_UNVERIFIED',SERVICE_ADMITTED:false,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED:false});
  expect(f.journal.record).toHaveBeenCalledWith(h('2'),f.plan,[{service:'migration-executor',id:h('5')},{service:'observer',id:h('6')}],{name:E.project+'-authority',id:h('3'),configurationSha256:h('4')});
  expect(f.journal.unknown).not.toHaveBeenCalled();
  expect(f.journal.progress).toHaveBeenCalledTimes(4);
});
test.each(['credentials','approval','fencing','reservation'])('missing %s blocks before Docker mutation',async kind=>{
  const f=fixture();
  if(kind==='credentials')jest.mocked(f.io.credentials).mockRejectedValue(Error('secret-not-logged'));
  if(kind==='approval')jest.mocked(f.io.authorize).mockRejectedValue(Error('NO_APPROVAL'));
  if(kind==='fencing')jest.mocked(f.io.fence.held).mockResolvedValue(false);
  if(kind==='reservation')f.journal.reserve.mockRejectedValue(Error('DURABLE_WRITE_FAILED'));
  await expect(firstStartHelpers(f.plan,f.journal,f.io)).rejects.toThrow();
  expect(f.io.createNetwork).not.toHaveBeenCalled();expect(f.io.createHelper).not.toHaveBeenCalled();
});
test('failure between durable reservation and Docker create records unknown without attempting creation',async()=>{
  const f=fixture();jest.mocked(f.io.observe).mockResolvedValueOnce(undefined).mockRejectedValue(Error('DRIFT'));
  await expect(firstStartHelpers(f.plan,f.journal,f.io)).rejects.toThrow('RECONCILIATION_REQUIRED');
  expect(f.journal.unknown).toHaveBeenCalled();expect(f.io.createNetwork).not.toHaveBeenCalled();expect(f.io.createHelper).not.toHaveBeenCalled();
});
test('expiry during fresh pre-create inspection stops before network creation',async()=>{
  const f=fixture(),time=Date.now();jest.spyOn(Date,'now').mockReturnValue(time);
  jest.mocked(f.io.observe).mockImplementation(async()=>{if(jest.mocked(f.io.observe).mock.calls.length===2)jest.mocked(Date.now).mockReturnValue(time+60000);});
  try{await expect(firstStartHelpers(f.plan,f.journal,f.io)).rejects.toThrow('PLAN_EXPIRED');expect(f.io.createNetwork).not.toHaveBeenCalled();expect(f.journal.unknown).toHaveBeenCalled();}
  finally{jest.restoreAllMocks();}
});
test('production collector rejects signed database network mismatch before any mutation or approval request',async()=>{
  const f=fixture(),baseline={containerId:E.containerId,networkId:h('0'),templateSha256:h('1'),effectiveComposeSha256:h('2'),postgresSha256:h('3'),networkSha256:h('4'),volumeSha256:h('5')};
  f.plan.postgresBaselineSha256=hash(baseline);f.plan.fencing.bindingSha256=creationFencingBindingDigest(f.plan);
  const docker=jest.fn(async(args:readonly string[])=>{
    if(args[0]==='context')return E.context;
    const a=args.slice(2);if(a[0]==='info')return JSON.stringify({id:E.daemonId,os:'linux',arch:'amd64'});
    if(a[0]==='ps')return JSON.stringify({id:E.containerId,name:E.container,project:E.project});
    if(a[0]==='network'&&a[1]==='ls')return JSON.stringify({id:h('0'),name:E.network,project:E.project});
    if(a[0]==='volume'&&a[1]==='ls')return JSON.stringify({name:E.volume,project:E.project});throw Error('unexpected IO');
  });
  const authorize=jest.fn();const io=productionHelperCreationIO('.',docker,{context:E.context,daemonId:E.daemonId,platform:E.platform,postgresImage:E.image,existingPostgresBaseline:baseline},f.io.credentials,f.io.fence,authorize);
  await expect(firstStartHelpers(f.plan,f.journal,io)).rejects.toThrow('DATABASE_NETWORK_PLAN_MISMATCH');
  expect(authorize).not.toHaveBeenCalled();expect(f.journal.reserve).not.toHaveBeenCalled();
  expect(docker.mock.calls.every(([args])=>!args.includes('create'))).toBe(true);
});
test('unknown second Docker create stores partial identities and never retries, removes or starts',async()=>{
  const f=fixture();jest.mocked(f.io.createHelper).mockResolvedValueOnce(h('5')).mockRejectedValue(Error('daemon-timeout'));
  await expect(firstStartHelpers(f.plan,f.journal,f.io)).rejects.toThrow('RECONCILIATION_REQUIRED');
  expect(f.io.createHelper).toHaveBeenCalledTimes(2);expect(f.journal.record).not.toHaveBeenCalled();
  expect(f.journal.unknown).toHaveBeenCalledWith(h('2'),f.plan,{identities:[{service:'migration-executor',id:h('5')}],network:{name:E.project+'-authority',id:h('3'),configurationSha256:h('4')}});
});
test('post-create ID mismatch never produces verified or admitted state',async()=>{
  const f=fixture();jest.mocked(f.io.verifyCreated).mockRejectedValue(new HelperCreationBlocked('POST_CREATE_CONTAINER_ID_MISMATCH'));
  await expect(firstStartHelpers(f.plan,f.journal,f.io)).rejects.toThrow('POST_CREATE_CONTAINER_ID_MISMATCH');
  expect(f.journal.record).toHaveBeenCalledTimes(1);
});
test('lost fencing during creation stops before next helper',async()=>{
  const f=fixture();jest.mocked(f.io.fence.held).mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
  await expect(firstStartHelpers(f.plan,f.journal,f.io)).rejects.toThrow('FENCING_LOST');expect(f.io.createHelper).toHaveBeenCalledTimes(1);
});
test.each(['daemon','digest','mount','network','capabilities'])('changed %s is rejected without observation or mutation',async kind=>{
  const f=fixture(),p=JSON.parse(JSON.stringify(f.plan));
  if(kind==='daemon')p.identity.daemonId='wrong';if(kind==='digest')p.helpers[0].image='floating:latest';
  if(kind==='mount')p.helpers[0].mounts[0].readOnly=false;if(kind==='network')p.helpers[0].networks[0].name='cashback-finance-security-9f';
  if(kind==='capabilities')p.helpers[0].capAdd=['SYS_ADMIN'];
  await expect(firstStartHelpers(p,f.journal,f.io)).rejects.toThrow();expect(f.io.observe).not.toHaveBeenCalled();expect(f.journal.reserve).not.toHaveBeenCalled();
});
test('external provider evidence must actually bind creation lease and exclude competing controllers',async()=>{
  const f=fixture(),payload={scope:'registration-helper-creation',provider:f.plan.fencing.provider,fencingEpoch:'1',bindingSha256:f.plan.fencing.bindingSha256,
    identity:f.plan.identity,exclusive:true,continuous:true,uncontrolledEntrypoints:0,competingControllers:0,observedAt:Date.now(),expiresAt:Date.now()+2000};
  const readPayload=jest.fn(async(_scope:string,_signal:AbortSignal)=>payload),provider={readPayload} as unknown as SignedApprovalReader;
  await expect(creationFenceFromProvider(provider).held(f.plan)).resolves.toBe(true);expect(readPayload.mock.calls[0][0]).toBe(hash(f.plan));
  for(const key of ['provider','fencingEpoch','bindingSha256','exclusive','continuous','uncontrolledEntrypoints','competingControllers'] as const){
    const altered:any={...payload,[key]:typeof payload[key]==='boolean'?false:typeof payload[key]==='number'?1:'wrong'};
    readPayload.mockResolvedValueOnce(altered);await expect(creationFenceFromProvider(provider).held(f.plan)).rejects.toThrow('EXTERNAL_FENCING_NOT_HELD');
  }
  await expect(creationFenceFromProvider(null).held(f.plan)).rejects.toThrow('EXTERNAL_FENCING_PROVIDER_MISSING');
});
test('CLI approval/execute flags cannot become a source of creation authority',async()=>{
  for(const operation of ['first-start','post-start','reconcile'])await expect(executeCreationControlPlane(operation,['--approve','--execute'])).resolves.toMatchObject({status:'BLOCKED',SERVICE_ADMITTED:false,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED:false});
});
