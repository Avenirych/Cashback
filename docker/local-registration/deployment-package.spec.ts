import { collectRegistrationServicePhase, CollectorBlocked } from './collector';
import { REGISTRATION_PHONE_EXPECTED as E } from '../../src/docker-phone-registration-target';
import {serviceFixture} from './service-phase.fixture';
import {configDigest} from './admission';
import {registrationPeerFingerprint} from '../../src/docker-phone-registration-target';
const {report}=require('./deployment-package.cjs');
describe('source-only deployment package',()=>{
  test('offline draft has fixed topology and unresolved identities, never fabricated approvals',()=>{
    const draft=require('./phase-policy.draft.json');
    expect(draft.status).toBe('DRAFT');
    expect(draft.postgresContainerId).toBe(E.containerId);
    expect(draft.postgresImage).toBe(E.image);
    expect(draft.postgresNetworks).toEqual([E.network]);
    expect(Object.keys(draft.networks).sort()).toEqual(['authority','database']);
    expect(draft.helpers.map((p:any)=>p.service)).toEqual(['migration-executor','observer']);
    for(const peer of draft.helpers){
      expect(peer.id).toBeNull();expect(peer.image).toBeNull();expect(peer.mounts).toBeNull();expect(peer.ports).toEqual([]);
      expect(peer.labels['com.docker.compose.project']).toBe(E.project);
    }
    expect(draft.servicePhase).toBeNull();expect(draft.creationAuthority).toBeNull();
  });
  test.each(['preflight','first-start','post-start','reconcile'])('%s cannot mutate or approve',operation=>{
    const result=report(operation);
    expect(result.execution).toBe('BLOCKED');
    expect(result.creationGate).toBe(false);
    expect(result.applyEligible).toBe(false);
  });
  test.each(['--approve','--execute','cashback-docker-test','cashback-finance-security-9f'])('rejects CLI authority %s',arg=>{
    expect(report('first-start',[arg]).status).toBe('BLOCKED');
  });
  test('draft cannot be collected as an approved phase',async()=>{
    await expect(collectRegistrationServicePhase('.',require('./phase-policy.draft.json'),'post-start')).rejects.toMatchObject({reason:'APPROVED_PHASE_POLICY_REQUIRED'});
  });
  test.each(['EXTERNAL_FENCING_PROVIDER','ED25519_AND_MTLS_ANCHORS','PROTECTED_RUNTIME_CREDENTIALS'])('missing %s keeps execution blocked', prerequisite=>{
    expect(report('first-start')).toMatchObject({status:'BLOCKED',unresolved:expect.arrayContaining([prerequisite])});
  });
  test('repeat after possible partial creation cannot create or adopt identities',()=>{
    expect(report('first-start')).toEqual(report('first-start'));
    expect(report('reconcile').status).toBe('BLOCKED');
  });
  test('pre-creation cannot self-approve even with supplied phase',async()=>{
    const docker=jest.fn();
    const policy={context:E.context,daemonId:E.daemonId,platform:E.platform,postgresImage:E.image,servicePhase:{} as any};
    await expect(collectRegistrationServicePhase('.',policy,'pre-first-start',{docker,now:Date.now,template:jest.fn(),registry:jest.fn()})).rejects.toBeInstanceOf(CollectorBlocked);
    expect(docker).not.toHaveBeenCalled();
  });
});

