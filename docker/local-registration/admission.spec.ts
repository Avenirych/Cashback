import { serviceFixture } from './service-phase.fixture';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { admitRegistrationResources, AdmissionInput, AdmissionPolicy, COMPOSE_FILE, REGISTRATION_PROJECT, configDigest } from './admission';
import { REGISTRATION_PHONE_EXPECTED as E, registrationNetworkFingerprint, registrationPeerFingerprint } from '../../src/docker-phone-registration-target';
const template = JSON.parse(readFileSync(resolve(__dirname, 'compose.registration.json'), 'utf8'));
const now = 200000;
const image = `postgres:17-bookworm@sha256:${'a'.repeat(64)}`; // Synthetic unit fixture, NOT an approved image.
const policy: AdmissionPolicy = {daemonId: 'synthetic-engine', context: 'synthetic-context', platform: 'linux/amd64', postgresImage: image};
function fixture(): AdmissionInput {
  const environment = {REGISTRATION_ADMIN_PASSWORD: 'a1'.repeat(24), REGISTRATION_APP_PASSWORD: 'b2'.repeat(24),
    REGISTRATION_JWT_SECRET: 'c3'.repeat(24), REGISTRATION_POSTGRES17_IMAGE: image};
  const rendered = JSON.stringify(template).replace(/\$\{([A-Z0-9_]+):\?[^}]+\}/g, (_all, key: keyof typeof environment) => environment[key]);
  return {template: structuredClone(template), effectiveConfig: JSON.parse(rendered), environment,
    invocation: {files: [COMPOSE_FILE], project: REGISTRATION_PROJECT, profiles: [], services: ['postgres-test'], overrides: []},
    inventory: {daemonId: policy.daemonId, context: policy.context, complete: true, observedAt: now, containers: [], networks: [], volumes: []},
    image: {reference: image, platform: policy.platform, postgresMajor: 17, digestVerified: true, observedAt: now}};
}
test('pure admission accepts complete synthetic evidence for empty cluster creation only', () => {
  expect(() => admitRegistrationResources(fixture(), policy, now)).not.toThrow();
});
test.each(['containers', 'networks', 'volumes'] as const)('refuses existing reserved %s, including stopped containers', kind => {
  const input = fixture(); input.inventory[kind].push({name: `${REGISTRATION_PROJECT}-reserved`});
  expect(() => admitRegistrationResources(input, policy, now)).toThrow('ADMISSION_BLOCKED');
});
test.each(['containers', 'networks', 'volumes'] as const)('refuses project-labelled %s with an unexpected name', kind => {
  const input = fixture(); input.inventory[kind].push({name: 'other', composeProject: REGISTRATION_PROJECT});
  expect(() => admitRegistrationResources(input, policy, now)).toThrow();
});
const mutations: [string, (input: AdmissionInput) => void][] = [
  ['project override', i => {i.invocation.project = 'cashback-docker-test';}],
  ['extra file', i => {i.invocation.files.push('compose.yaml');}],
  ['profiles', i => {i.invocation.profiles.push('registration-after-schema-approval');}],
  ['app start', i => {i.invocation.services.push('backend');}],
  ['override', i => {i.invocation.overrides.push('command');}],
  ['unknown env', i => {i.environment.COMPOSE_FILE = 'compose.yaml';}],
  ['unknown inventory', i => {i.inventory.complete = false;}],
  ['stale inventory', i => {i.inventory.observedAt = now - 30001;}],
  ['future inventory', i => {i.inventory.observedAt = now + 1;}],
  ['wrong engine', i => {i.inventory.daemonId = 'other';}],
  ['wrong context', i => {i.inventory.context = 'other';}],
  ['unpinned image', i => {i.image.reference = 'postgres:17';}],
  ['unverified image', i => {i.image.digestVerified = false;}],
  ['wrong major', i => {i.image.postgresMajor = 18;}],
  ['wrong architecture', i => {i.image.platform = 'linux/arm64';}],
  ['stale image evidence', i => {i.image.observedAt = now - 30001;}],
  ['same secrets', i => {i.environment.REGISTRATION_APP_PASSWORD = i.environment.REGISTRATION_ADMIN_PASSWORD!;}],
  ['weak secret', i => {i.environment.REGISTRATION_JWT_SECRET = 'placeholder';}],
  ['different DB/override', i => {(i.effectiveConfig as any).services.backend.environment.DB_HOST = 'host.docker.internal';}],
  ['automatic migrations', i => {(i.template as any).services.backend.command = ['migration:run'];}],
  ['existing volume', i => {(i.template as any).volumes['registration-pg17-data'].name = 'existing-user-data';}],
];
test.each(mutations)('refuses %s', (_name, mutate) => {
  const input = fixture(); mutate(input);
  expect(() => admitRegistrationResources(input, policy, now)).toThrow('ADMISSION_BLOCKED');
});
test('refuses absent policy and incomplete observations rather than guessing', () => {
  expect(() => admitRegistrationResources({} as AdmissionInput, policy, now)).toThrow();
  expect(() => admitRegistrationResources(fixture(), {} as AdmissionPolicy, now)).toThrow();
});

