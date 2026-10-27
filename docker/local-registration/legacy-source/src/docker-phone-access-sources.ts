import type { ExclusivityBinding, PhoneConcurrencySnapshot } from './docker-phone-concurrency';
import { createProductionMigrationSources } from './docker-phone-access-adapters';
import { productionMigrationComponents } from './docker-phone-production-configuration';
import type { LoadedProductionMigrationConfiguration } from './docker-phone-production-configuration';

export interface IndependentSource {
  readonly sourceId:string;
  readonly provenance:'independently-deployed'|'production-adapter'|'test-only';
  assertReady?():void;
  onInvalidated(listener:()=>void):()=>void;
}
export interface IndependentDockerObservation {
  observedAt:number;
  identity:Record<string,string>;
  address:string;
  service:string;
  mountedVolumes:readonly string[];
  networks:readonly string[];
  running:boolean;
  healthy:boolean;
  hostPortPublished:boolean;
}
export interface IndependentPostgresObservation {
  snapshot:PhoneConcurrencySnapshot;
  security:unknown; // Complete roles, memberships, DB/schema/default ACLs; no secrets/user rows.
}
export interface ApprovedMigrationFingerprints {
  observedAt:number;
  expiresAt:number;
  reviewSha256:string;
  operation:'phone-seventh-only'|'phone-baseline-six-only';
  beforeSchemaSha256:string;
  afterSchemaSha256:string;
  securitySha256:string;
}
export interface IndependentlyApprovedReceipt {
  approvalId:string;
  enrollmentId:string;phase:'baseline'|'phone';executor:'registration_migrator';securitySha256:string;fencingEpoch:string;
  permission:'B'|'C'|'BASELINE';
  operation:ApprovedMigrationFingerprints['operation'];
  observedAt:number;
  expiresAt:number;
  reviewSha256:string;
  beforeSchemaSha256:string;
  afterSchemaSha256:string;
  sessionSha256:string;
  identity:Record<string,string>;
}
export interface AdministrativeExclusion {
  observedAt:number;
  expiresAt:number;
  leaseId:string;
  fencingEpoch:string;
  sessionSha256:string;
  identity:Record<string,string>;
  mechanism:'independently-enforced-maintenance-boundary';
  scope:'cluster-ddl-acl-roles-and-admin-entrypoints';
  competingRunners:number;
  uncontrolledPrivilegedSessions:number;
  uncontrolledEntryPoints:number;
  continuousEnforcement:boolean;
}
/** Protected, independently authenticated adapter boundary, never caller-supplied facts.
 * onInvalidated must notify on source disconnect, revocation and relevant state changes.
 * Administrative observations must originate in an enforced external fencing ledger,
 * NOT an advisory lock, local mutex or claim supplied by the migration process.
 */
export interface IndependentMigrationSources {
  docker:IndependentSource & {inspect(signal:AbortSignal):Promise<IndependentDockerObservation>};
  postgres:IndependentSource & {inspect(binding:Readonly<ExclusivityBinding>,signal:AbortSignal):Promise<IndependentPostgresObservation>};
  administrative:IndependentSource & {inspect(binding:Readonly<ExclusivityBinding>,signal:AbortSignal):Promise<AdministrativeExclusion>};
  fingerprints:IndependentSource & {read(reviewSha256:string,signal:AbortSignal):Promise<ApprovedMigrationFingerprints>};
  receipts:IndependentSource & {
    read(reviewSha256:string,signal:AbortSignal):Promise<readonly IndependentlyApprovedReceipt[]>;
    claim?(ids:readonly string[],lease:string,signal:AbortSignal):Promise<void>;
  };
}
/** Lazy closed defaults. Explicit trusted startup may install ONLY a protected-loader capability;
 * neither an environment override, plain JSON, caller-supplied adapter, nor CLI approval flag is accepted.
 */
let production:IndependentMigrationSources|undefined;
let installed:LoadedProductionMigrationConfiguration|undefined;
export function installProductionMigrationConfiguration(c:LoadedProductionMigrationConfiguration):void {
  productionMigrationComponents(c);
  if(installed&&installed!==c)throw new Error('PRODUCTION_CONFIGURATION_ALREADY_INSTALLED');
  if(installed===c)return;
  const next=createProductionMigrationSources(c);
  // A controller bound to old closed/default sources must not silently retain an accepted lease.
  if(production)for(const source of Object.values(production))if('invalidate'in source&&typeof source.invalidate==='function')source.invalidate();
  installed=c;production=next;
}
export function configuredIndependentMigrationSources():IndependentMigrationSources|null {
  return production??=createProductionMigrationSources();
}
