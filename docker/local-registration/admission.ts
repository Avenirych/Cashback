import { createHash } from 'node:crypto';

export const REGISTRATION_PROJECT = 'cashback-registration-20261016-4f8c2a96b17d';
export const COMPOSE_FILE = 'docker/local-registration/compose.registration.json';
// Updated only after review of the standalone template; not computed from submitted config.
export const TEMPLATE_SHA256 = 'b40aa4b114f81c167271729cd4c0b06274ea901b3ac563a3f57c3fda35fa35ef';
type Json = null | string | number | boolean | Json[] | {[key: string]: Json};
function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k]!)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function configDigest(value: Json): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export interface AdmissionPolicy {
  // Owner-reviewed boundary. Never derive approval from the same untrusted observation.
  daemonId: string;
  context: string;
  postgresImage: string;
  platform: string;
}
export interface AdmissionInput {
  template: Json;
  effectiveConfig: Json;
  invocation: {files: string[]; project: string; profiles: string[]; services: string[]; overrides: string[]};
  environment: Record<string, string>;
  inventory: {
    daemonId: string; context: string; observedAt: number; complete: boolean;
    containers: {name: string; composeProject?: string}[];
    networks: {name: string; composeProject?: string}[];
    volumes: {name: string; composeProject?: string}[];
  };
  image: {reference: string; platform: string; postgresMajor: number; digestVerified: boolean; observedAt: number};
}
function deny(): never { throw new Error('REGISTRATION_RESOURCE_ADMISSION_BLOCKED'); }
function render(value: Json, env: Record<string, string>): Json {
  if (typeof value === 'string') return value.replace(/\$\{([A-Z0-9_]+):\?[^}]+\}/g, (_all, key: string) => env[key] ?? deny());
  if (Array.isArray(value)) return value.map(v => render(v, env));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, render(v, env)]));
  return value;
}

/** Pure decision only: no engine calls, image pulls, secret generation or resource creation.
 * Evidence must later come from a trusted read-only collector, not caller-written receipts.
 * PASS covers creation of an EMPTY cluster only, never schema writes or app startup.
 */
export function admitRegistrationResources(input: AdmissionInput, policy: AdmissionPolicy, now: number): void {
  try {
    const {invocation: call, environment: env, inventory, image} = input;
    const fresh = (at: number) => Number.isFinite(now) && Number.isFinite(at) && at <= now && now - at <= 30000;
    if (configDigest(input.template) !== TEMPLATE_SHA256 ||
        JSON.stringify(call.files) !== JSON.stringify([COMPOSE_FILE]) || call.project !== REGISTRATION_PROJECT ||
        call.profiles.length || call.overrides.length || JSON.stringify(call.services) !== '["postgres-test"]' ||
        !policy.daemonId || !policy.context || !policy.platform ||
        inventory.daemonId !== policy.daemonId || inventory.context !== policy.context ||
        inventory.complete !== true || !fresh(inventory.observedAt) || !fresh(image.observedAt) ||
        !/^postgres:17-bookworm@sha256:[a-f0-9]{64}$/.test(policy.postgresImage) ||
        env.REGISTRATION_POSTGRES17_IMAGE !== policy.postgresImage || image.reference !== policy.postgresImage ||
        image.platform !== policy.platform || image.postgresMajor !== 17 || image.digestVerified !== true) deny();
    const keys = ['REGISTRATION_ADMIN_PASSWORD', 'REGISTRATION_APP_PASSWORD', 'REGISTRATION_JWT_SECRET', 'REGISTRATION_POSTGRES17_IMAGE'];
    if (JSON.stringify(Object.keys(env).sort()) !== JSON.stringify(keys.sort())) deny();
    const secrets = keys.filter(k => k !== 'REGISTRATION_POSTGRES17_IMAGE').map(k => env[k]!);
    if (secrets.some(v => !v || v.length < 32 || /placeholder|example|changeme|\$\{|\s/i.test(v)) || new Set(secrets).size !== 3) deny();
    for (const resources of [inventory.containers, inventory.networks, inventory.volumes]) {
      if (!Array.isArray(resources)) deny();
      for (const item of resources) {
        if (!item || typeof item.name !== 'string' || !item.name ||
            item.name.replace(/^\//, '').startsWith(REGISTRATION_PROJECT) || item.composeProject === REGISTRATION_PROJECT) deny();
      }
    }
    // Exact template locks DB target, private networks, volume, mounts and absence of
    // init SQL/migration hooks. Exact rendered comparison refuses any added overrides.
    if (configDigest(input.effectiveConfig) !== configDigest(render(input.template, env))) deny();
  } catch { deny(); }
}
