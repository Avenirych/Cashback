import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { validateLocalDemoMailpit } from '../mail/local-demo-mailpit';

export const REGISTRATION_POLICY = Symbol('owner-reviewed-registration-policy');
export const REGISTRATION_PROBE = Symbol('trusted-registration-read-only-probe');
export const REGISTRATION_HISTORY = [
  ['1733927999000', 'InitialApplicationTables1733927999000'],
  ['1733928000000', 'AddMarketingPreferences1733928000000'],
  ['1735000000000', 'AddEmailVerification1735000000000'],
  ['1791394800000', 'AddForumUsers1791394800000'],
  ['1791630000000', 'CreateBonusTables1791630000000'],
  ['1791888000000', 'AddUsersEmailUnique1791888000000'],
  ['1792195200000', 'AddUserPhoneAndSmsConsent1792195200000'],
] as const;

export interface RegistrationPolicy {
  // Trusted DI boundary only; not HTTP input, environment flags or observed-state approval.
  cluster: string;
  databaseOid: string;
  serverVersionNum: string;
  schemaSha256: string;
  privileges: readonly string[];
  smtpPeer: string;
  phoneHarnessEvidence: 'reviewed-after-authorized-harness-apply';
  targetResolution: 'independently-reviewed';
}
export interface RegistrationFacts {
  observedAt: number;
  cluster: string;
  databaseOid: string;
  serverVersionNum: string;
  database: string;
  role: string;
  schemaSha256: string;
  history: readonly (readonly string[])[];
  privileges: readonly string[];
  memberships: readonly string[];
  superuser: boolean;
  createDb: boolean;
  createRole: boolean;
  replication: boolean;
  bypassRls: boolean;
  ownsObjects: boolean;
  smtpPeer: string;
  smtpHandshake: boolean;
}
export interface RegistrationProbe { inspect(signal: AbortSignal): Promise<RegistrationFacts> }

const allowedPrivileges = new Set([
  'database:CONNECT', 'schema:USAGE', 'users:SELECT', 'users:INSERT', 'users:UPDATE',
  'marketing_preferences:SELECT', 'marketing_preferences:INSERT', 'marketing_preferences:UPDATE',
  'users_id_seq:USAGE', 'marketing_preferences_id_seq:USAGE', 'migrations:SELECT',
]);
function exact(a: readonly string[], b: readonly string[]): boolean {
  return new Set(a).size === a.length && new Set(b).size === b.length &&
    JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}
export function validateRegistrationReadiness(
  facts: RegistrationFacts, policy: RegistrationPolicy, env: Record<string, unknown>, now: number,
): void {
  if (!validateLocalDemoMailpit(env) || env.REGISTRATION_ISOLATED !== 'true' ||
      env.DB_USER !== 'cashback_test' || !Number.isFinite(now) ||
      !Number.isFinite(facts.observedAt) || facts.observedAt > now || now - facts.observedAt > 5000 ||
      !/^\d+$/.test(policy.cluster) || !/^\d+$/.test(policy.databaseOid) ||
      !/^17\d{4}$/.test(policy.serverVersionNum) || !/^[a-f0-9]{64}$/.test(policy.schemaSha256) ||
      policy.phoneHarnessEvidence !== 'reviewed-after-authorized-harness-apply' ||
      policy.targetResolution !== 'independently-reviewed' ||
      facts.cluster !== policy.cluster || facts.databaseOid !== policy.databaseOid ||
      facts.serverVersionNum !== policy.serverVersionNum || facts.database !== 'cashback_docker_test' ||
      facts.role !== 'cashback_test' || facts.schemaSha256 !== policy.schemaSha256 ||
      JSON.stringify(facts.history) !== JSON.stringify(REGISTRATION_HISTORY) ||
      !exact(facts.privileges, policy.privileges) || !policy.privileges.length ||
      policy.privileges.some(p => !allowedPrivileges.has(p)) ||
      ![...allowedPrivileges]
        .every(p => policy.privileges.includes(p)) ||
      !Array.isArray(facts.memberships) || facts.memberships.length !== 0 ||
      [facts.superuser, facts.createDb, facts.createRole, facts.replication, facts.bypassRls, facts.ownsObjects]
        .some(flag => flag !== false) ||
      !policy.smtpPeer || facts.smtpPeer !== policy.smtpPeer || facts.smtpHandshake !== true) {
    throw new Error('REGISTRATION_READINESS_UNCONFIRMED');
  }
}

@Injectable()
export class RegistrationReadiness {
  constructor(
    @Optional() @Inject(REGISTRATION_PROBE) private readonly probe?: RegistrationProbe,
    @Optional() @Inject(REGISTRATION_POLICY) private readonly policy?: RegistrationPolicy,
  ) {}
  async assertReady(): Promise<void> {
    const flag = process.env.REGISTRATION_ISOLATED;
    if (flag === undefined || flag === 'false') return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (flag !== 'true' || !this.probe || !this.policy) throw new Error('UNCONFIRMED');
      // No cache or environment-based READY switch. A future trusted collector is required.
      const expired = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('READINESS_TIMEOUT'));
        }, 3000);
      });
      const facts = await Promise.race([this.probe.inspect(controller.signal), expired]);
      validateRegistrationReadiness(facts, this.policy, process.env, Date.now());
    } catch {
      throw new ServiceUnavailableException('Isolated registration is blocked: database schema, application privileges and Mailpit readiness are not confirmed');
    } finally {
      if (timeout) clearTimeout(timeout);
      controller.abort();
    }
  }
}