function collectionFixture(){
  const f=serviceFixture(),s=f.input.servicePhase!;
  (f.input.template as any).networks={};
  (f.input.effectiveConfig as any).networks={};
  f.policy.servicePhase!.templateSha256=configDigest(f.input.template);
  f.policy.servicePhase!.effectiveSha256=configDigest(f.input.effectiveConfig);
  const containers=[s.postgres,...s.peers.map(p=>p.container)];
  const networks=[s.network,s.controlNetwork];
  const objects=new Map<string,any>([...containers.map(c=>[c.Id,c] as [string,any]),...networks.flatMap(n=>[[n.Id,n],[n.Name,n]] as [string,any][]),
    [E.volume,s.volume],[E.image,s.postgresImage],...s.peers.map(p=>[p.container.Config.Image,p.image] as [string,any])]);
  // Give each fake image its actual config ID: real shared image refs have one ID.
  s.peers[1].container.Image=s.peers[0].container.Image;
  s.peers[1].image.Id=s.peers[0].container.Image;
  f.policy.servicePhase!.peers[1].configurationSha256=registrationPeerFingerprint(s.peers[1].container);
  const docker=jest.fn(async(args:readonly string[])=>{
    if(args.join(' ')==='context show')return E.context;
    if(args[0]!=='--context'||args[1]!==E.context)throw Error('unexpected context');
    const a=args.slice(2);
    if(a[0]==='info')return JSON.stringify({id:E.daemonId,os:'linux',arch:'amd64'});
    if(a[0]==='ps')return containers.map(c=>JSON.stringify({id:c.Id,name:c.Name.slice(1),composeProject:E.project})).join('\n');
    if(a[0]==='network'&&a[1]==='ls')return networks.map(n=>JSON.stringify({id:n.Id,name:n.Name,composeProject:E.project})).join('\n');
    if(a[0]==='volume'&&a[1]==='ls')return JSON.stringify({name:E.volume,composeProject:E.project});
    if(a[1]==='inspect'&&objects.has(a[2]))return JSON.stringify([objects.get(a[2])]);
    if(a[0]==='compose'&&a.includes('config'))return JSON.stringify(f.input.effectiveConfig);
    throw Error('unexpected command');
  });
  return {f,s,docker,io:{docker,now:()=>200000,template:jest.fn(),registry:jest.fn(),phaseTemplate:async()=>JSON.stringify(f.input.template)}};
}
test('post-start independently collects complete evidence without mutations',async()=>{
  const {f,io,docker}=collectionFixture();
  await expect(collectRegistrationServicePhase('.',f.policy,'post-start',io)).resolves.toMatchObject({status:'PASS',mode:'post-start'});
  expect(io.registry).not.toHaveBeenCalled();
  expect(docker.mock.calls.every(([a])=>!a.some(v=>['up','create','start','run','pull','tag','exec','build'].includes(v)))).toBe(true);
});
test('exact nested helper template is permitted with only reviewed pinned image interpolation',async()=>{
  const {f,io,docker}=collectionFixture();
  f.policy.servicePhase!.file='docker/local-registration/helpers/compose.helpers.json';
  await expect(collectRegistrationServicePhase('.',f.policy,'post-start',io)).resolves.toMatchObject({status:'PASS'});
  const call=docker.mock.calls.find(([args])=>args.includes('compose'));
  expect(call?.[0]).toContain('docker/local-registration/helpers/compose.helpers.json');
  for(const file of ['docker/local-registration/helpers/other.json','docker/local-registration/helpers/../compose.registration.json']){
    f.policy.servicePhase!.file=file;
    await expect(collectRegistrationServicePhase('.',f.policy,'post-start',io)).rejects.toMatchObject({reason:'PHASE_FILE_REFUSED'});
  }
});
test.each(['digest','daemon','network','mount','port','unknown-peer'])('collector blocks actual %s drift',async kind=>{
  const {f,s,io}=collectionFixture();
  if(kind==='digest')s.postgresImage.Descriptor.digest='0'.repeat(64);
  if(kind==='daemon')f.policy.daemonId='other';
  if(kind==='network')s.postgres.NetworkSettings.Networks.old={};
  if(kind==='mount')s.peers[0].container.Mounts=[{Source:'C:/unapproved',Type:'bind',RW:false}];
  if(kind==='port')s.peers[0].container.HostConfig.PortBindings={'123/tcp':[{}]};
  if(kind==='unknown-peer')s.controlNetwork.Containers['f'.repeat(64)]={IPv4Address:'172.31.0.9/24'};
  await expect(collectRegistrationServicePhase('.',f.policy,'post-start',io)).rejects.toBeInstanceOf(CollectorBlocked);
});
