import { executeCreationControlPlane } from './creation-control-plane';
import { REGISTRATION_PHONE_EXPECTED as E, registrationSecurityDigest as hash } from './legacy-source/src/docker-phone-registration-target';

// Explicit offline dependency mocks. No protected file, daemon, service, ledger or SQL IO.
const mockOrder:string[]=[];
let mockState:any,mockPolicy:any,mockCreation:any,mockProduction:any;
const mockCap={fixture:'independently-loaded-production-capability'};
const mockCollector=jest.fn();
const mockVerifyRunning=jest.fn();
const mockInstall=jest.fn();
const mockLedger={inspect:jest.fn(),transaction:jest.fn()};
jest.mock('./legacy-source/src/docker-phone-infrastructure-ledger',()=>({RegistrationInfrastructureLedger:jest.fn(()=>mockLedger)}));
jest.mock('./legacy-source/src/docker-phone-production-configuration',()=>({
  loadCreationProductionPrerequisites:jest.fn(async()=>({fixture:'creation-capability'})),
  creationProductionComponents:jest.fn(()=>mockCreation),
  loadProductionMigrationConfiguration:jest.fn(async()=>mockCap),
  productionMigrationComponents:jest.fn(()=>mockProduction),
}));
jest.mock('./legacy-source/src/docker-phone-access-sources',()=>({installProductionMigrationConfiguration:(...args:any[])=>mockInstall(...args)}));
jest.mock('./collector',()=>({collectRegistrationServicePhase:(...args:any[])=>mockCollector(...args),productionCollectorIO:jest.fn(()=>({fixture:'real-collector-io-slot'}))}));
jest.mock('./helper-creation',()=>({...jest.requireActual('./helper-creation'),verifyRunningCreationPlan:(...args:any[])=>mockVerifyRunning(...args)}));

const h=(c:string)=>c.repeat(64);
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const invoke=()=>executeCreationControlPlane('post-start',['--creation-config','C:\\fixture\\creation.json','--production-config','C:\\fixture\\production.json','--creation-id','fixture-create'],'C:\\fixture\\repository');
beforeEach(()=>{
  jest.clearAllMocks();jest.spyOn(Date,'now').mockReturnValue(1000);mockOrder.splice(0);
  const peers=(['migration-executor','observer'] as const).map((service,i)=>({service,id:h(i?'2':'1'),name:`${E.project}-${service}-1`,image:`fixture.example.test/${service}@sha256:${h('3')}`,configurationSha256:h(i?'5':'4')}));
  const network={name:E.project+'-authority',id:h('6'),configurationSha256:h('7')};
  const baseline={containerId:E.containerId,networkId:h('8'),templateSha256:h('9'),effectiveComposeSha256:h('9'),postgresSha256:h('a'),networkSha256:h('b'),volumeSha256:h('c')};
  const plan={identity:{context:E.context,daemonId:E.daemonId,project:E.project,postgresContainerId:E.containerId},phase:'baseline',templateSha256:h('d'),effectiveComposeSha256:h('e'),postgresBaselineSha256:hash(baseline),
    helpers:peers.map(p=>({service:p.service,name:p.name,image:p.image,networks:[{name:E.network,id:h('8'),configurationSha256:h('b')},{...network}]})),fencing:{provider:'fixture-fencing',epoch:'1',bindingSha256:h('f')}};
  const row={id:'fixture-create',stage:'IDENTITY_ATTESTED',reservation:h('a'),scope:hash(plan),plan,network,identities:peers.map(({service,id})=>({service,id})),
    attestation:{expiresAt:20000,identities:peers.map(p=>({service:p.service,id:p.id,observedConfigurationSha256:p.configurationSha256}))}};
  mockState={creations:{'fixture-create':row}};
  mockPolicy={daemonId:E.daemonId,context:E.context,postgresImage:E.image,platform:E.platform,existingPostgresBaseline:baseline,
    servicePhase:{phase:'baseline',file:'docker/local-registration/helpers/compose.helpers.json',templateSha256:plan.templateSha256,effectiveSha256:plan.effectiveComposeSha256,peers,controlNetwork:network}};
  mockCreation={assertCredentials:jest.fn(async()=>{}),assertLedger:jest.fn(async()=>{}),readOwnerPolicy:jest.fn(async()=>clone(mockPolicy)),
    fencing:{readPayload:jest.fn(async()=>({scope:'registration-helper-creation',provider:plan.fencing.provider,fencingEpoch:'1',bindingSha256:plan.fencing.bindingSha256,identity:plan.identity,
      exclusive:true,continuous:true,uncontrolledEntrypoints:0,competingControllers:0,observedAt:1000,expiresAt:4000}))}};
  mockProduction={topology:{peers:clone(peers),controlNetwork:clone(network)},dockerCli:'C:\\fixture\\docker.exe',assertUnchanged:jest.fn(async()=>{})};
  mockLedger.inspect.mockImplementation(async()=>clone(mockState));
  mockLedger.transaction.mockImplementation(async(work:any)=>work(mockState,(event:any)=>{mockOrder.push('durable-event');mockState.lastEvent=event;}));
  mockCollector.mockImplementation(async()=>{mockOrder.push('fresh-collector');return {status:'PASS',phase:'baseline',observedAt:1000};});
  mockVerifyRunning.mockImplementation(async()=>{mockOrder.push('running-desired-spec');});
  mockInstall.mockImplementation(()=>mockOrder.push('install'));
});
afterEach(()=>jest.restoreAllMocks());