// Synthetic future phase fixture only. No owner approval, Docker resources or real evidence.
// Shared synthetic fixture also exercises the trusted collector.
test('future opt-in phase verifies exact PG and service identities while original owner policy remains insufficient',()=>{
  const f=serviceFixture();expect(()=>admitRegistrationResources(f.input,f.policy,now)).not.toThrow();
  const {servicePhase,...originalPolicy}=f.policy;expect(()=>admitRegistrationResources(f.input,originalPolicy,now)).toThrow();
  f.input.inventory.containers.push({name:'cashback-finance-security-9f-pg-1',composeProject:'cashback-finance-security-9f'});
  expect(()=>admitRegistrationResources(f.input,f.policy,now)).not.toThrow(); // Presence is not permission to touch it.
});
test.each(['id','project','image','platform','descriptor-platform','PG-ID','PG-image','PG-volume','PG-port','peer-port','published-peer-port','NIC','control-member','control-id','volume-options','mount','privileged','config','stale','unknown-container','backend','wildcard'])(
  'future service phase refuses %s drift',kind=>{
    const f=serviceFixture(),s=f.input.servicePhase!,p=f.policy.servicePhase!,peer=s.peers[0].container;
    if(kind==='id')peer.Id='d'.repeat(64);if(kind==='project')f.input.invocation.project='cashback-docker-test';
    if(kind==='image')s.peers[0].image.Descriptor.digest='d'.repeat(64);if(kind==='platform')s.peers[0].image.Architecture='arm64';
    if(kind==='descriptor-platform')s.peers[0].image.Descriptor.platform={os:'linux',architecture:'arm64'};
    if(kind==='PG-ID')s.postgres.Id='d'.repeat(64);if(kind==='PG-image')s.postgresImage.Descriptor.digest='d'.repeat(64);
    if(kind==='PG-volume')s.postgres.Mounts[0].Name='cashback-finance-security-9f-data';
    if(kind==='PG-port')s.postgres.HostConfig.PortBindings={'5432/tcp':[{}]};
    if(kind==='peer-port')peer.HostConfig.PortBindings={'5432/tcp':[{}]};
    if(kind==='published-peer-port')peer.NetworkSettings.Ports={'5432/tcp':[{HostIp:'0.0.0.0',HostPort:'5432'}]};
    if(kind==='NIC')peer.NetworkSettings.Networks.old={NetworkID:'old'};
    if(kind==='control-member')s.controlNetwork.Containers['d'.repeat(64)]={IPv4Address:'172.31.0.9/24'};
    if(kind==='control-id')s.controlNetwork.Id='d'.repeat(64);if(kind==='volume-options')s.volume.Options={device:'old'};
    if(kind==='mount')peer.Mounts=[{Type:'volume',Name:'cashback-finance-security-9f-data',RW:false}];
    if(kind==='privileged')peer.HostConfig.Privileged=true;
    if(['mount','privileged'].includes(kind))p.peers[0].configurationSha256=registrationPeerFingerprint(peer);
    if(kind==='volume-options')p.volumeSha256=configDigest(s.volume);
    if(kind==='config')(f.input.effectiveConfig as any).unknown=true;
    if(kind==='stale')s.observedAt=now-30001;
    if(kind==='unknown-container')f.input.inventory.containers.push({name:E.project+'-unknown-1',composeProject:E.project});
    if(kind==='backend')f.input.invocation.services=['backend'];if(kind==='wildcard')p.peers[0].id='*';
    expect(()=>admitRegistrationResources(f.input,f.policy,now)).toThrow('ADMISSION_BLOCKED');
  });
