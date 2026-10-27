import type { QueryRunner } from 'typeorm';
import type { PhoneTarget } from './docker-phone-migration-data-source';
import { assertPhoneTarget } from './docker-phone-migration-data-source';
import { requirePhoneApproval, PHONE_PREVIOUS } from './docker-phone-migration-preflight';
import type { PhoneApproval } from './docker-phone-migration-preflight';
import { PHONE_APPLY_CONCURRENCY_VERIFIED } from './docker-phone-migration-runner';
import type { PhoneBaselineApproval } from './docker-phone-migration-runner';
import { REGISTRATION_PHONE_EXPECTED, registrationSecurityDigest } from './docker-phone-registration-target';

export type PhoneConcurrencyState = 'BLOCKED' | 'PREPARED' | 'VERIFIED' | 'APPLY_ELIGIBLE';
export type PhoneConcurrencyReceipt = PhoneApproval | PhoneBaselineApproval;
export interface PhoneConcurrencyReview {
  receipt: PhoneConcurrencyReceipt; // BASELINE or B; C is additionally required immediately before seventh apply.
  beforeSchemaSha256: string; // Independent reviewed empty/baseline catalog hash, never learned from observation.
}
export interface SessionEnrollment {
  enrollmentId:string;sessionSha256:string;reviewSha256:string;
  identity:Record<string,string>;executor:'registration_migrator';phase:'baseline'|'phone';
  securitySha256:string;fencingEpoch:string;observedAt:number;expiresAt:number;
}
export interface PhoneConcurrencySnapshot {
  enrollment?:SessionEnrollment;
  observedAt: number;
  identity: Record<string,string>; // Exact complete REGISTRATION_PHONE_EXPECTED boundary.
  address: string;
  role: string;
  backendPid: string;
  backendStart: string; // PID alone is reusable.
  transaction: string; // Transaction/session observation must identify the same transaction.
  schemaSha256: string;
  securitySha256: string; // Complete roles/memberships + database/schema/default ACL fingerprint.
  history: readonly (readonly string[])[];
}
export interface ExclusivityBinding {
  sessionSha256: string;
  snapshotSha256: string;
  reviewSha256: string;
}
export interface IndependentExclusivityLease extends ExclusivityBinding {
  leaseId: string;
  fencingEpoch: string;
  issuedAt: number;
  expiresAt: number;
  scope: 'cluster-ddl-acl-roles-and-admin-entrypoints';
}
/** Trusted, independently implemented access controller. NO production adapter exists yet.
 * Owns opaque proof issuance/revocation, global fencing and exclusive administrator entrypoints.
 * Methods only verify evidence here; this interface never changes access, sessions or ACLs.
 * An advisory lock or caller-provided JSON must NOT implement this contract.
 */
export interface IndependentExclusivityAuthority {
  requestEvidence?(binding:Readonly<ExclusivityBinding>,signal:AbortSignal):Promise<
    {status:'CONFIRMED';evidence:object}|{status:'BLOCKED';reason:string}>;
  subscribeRevocation?(leaseId:string,callback:()=>void):()=>void;
  ownsEvidence(proof: object): boolean;
  verify(proof: object, binding: Readonly<ExclusivityBinding>, signal: AbortSignal): Promise<IndependentExclusivityLease|null>;
  inspect(lease: Readonly<IndependentExclusivityLease>, binding: Readonly<ExclusivityBinding>, signal: AbortSignal): Promise<IndependentExclusivityLease|null>;
}
export interface PhoneConcurrencyDependencies {
  observe(q:QueryRunner, signal:AbortSignal):Promise<PhoneConcurrencySnapshot>;
  authority: IndependentExclusivityAuthority|null;
  now():number;
}
export class PhoneConcurrencyBlocked extends Error {
  constructor(readonly reason:string) { super('PHONE_CONCURRENCY_BLOCKED:'+reason); }
}
const digest=registrationSecurityDigest;
const hashPattern=/^[a-f0-9]{64}$/;
const owners=new Map<string,object>(); // Additional in-process exclusion only; NOT distributed proof.
const consumed=new WeakSet<object>();
const targetKey=REGISTRATION_PHONE_EXPECTED.systemIdentifier+':'+REGISTRATION_PHONE_EXPECTED.oid;
function receiptBody(r:PhoneConcurrencyReceipt):unknown {
  const {registration,...target}=r.target;
  return {...r,target:{...target,securitySha256:registration?.securitySha256,phase:registration?.phase}};
}