test.each(['missing','created-unverified','unknown-outcome','expired'])(
  'Post-Start rejects %s identity attestation before collector or service installation',async kind=>{
    const row=mockState.creations['fixture-create'];
    if(kind==='missing')delete row.attestation;if(kind==='created-unverified')row.stage='CREATED_UNVERIFIED';
    if(kind==='unknown-outcome')row.stage='UNKNOWN_OUTCOME';if(kind==='expired')row.attestation.expiresAt=999;
    await expect(invoke()).rejects.toThrow('INDEPENDENT_IDENTITY_ATTESTATION_REQUIRED');
    expect(mockCollector).not.toHaveBeenCalled();expect(mockLedger.transaction).not.toHaveBeenCalled();expect(mockInstall).not.toHaveBeenCalled();
  });
test.each(['absent','helper-image','authority-id','phase','file','template-hash','effective-hash','baseline-hash','observed-config','returned-id'])(
  'Post-Start rejects %s phase policy mismatch before collector',async kind=>{
    const p=mockPolicy.servicePhase;
    if(kind==='absent')delete mockPolicy.servicePhase;if(kind==='helper-image')p.peers[0].image=`fixture.example.test/replaced@sha256:${h('0')}`;
    if(kind==='authority-id')p.controlNetwork.id=h('0');if(kind==='phase')p.phase='phone';if(kind==='file')p.file='docker/local-registration/compose.registration.json';
    if(kind==='template-hash')p.templateSha256=h('0');if(kind==='effective-hash')p.effectiveSha256=h('0');if(kind==='baseline-hash')mockPolicy.existingPostgresBaseline.networkId=h('0');
    if(kind==='observed-config')p.peers[0].configurationSha256=h('0');if(kind==='returned-id')p.peers[0].id=h('0');
    await expect(invoke()).rejects.toThrow('APPROVED_PHASE_POLICY_REQUIRED');
    expect(mockCollector).not.toHaveBeenCalled();expect(mockLedger.transaction).not.toHaveBeenCalled();expect(mockInstall).not.toHaveBeenCalled();
  });
