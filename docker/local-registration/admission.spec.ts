import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { admitRegistrationResources, AdmissionInput, AdmissionPolicy, COMPOSE_FILE, REGISTRATION_PROJECT } from './admission';
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