/** No default observer/authority, no IO on construction, no env/CLI switches, no migrations.
 * VERIFIED is a short-lived observation of an INDEPENDENT lease, not a self-issued guarantee.
 * Every failure latches BLOCKED; a new instance and new proof/review are required to retry.
 */
export class PhoneConcurrencyProtocol {
  #state:PhoneConcurrencyState='BLOCKED';
  #reason='NOT_PREPARED';
  #terminal=false;
  #busy=false;
  #q:QueryRunner|undefined;
  #session='';
  #observedAt=Number.NaN;
  #binding:ExclusivityBinding|undefined;
  #lease:IndependentExclusivityLease|undefined;
  #unsubscribe:(()=>void)|undefined;
  readonly #owner=Object.freeze({});
  readonly #review:PhoneConcurrencyReview;
  readonly #receiptHash:string;
  readonly #deps:PhoneConcurrencyDependencies;
  constructor(review:PhoneConcurrencyReview,deps:PhoneConcurrencyDependencies) {
    // Copy security-relevant caller input; the opaque registration proof is deliberately retained.
    this.#review={receipt:{...review.receipt,target:{...review.receipt.target},
      ...('beforeObjects' in review.receipt?{beforeObjects:review.receipt.beforeObjects.map(x=>({...x})),
        afterObjects:review.receipt.afterObjects.map(x=>({...x}))}:{})},beforeSchemaSha256:review.beforeSchemaSha256};
    this.#receiptHash=digest(receiptBody(this.#review.receipt));
    this.#deps={...deps};
  }
  get status():Readonly<{state:PhoneConcurrencyState;reason:string}> {
    // A status read cannot leave an expired/invalid target advertised VERIFIED.
    if(!this.#terminal&&this.#state!=='BLOCKED') {
      try {
        assertPhoneTarget(this.#review.receipt.target);
        const now=this.#deps.now();
        if(!Number.isFinite(now)||!Number.isFinite(this.#observedAt)||now<this.#observedAt||now-this.#observedAt>5000) this.fail('STALE_SNAPSHOT');
        if(this.#lease) this.checkLease(this.#lease,this.#binding!);
      }
      catch { this.#terminal=true;this.#state='BLOCKED';this.#reason='STALE_OR_INVALID_TARGET'; }
    }
    return Object.freeze({state:this.#state,reason:this.#reason});
  }
  private fail(reason:string):never {
    this.#terminal=true;this.#state='BLOCKED';this.#reason=reason;
    throw new PhoneConcurrencyBlocked(reason);
  }
  private review(receipt:PhoneConcurrencyReceipt,apply=false):void {
    const r=this.#review.receipt,t=r.target;
    assertPhoneTarget(t);
    if(!t.registration||t.database!==REGISTRATION_PHONE_EXPECTED.database||!hashPattern.test(this.#review.beforeSchemaSha256)) this.fail('TARGET_OR_REVIEW_REQUIRED');
    if(t.registration.phase!==(r.operation==='phone-seventh-only'?'phone':'baseline'))this.fail('MIGRATION_PHASE_MISMATCH');
    if(r.operation==='phone-seventh-only') {
      requirePhoneApproval(r,'preflight');
      if(r.beforeSha256!==this.#review.beforeSchemaSha256) this.fail('REVIEW_SCHEMA_MISMATCH');
      const live=receipt as PhoneApproval;requirePhoneApproval(live,apply?'apply':'preflight');
      if(digest(receiptBody({...live,permission:'B'}))!==this.#receiptHash) this.fail('RECEIPT_CHANGED');
    } else {
      if(r.operation!=='phone-baseline-six-only'||r.permission!=='BASELINE'||!hashPattern.test(r.afterSixSha256)||
        digest(receiptBody(receipt))!==this.#receiptHash) this.fail('BASELINE_RECEIPT_REQUIRED');
    }
  }
  private checkLease(lease:IndependentExclusivityLease|null,b:ExclusivityBinding):void {
    const now=this.#deps.now();
    if(!lease||lease.scope!=='cluster-ddl-acl-roles-and-admin-entrypoints'||!lease.leaseId||
      !/^[1-9][0-9]*$/.test(lease.fencingEpoch)||!Number.isFinite(now)||!Number.isFinite(lease.issuedAt)||
      !Number.isFinite(lease.expiresAt)||lease.issuedAt>now||lease.expiresAt<=now||
      lease.expiresAt-lease.issuedAt>5000||Object.entries(b).some(([k,v])=>lease[k as keyof ExclusivityBinding]!==v)) this.fail('INDEPENDENT_LEASE_INVALID');
  }
  private async bounded<T>(work:(signal:AbortSignal)=>Promise<T>):Promise<T> {
    const c=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    try { return await Promise.race([work(c.signal),new Promise<never>((_,reject)=>{
      timer=setTimeout(()=>{c.abort();reject(new PhoneConcurrencyBlocked('TIMEOUT'));},1000);
    })]); } finally { if(timer)clearTimeout(timer);c.abort(); }
  }
  private async current(q:QueryRunner,receipt:PhoneConcurrencyReceipt,apply=false):Promise<ExclusivityBinding> {
    this.review(receipt,apply);
    if(q!==this.#q||!q.isTransactionActive||q.isReleased) this.fail('SESSION_CHANGED');
    const f=structuredClone(await this.bounded(signal=>this.#deps.observe(q,signal))),now=this.#deps.now();
    if(this.#terminal) this.fail('INVALIDATED');
    this.review(receipt,apply);
    if(!Number.isFinite(now)||!Number.isFinite(f.observedAt)||f.observedAt>now||now-f.observedAt>5000||
      digest(f.identity)!==digest(REGISTRATION_PHONE_EXPECTED)||f.address!==receipt.target.address||f.role!==receipt.target.role||
      !/^[1-9][0-9]*$/.test(f.backendPid)||!f.backendStart||!f.transaction||
      f.schemaSha256!==this.#review.beforeSchemaSha256||f.securitySha256!==receipt.target.registration?.securitySha256||
      digest(f.history)!==digest(receipt.operation==='phone-seventh-only'?PHONE_PREVIOUS:[])) this.fail('SNAPSHOT_CHANGED_OR_STALE');
    const sessionSha256=digest([f.backendPid,f.backendStart,f.transaction]);
    if(this.#session&&sessionSha256!==this.#session) this.fail('SESSION_CHANGED');
    const enrollment=f.enrollment;
    if(!enrollment||enrollment.sessionSha256!==sessionSha256||enrollment.reviewSha256!==this.#receiptHash||
      enrollment.executor!==f.role||enrollment.phase!==receipt.target.registration?.phase||
      enrollment.securitySha256!==f.securitySha256||digest(enrollment.identity)!==digest(REGISTRATION_PHONE_EXPECTED)||
      !hashPattern.test(enrollment.enrollmentId)||!Number.isFinite(enrollment.expiresAt)||enrollment.expiresAt<=now||
      !Number.isFinite(enrollment.observedAt)||enrollment.observedAt>now||now-enrollment.observedAt>5000||
      !/^[1-9][0-9]*$/.test(enrollment.fencingEpoch))this.fail('ENROLLMENT_MISMATCH');
    this.#observedAt=f.observedAt;
    if(this.#lease&&enrollment.fencingEpoch!==this.#lease.fencingEpoch)this.fail('ENROLLMENT_EPOCH_CHANGED');
    return {sessionSha256,snapshotSha256:digest({...f,observedAt:0}),reviewSha256:this.#receiptHash};
  }
  private async transition<T>(expected:PhoneConcurrencyState,work:()=>Promise<T>):Promise<T> {
    if(this.#terminal||this.#busy||this.#state!==expected) return this.fail('INVALID_TRANSITION');
    this.#busy=true;
    try { const result=await work(); if(this.#terminal)this.fail('INVALIDATED');return result; }
    catch(e) {return this.fail(e instanceof PhoneConcurrencyBlocked?e.reason:'VERIFICATION_FAILED');}
    finally {this.#busy=false;}
  }
  async prepare(q:QueryRunner,receipt:PhoneConcurrencyReceipt):Promise<void> {
    return this.transition('BLOCKED',async()=>{
      this.review(receipt);
      if(owners.has(targetKey))this.fail('COMPETING_RUNNER');
      owners.set(targetKey,this.#owner);this.#q=q;
      this.#binding=await this.current(q,receipt);this.#session=this.#binding.sessionSha256;
      this.#state='PREPARED';this.#reason='INDEPENDENT_PROOF_REQUIRED';
    });
  }
  async verify(proof?:object):Promise<void> {
    return this.transition('PREPARED',async()=>{
      const authority=this.#deps.authority;
      if(!authority)this.fail('INDEPENDENT_PROOF_REQUIRED');
      const b=await this.current(this.#q!,this.#review.receipt);
      if(digest(b)!==digest(this.#binding))this.fail('SNAPSHOT_CHANGED_OR_STALE');
      let token=proof;
      if(token===undefined&&authority.requestEvidence) {
        const decision=await this.bounded(signal=>authority.requestEvidence!(Object.freeze({...b}),signal));
        if(decision.status!=='CONFIRMED')this.fail('INDEPENDENT_PROOF_REQUIRED');
        token=decision.evidence;
      }
      if(!token||typeof token!=='object'||consumed.has(token)||!authority.ownsEvidence(token))this.fail('INDEPENDENT_PROOF_REQUIRED');
      consumed.add(token);
      const raw=await this.bounded(signal=>authority.verify(token!,Object.freeze({...b}),signal));
      const lease=raw?Object.freeze({...raw}):null;this.checkLease(lease,b);
      this.#lease=lease!;
      this.#unsubscribe=authority.subscribeRevocation?.(lease!.leaseId,()=>{
        this.#terminal=true;this.#state='BLOCKED';this.#reason='INDEPENDENT_CONTROL_REVOKED';
      });
      // Check again after the independent verification await; never promote a stale snapshot.
      const final=await this.current(this.#q!,this.#review.receipt);
      if(digest(b)!==digest(final))this.fail('SNAPSHOT_CHANGED_OR_STALE');
      this.checkLease(lease,final);this.#lease=lease!;
      this.#state='VERIFIED';this.#reason='INDEPENDENT_LEASE_OBSERVED_ONLY';
    });
  }
  async assertApplyEligible(q:QueryRunner,receipt:PhoneConcurrencyReceipt):Promise<never> {
    return this.transition('VERIFIED',async()=>{
      const b=await this.current(q,receipt,true);
      if(digest(b)!==digest(this.#binding))this.fail('SNAPSHOT_CHANGED_OR_STALE');
      this.checkLease(this.#lease!,b);
      const fresh=await this.bounded(signal=>this.#deps.authority!.inspect(this.#lease!,Object.freeze({...b}),signal));
      this.checkLease(fresh,b);
      if(digest(fresh)!==digest(this.#lease))this.fail('LEASE_CHANGED');
      const final=await this.current(q,receipt,true);
      if(digest(final)!==digest(b))this.fail('SNAPSHOT_CHANGED_OR_STALE');
      this.checkLease(fresh,final);
      if(!PHONE_APPLY_CONCURRENCY_VERIFIED)this.fail('CONCURRENCY_GATE_CLOSED');
      // Deliberately unavailable even if another module tampers with an exported flag.
      // Future access-control integration/review must implement atomic admission-to-use.
      return this.fail('ATOMIC_EXCLUSION_NOT_IMPLEMENTED');
    });
  }
  validateTransactionFence(fence:PhoneFencedTransaction):void {
    if(this.#state!=='VERIFIED'||this.#terminal||!(fence instanceof PhoneFencedTransaction)||
      !this.#binding||!this.#lease||!fence.matches(this.#binding,this.#lease.fencingEpoch))this.fail('TRANSACTION_FENCE_MISMATCH');
    this.checkLease(this.#lease,this.#binding);
  }
  close():void {
    try {this.#unsubscribe?.();} catch {/* Always invalidate locally and allow Harness connection cleanup. */}
    this.#unsubscribe=undefined;
    if(owners.get(targetKey)===this.#owner)owners.delete(targetKey);
    this.#terminal=true;this.#state='BLOCKED';this.#reason='CLOSED';this.#q=undefined;
    // No access-controller release/ACL restoration: those are separately authorized operations.
  }
}
export interface PhoneConcurrencyControl { protocol:PhoneConcurrencyProtocol; evidence?:object;transaction?:PhoneFencedTransaction }

export interface DurableMigrationOutcome {
  /** Atomic durable compare-and-set, scoped to cluster/database/migration review.
   * Reject prior unresolved attempts even from another session/process/epoch.
   * Store COMMIT_PENDING before returning; only independent read-only reconciliation may clear it. */
  reserve(binding:Readonly<ExclusivityBinding>,epoch:string):Promise<void>;
  record(outcome:'COMMITTED'|'ABORTED_BEFORE_COMMIT',binding:Readonly<ExclusivityBinding>,epoch:string):Promise<void>;
}
/** Transaction lifecycle inside the existing protocol, not an authority or a SQL runner.
 * External enforcement and durable outcome ledger are mandatory; neither has a production default.
 * This contract cannot promote APPLY_ELIGIBLE or replace the closed concurrency gate. */
export class PhoneFencedTransaction {
  #state:'NEW'|'ACTIVE'|'COMMIT_PENDING'|'COMMITTED'|'ABORTED'|'UNKNOWN'='NEW';
  readonly #binding:Readonly<ExclusivityBinding>;
  constructor(binding:ExclusivityBinding,readonly epoch:string,
    private readonly held:()=>Promise<boolean>,private readonly ledger:DurableMigrationOutcome){
    this.#binding=Object.freeze({...binding});
    if(!/^[1-9][0-9]*$/.test(epoch)||Object.values(binding).some(v=>!hashPattern.test(v)))throw new PhoneConcurrencyBlocked('INVALID_FENCE_BINDING');
  }
  matches(binding:ExclusivityBinding,epoch:string):boolean{return digest(binding)===digest(this.#binding)&&epoch===this.epoch&&this.#state==='NEW';}
  get outcome(){return this.#state;}
  async begin():Promise<void>{
    if(this.#state!=='NEW')throw new PhoneConcurrencyBlocked('RECONCILIATION_REQUIRED');
    this.#state='UNKNOWN'; // Failed reservation is fail-closed, never reusable.
    await this.ledger.reserve(this.#binding,this.epoch);
    this.#state='ACTIVE';await this.assertHeld();
  }
  async assertHeld():Promise<void>{
    if(this.#state!=='ACTIVE')throw new PhoneConcurrencyBlocked('RECONCILIATION_REQUIRED');
    let valid=false;try{valid=await this.held();}catch{/* Missing authority is loss of fencing. */}
    if(!valid){this.#state='ABORTED';throw new PhoneConcurrencyBlocked('FENCING_LOST_BEFORE_COMMIT');}
  }
  async mutation<T>(work:()=>Promise<T>):Promise<T>{await this.assertHeld();const result=await work();await this.assertHeld();return result;}
  async commit(work:()=>Promise<void>):Promise<'COMMITTED'|'COMMIT_OUTCOME_UNKNOWN'>{
    await this.assertHeld();this.#state='COMMIT_PENDING';
    try {
      await work();
      // COMMIT acknowledgement alone is insufficient if exclusion was lost meanwhile.
      if(!await this.held())throw new Error('FENCE_LOST');
      await this.ledger.record('COMMITTED',this.#binding,this.epoch);
      this.#state='COMMITTED';return 'COMMITTED';
    } catch {this.#state='UNKNOWN';return 'COMMIT_OUTCOME_UNKNOWN';}
  }
  async confirmRollback(work:()=>Promise<void>):Promise<void>{
    if(this.#state!=='ACTIVE'&&this.#state!=='ABORTED')throw new PhoneConcurrencyBlocked('RECONCILIATION_REQUIRED');
    this.#state='UNKNOWN';await work();
    await this.ledger.record('ABORTED_BEFORE_COMMIT',this.#binding,this.epoch);this.#state='ABORTED';
  }
  // No retry/reset/reconciliation writer. A separate read-only reconciliation and new review are required.
}