test('actual trusted collector refusal never writes admission or installs production sources',async()=>{
  mockCollector.mockRejectedValueOnce(Error('REGISTRATION_RESOURCE_ADMISSION_BLOCKED'));
  await expect(invoke()).rejects.toThrow('REGISTRATION_RESOURCE_ADMISSION_BLOCKED');
  expect(mockCollector).toHaveBeenCalledTimes(1);expect(mockLedger.transaction).not.toHaveBeenCalled();expect(mockInstall).not.toHaveBeenCalled();
});
test('Post-Start succeeds only after fresh collector and durable admission, while migration gates stay closed',async()=>{
  await expect(invoke()).resolves.toEqual({status:'SERVICE_ADMITTED',SERVICE_ADMITTED:true,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED:false});
  expect(mockCollector).toHaveBeenCalledWith('C:\\fixture\\repository',expect.any(Object),'post-start',expect.any(Object));
  expect(mockState.lastEvent).toMatchObject({kind:'creation-admitted',id:'fixture-create',reservation:h('a'),scope:mockState.creations['fixture-create'].scope});
  expect(mockOrder).toEqual(['fresh-collector','running-desired-spec','durable-event','install']);expect(mockInstall).toHaveBeenCalledWith(mockCap);
});
test('running desired-spec mismatch after collector PASS still blocks service admission',async()=>{
  mockVerifyRunning.mockRejectedValueOnce(Error('POST_CREATE_CONFIGURATION_MISMATCH'));
  await expect(invoke()).rejects.toThrow('POST_CREATE_CONFIGURATION_MISMATCH');
  expect(mockCollector).toHaveBeenCalledTimes(1);expect(mockVerifyRunning).toHaveBeenCalledTimes(1);
  expect(mockLedger.transaction).not.toHaveBeenCalled();expect(mockInstall).not.toHaveBeenCalled();
});
test('protected owner policy changing during collector blocks before durable admission',async()=>{
  mockCreation.readOwnerPolicy.mockResolvedValueOnce(clone(mockPolicy)).mockResolvedValueOnce({...clone(mockPolicy),unexpectedChange:true});
  await expect(invoke()).rejects.toThrow('APPROVED_POLICY_CHANGED');
  expect(mockCollector).toHaveBeenCalledTimes(1);expect(mockLedger.transaction).not.toHaveBeenCalled();expect(mockInstall).not.toHaveBeenCalled();
});
test('production credentials/config changing after collector block before admission',async()=>{
  mockProduction.assertUnchanged.mockRejectedValueOnce(Error('PRODUCTION_CONFIGURATION_CHANGED'));
  await expect(invoke()).rejects.toThrow('PRODUCTION_CONFIGURATION_CHANGED');
  expect(mockLedger.transaction).not.toHaveBeenCalled();expect(mockInstall).not.toHaveBeenCalled();
});
test('no external fencing provider means no collection, admission, or production installation',async()=>{
  mockCreation.fencing=null;
  await expect(invoke()).rejects.toThrow('EXTERNAL_FENCING_PROVIDER_MISSING');
  expect(mockCollector).not.toHaveBeenCalled();expect(mockInstall).not.toHaveBeenCalled();
});
test('fencing lost after collector blocks before admission',async()=>{
  const first=await mockCreation.fencing.readPayload();mockCreation.fencing.readPayload.mockResolvedValueOnce(first).mockResolvedValueOnce({...first,continuous:false});
  await expect(invoke()).rejects.toThrow('EXTERNAL_FENCING_NOT_HELD');
  expect(mockCollector).toHaveBeenCalledTimes(1);expect(mockLedger.transaction).not.toHaveBeenCalled();expect(mockInstall).not.toHaveBeenCalled();
});
test('durable admission failure never installs production readers',async()=>{
  mockLedger.transaction.mockRejectedValueOnce(Error('WRITER_LOCKED_RECOVERY_REQUIRED'));
  await expect(invoke()).rejects.toThrow('WRITER_LOCKED_RECOVERY_REQUIRED');expect(mockInstall).not.toHaveBeenCalled();
});
