import { open, readFile, lstat, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { approvalSigningBytes } from './docker-phone-approved-evidence';
import { registrationSecurityDigest as hash, REGISTRATION_PHONE_EXPECTED as E } from './docker-phone-registration-target';
import type { DurableMigrationOutcome, ExclusivityBinding } from './docker-phone-concurrency';
import { validateCreationPlan, validateCreatedIdentities, validateCreationAttestation, validateCreatedNetwork } from './docker-phone-creation-contract';
import type { CreationPlan, CreatedHelperIdentity, CreationAttestation, CreatedNetworkIdentity, CreationPartialResult } from './docker-phone-creation-contract';
import {validateHelperTask,validateHelperSql,assertHelperAdmission,validateHelperTaskResult} from './docker-phone-helper-task';
import type {HelperTask,HelperSqlApproval,HelperTaskResult} from './docker-phone-helper-task';

export type LedgerEvent =
  | {kind:'helper-task-approved';task:HelperTask;keyId:string;publicKeyHash:string}
  | {kind:'helper-sql-approved';approval:HelperSqlApproval;keyId:string;publicKeyHash:string}
  | {kind:'helper-task-started';id:string;runId:string;challenge:string;at:number}
  | {kind:'helper-task-finished';id:string;runId:string;outcome:'SUCCEEDED'|'UNKNOWN';resultSha256:string;result?:HelperTaskResult;at:number}
  | {kind:'epoch'; epoch:string}
  | {kind:'enroll'; id:string; session:string; review:string; security:string; epoch:string; expires:number}
  | {kind:'nonce-issued'|'nonce-used'; id:string; purpose:string}
  | {kind:'approval'; id:string; purpose:string; review:string; payloadHash:string; expires:number; enrollmentId?:string;epoch?:string;session?:string;security?:string}
  | {kind:'receipt-used'; id:string; lease:string}
  | {kind:'revoke'; id:string; reason:string}
  | {kind:'commit-pending'; review:string; session:string; epoch:string}
  | {kind:'commit-known'; review:string; session:string; epoch:string; outcome:'COMMITTED'|'ABORTED_BEFORE_COMMIT'}
  | {kind:'reconciliation'; review:string; evidenceHash:string; outcome:'COMMITTED'|'ABORTED_BEFORE_COMMIT'; readOnly:true}
  | {kind:'creation-authorized';id:string;scope:string;plan:CreationPlan;expires:number;keyId:string;publicKeyHash:string}
  | {kind:'creation-reserved';id:string;reservation:string;scope:string;epoch:string;challenge:string;at:number}
  | {kind:'creation-created';id:string;reservation:string;scope:string;identities:readonly CreatedHelperIdentity[];network?:CreatedNetworkIdentity}
  | {kind:'creation-progress';id:string;reservation:string;scope:string;partial:CreationPartialResult}
  | {kind:'creation-unknown';id:string;reservation:string;scope:string;partial?:CreationPartialResult}
  | {kind:'creation-attested';id:string;attestation:CreationAttestation}
  | {kind:'creation-admitted';id:string;reservation:string;scope:string;evidenceHash:string;at:number}
  | {kind:'key-state'; id:string; publicKeyHash:string; state:'ACTIVE'|'REVOKED'};
interface Frame {version:1; sequence:number; previous:string; target:string; event:LedgerEvent; sha256:string}
export interface LedgerState {
  helperTasks:Record<string,{task:HelperTask;keyId:string;publicKeyHash:string;status:'APPROVED'|'RUNNING'|'SUCCEEDED'|'UNKNOWN';runId?:string;resultSha256?:string;result?:HelperTaskResult;confirmedOutcome?:'SUCCEEDED';uncertaintySha256?:string}>;
  helperSql:Record<string,{approval:HelperSqlApproval;keyId:string;publicKeyHash:string;used:boolean}>;
  epoch:string; sessions:Record<string,Extract<LedgerEvent,{kind:'enroll'}>>;
  nonces:Record<string,string>; usedNonces:Record<string,true>;
  approvals:Record<string,Extract<LedgerEvent,{kind:'approval'}>>; spent:Record<string,string>;
  revoked:Record<string,string>; keys:Record<string,{publicKeyHash:string;state:'ACTIVE'|'REVOKED'}>;
  commits:Record<string,{session:string;epoch:string;outcome:string}>;
  creations:Record<string,{id:string;scope:string;plan:CreationPlan;expires:number;keyId:string;publicKeyHash:string;
    stage:'CREATION_AUTHORIZED'|'CREATED_UNVERIFIED'|'IDENTITY_ATTESTED'|'SERVICE_ADMITTED'|'UNKNOWN_OUTCOME';
    reservation?:string;identities?:readonly CreatedHelperIdentity[];network?:CreatedNetworkIdentity;attestation?:CreationAttestation;
    partial?:CreationPartialResult}>;
}
function deny(code:string):never {throw new Error('REGISTRATION_LEDGER:'+code);}
const hex=/^[a-f0-9]{64}$/;
const id=/^[a-zA-Z0-9:_.-]{1,256}$/;
const target=hash(E);
function initial():LedgerState{return {helperTasks:{},helperSql:{},epoch:'0',sessions:{},nonces:{},usedNonces:{},approvals:{},spent:{},revoked:{},keys:{},commits:{},creations:{}};}
function identifier(v:string){if(!id.test(v)||['__proto__','constructor','prototype'].includes(v))deny('INVALID_ID');}
function digest(v:string){if(!hex.test(v))deny('INVALID_DIGEST');}
function mergeCreationPartial(previous:CreationPartialResult|undefined,next:CreationPartialResult,plan:CreationPlan):CreationPartialResult{
  if(!next||typeof next!=='object'||Object.keys(next).some(k=>!['identities','network','returnedNetworkId'].includes(k)))deny('CREATION_PARTIAL_IDENTITY_INVALID');
  if(next.returnedNetworkId!==undefined&&(!hex.test(next.returnedNetworkId)||plan.newNetwork===null||plan.helpers[0].networks.some(n=>n.id===next.returnedNetworkId)))deny('CREATION_PARTIAL_IDENTITY_INVALID');
  if(previous?.returnedNetworkId&&next.returnedNetworkId&&previous.returnedNetworkId!==next.returnedNetworkId)deny('CREATION_PARTIAL_IDENTITY_CHANGED');
  const ids=next.identities;
  if(ids&&(!Array.isArray(ids)||ids.length>2||new Set(ids.map(v=>v.id)).size!==ids.length||new Set(ids.map(v=>v.service)).size!==ids.length||
    ids.some(v=>!v||Object.keys(v).sort().join(',')!=='id,service'||!['migration-executor','observer'].includes(v.service)||!hex.test(v.id)||v.id===E.containerId)))deny('CREATION_PARTIAL_IDENTITY_INVALID');
  if(next.network)validateCreatedNetwork(next.network,plan);
  if(previous?.network&&next.network&&hash(previous.network)!==hash(next.network))deny('CREATION_PARTIAL_IDENTITY_CHANGED');
  const returnedNetworkId=previous?.returnedNetworkId??next.returnedNetworkId,network=previous?.network??next.network;
  if(returnedNetworkId&&network&&returnedNetworkId!==network.id)deny('CREATION_PARTIAL_IDENTITY_CHANGED');
  if(previous?.identities&&ids&&previous.identities.some(old=>ids.some(v=>v.service===old.service&&v.id!==old.id)))deny('CREATION_PARTIAL_IDENTITY_CHANGED');
  const merged=[...(previous?.identities??[])];for(const identity of ids??[])if(!merged.some(v=>v.service===identity.service))merged.push(identity);
  if(new Set(merged.map(v=>v.id)).size!==merged.length)deny('CREATION_PARTIAL_IDENTITY_CHANGED');
  return {...(previous??{}),...(returnedNetworkId?{returnedNetworkId}:{}),...(next.network?{network:next.network}:{}),...(previous?.identities||ids?{identities:merged}:{})};
}
/** Replay uses the same transition validation as writes. No observed facts become approvals. */
function reduce(s:LedgerState,e:LedgerEvent):void {
  switch(e.kind){
    case 'helper-task-approved':{
      validateHelperTask(e.task);identifier(e.task.id);identifier(e.keyId);digest(e.publicKeyHash);
      if(s.helperTasks[e.task.id]||s.revoked[e.task.id]||s.keys[e.keyId]?.state!=='ACTIVE'||s.keys[e.keyId]?.publicKeyHash!==e.publicKeyHash)deny('HELPER_TASK_REPLAY_OR_KEY_REVOKED');
      s.helperTasks[e.task.id]={task:e.task,keyId:e.keyId,publicKeyHash:e.publicKeyHash,status:'APPROVED'};break;
    }
    case 'helper-sql-approved':{
      validateHelperSql(e.approval);identifier(e.approval.id);identifier(e.keyId);digest(e.publicKeyHash);
      if(s.helperSql[e.approval.id]||s.revoked[e.approval.id]||s.keys[e.keyId]?.state!=='ACTIVE'||s.keys[e.keyId]?.publicKeyHash!==e.publicKeyHash)deny('HELPER_SQL_REPLAY_OR_KEY_REVOKED');
      s.helperSql[e.approval.id]={approval:e.approval,keyId:e.keyId,publicKeyHash:e.publicKeyHash,used:false};break;
    }
    case 'helper-task-started':{
      identifier(e.id);digest(e.runId);digest(e.challenge);const row=s.helperTasks[e.id];
      if(!row||row.status!=='APPROVED'||s.revoked[e.id]||s.keys[row.keyId]?.state!=='ACTIVE'||s.keys[row.keyId]?.publicKeyHash!==row.publicKeyHash||
        !Number.isSafeInteger(e.at)||s.nonces[e.challenge]!=='helper-task-request'||s.usedNonces[e.challenge])deny('HELPER_TASK_REPLAY_OR_UNKNOWN_OUTCOME');
      assertHelperAdmission(s,row.task,e.at);
      if(row.task.sqlApprovalId){const sql=s.helperSql[row.task.sqlApprovalId],a=sql?.approval;
        if(!sql||sql.used||s.revoked[a.id]||s.keys[sql.keyId]?.state!=='ACTIVE'||s.keys[sql.keyId]?.publicKeyHash!==sql.publicKeyHash||a.expiresAt<=e.at||
          a.taskSha256!==hash(row.task)||a.fencingEpoch!==row.task.fencingEpoch||a.querySha256!==row.task.querySha256||hash(a.identity)!==hash(row.task.identity))deny('HELPER_SQL_APPROVAL_REQUIRED');
        sql.used=true;
      }
      s.usedNonces[e.challenge]=true;row.runId=e.runId;row.status='RUNNING';break;
    }
    case 'helper-task-finished':{
      identifier(e.id);digest(e.runId);digest(e.resultSha256);const row=s.helperTasks[e.id];
      if(!row||row.runId!==e.runId||!['SUCCEEDED','UNKNOWN'].includes(e.outcome)||!Number.isSafeInteger(e.at))deny('HELPER_RESULT_BINDING_MISMATCH');
      if(row.status!=='RUNNING'){
        if(e.outcome==='UNKNOWN'&&row.status==='SUCCEEDED'){
          // Preserve the known server result AND durably record the client's lost ACK.
          // Subsequent work remains blocked until independent reconciliation.
          row.confirmedOutcome='SUCCEEDED';row.uncertaintySha256=e.resultSha256;row.status='UNKNOWN';break;
        }
        if(e.outcome==='UNKNOWN'&&row.status==='UNKNOWN'&&row.uncertaintySha256===e.resultSha256)break;
        if(row.status===e.outcome&&row.resultSha256===e.resultSha256)break;
        deny('HELPER_RESULT_REPLAY');
      }
      if(e.outcome==='SUCCEEDED'){
        if(s.revoked[e.id]||s.keys[row.keyId]?.state!=='ACTIVE')deny('HELPER_TASK_CANCELLED');
        assertHelperAdmission(s,row.task,e.at);
        validateHelperTaskResult(row.task,e.result);if(hash(e.result)!==e.resultSha256)deny('HELPER_RESULT_DIGEST_MISMATCH');row.result=e.result;
      }
      row.status=e.outcome;row.resultSha256=e.resultSha256;break;
    }
    case 'epoch':
      if(!/^[1-9][0-9]*$/.test(e.epoch)||BigInt(e.epoch)!==BigInt(s.epoch)+1n||Object.values(s.commits).some(c=>c.outcome==='PENDING')||
        Object.values(s.helperTasks).some(t=>t.status==='RUNNING'||t.status==='UNKNOWN')||
        Object.values(s.creations).some(c=>c.reservation&&c.stage!=='SERVICE_ADMITTED'))deny('EPOCH_OR_RECONCILIATION_REQUIRED');
      s.epoch=e.epoch;break;
    case 'enroll':
      identifier(e.id);[e.session,e.review,e.security].forEach(digest);
      if(s.sessions[e.id]||e.epoch!==s.epoch||!Number.isSafeInteger(e.expires)||e.expires<=0)deny('ENROLLMENT_REPLAYED');
      s.sessions[e.id]=e;break;
    case 'nonce-issued':
      digest(e.id);identifier(e.purpose);if(s.nonces[e.id]||s.usedNonces[e.id])deny('NONCE_REPLAYED');s.nonces[e.id]=e.purpose;break;
    case 'nonce-used':
      digest(e.id);if(s.nonces[e.id]!==e.purpose||s.usedNonces[e.id])deny('NONCE_REPLAYED');s.usedNonces[e.id]=true;break;
    case 'approval':
      identifier(e.id);identifier(e.purpose);digest(e.review);digest(e.payloadHash);
      if(e.purpose==='receipts'){
        if(!e.enrollmentId||!e.epoch||!e.session||!e.security)deny('RECEIPT_BINDING_REQUIRED');
        digest(e.enrollmentId);digest(e.session);digest(e.security);
        const enrolled=s.sessions[e.enrollmentId];
        if(!enrolled||s.revoked[e.enrollmentId]||enrolled.epoch!==e.epoch||e.epoch!==s.epoch||enrolled.session!==e.session||enrolled.review!==e.review||enrolled.security!==e.security)deny('RECEIPT_BINDING_CHANGED');
      }
      if(s.approvals[e.id]||s.revoked[e.id]||!Number.isSafeInteger(e.expires)||e.expires<=0)deny('APPROVAL_REPLAYED');s.approvals[e.id]=e;break;
    case 'receipt-used':
      identifier(e.id);identifier(e.lease);if(!s.approvals[e.id]||s.revoked[e.id]||s.spent[e.id])deny('RECEIPT_REPLAYED');s.spent[e.id]=e.lease;break;
    case 'revoke':identifier(e.id);identifier(e.reason);s.revoked[e.id]=e.reason;break;
    case 'commit-pending':
      digest(e.review);digest(e.session);
      if(e.epoch!==s.epoch||!Object.values(s.sessions).some(v=>v.session===e.session&&v.review===e.review&&v.epoch===e.epoch&&!s.revoked[v.id])||
        (s.commits[e.review]&&s.commits[e.review].outcome!=='ABORTED_BEFORE_COMMIT'))deny('RECONCILIATION_REQUIRED');
      s.commits[e.review]={session:e.session,epoch:e.epoch,outcome:'PENDING'};break;
    case 'commit-known':{
      const c=s.commits[e.review];if(!c||c.outcome!=='PENDING'||c.session!==e.session||c.epoch!==e.epoch||e.epoch!==s.epoch)deny('OUTCOME_BINDING_CHANGED');
      if(!['COMMITTED','ABORTED_BEFORE_COMMIT'].includes(e.outcome))deny('INVALID_OUTCOME');c.outcome=e.outcome;break;
    }
    case 'reconciliation':{
      digest(e.evidenceHash);const c=s.commits[e.review];
      if(e.readOnly!==true||!c||!['PENDING','COMMITTED'].includes(c.outcome)||
        (c.outcome==='COMMITTED'&&e.outcome!=='COMMITTED')||!['COMMITTED','ABORTED_BEFORE_COMMIT'].includes(e.outcome))deny('RECONCILIATION_INVALID');
      c.outcome=e.outcome;break;
    }
    case 'creation-authorized':{
      identifier(e.id);digest(e.scope);identifier(e.keyId);digest(e.publicKeyHash);const plan=validateCreationPlan(e.plan);
      if(s.creations[e.id]||s.revoked[e.id]||hash(plan)!==e.scope||!Number.isSafeInteger(e.expires)||e.expires<=0||e.expires>plan.expiresAt||
        s.keys[e.keyId]?.state!=='ACTIVE'||s.keys[e.keyId]?.publicKeyHash!==e.publicKeyHash||plan.fencing.epoch!==s.epoch)deny('CREATION_AUTHORIZATION_INVALID');
      // Distinct authorization IDs cannot approve overlapping creation of the same exact helpers.
      if(Object.values(s.creations).some(c=>c.plan.identity.project===plan.identity.project))deny('CREATION_RECONCILIATION_REQUIRED');
      s.creations[e.id]={id:e.id,scope:e.scope,plan:e.plan,expires:e.expires,keyId:e.keyId,publicKeyHash:e.publicKeyHash,stage:'CREATION_AUTHORIZED'};break;
    }
    case 'creation-reserved':{
      digest(e.reservation);digest(e.scope);digest(e.challenge);const c=s.creations[e.id];
      if(!c||c.reservation||c.stage!=='CREATION_AUTHORIZED'||c.scope!==e.scope||s.revoked[e.id]||
        c.plan.fencing.epoch!==e.epoch||e.epoch!==s.epoch||!Number.isSafeInteger(e.at)||e.at<0||c.expires<=e.at||s.usedNonces[e.challenge]||
        s.nonces[e.challenge]!=='request-creation')deny('CREATION_REPLAY_OR_RECONCILIATION_REQUIRED');
      if(Object.values(s.creations).some(v=>v.reservation===e.reservation))deny('CREATION_RESERVATION_REPLAYED');
      s.usedNonces[e.challenge]=true;c.reservation=e.reservation;break;
    }
    case 'creation-created':{
      const c=s.creations[e.id];
      if(!c||c.stage!=='CREATION_AUTHORIZED'||c.reservation!==e.reservation||c.scope!==e.scope)deny('CREATION_RESULT_BINDING_MISMATCH');
      validateCreatedNetwork(e.network,c.plan);const ids=validateCreatedIdentities(e.identities);
      if(c.partial?.identities?.some(old=>!ids.some(v=>v.service===old.service&&v.id===old.id))||
        (c.partial?.network&&hash(c.partial.network)!==hash(e.network))||
        (c.partial?.returnedNetworkId&&c.partial.returnedNetworkId!==e.network?.id))deny('CREATION_PARTIAL_IDENTITY_CHANGED');
      c.identities=ids;if(e.network)c.network=e.network;c.stage='CREATED_UNVERIFIED';break;
    }
    case 'creation-progress':{
      const c=s.creations[e.id];
      if(!c||c.stage!=='CREATION_AUTHORIZED'||c.reservation!==e.reservation||c.scope!==e.scope)deny('CREATION_RESULT_BINDING_MISMATCH');
      c.partial=mergeCreationPartial(c.partial,e.partial,c.plan);break;
    }
    case 'creation-unknown':{
      const c=s.creations[e.id];
      if(!c||c.stage!=='CREATION_AUTHORIZED'||c.reservation!==e.reservation||c.scope!==e.scope)deny('CREATION_RESULT_BINDING_MISMATCH');
      if(e.partial)c.partial=mergeCreationPartial(c.partial,e.partial,c.plan);
      c.stage='UNKNOWN_OUTCOME';break;
    }
    case 'creation-attested':{
      const c=s.creations[e.id],a=e.attestation;
      if(!c||!['CREATED_UNVERIFIED','IDENTITY_ATTESTED'].includes(c.stage)||!c.identities||a.authorizationId!==e.id||a.reservationId!==c.reservation||s.revoked[e.id]||c.plan.fencing.epoch!==s.epoch)deny('CREATION_ATTESTATION_BINDING_MISMATCH');
      validateCreationAttestation(a,c.plan,c.identities,undefined,c.network);
      if(c.attestation&&(a.observedAt<c.attestation.observedAt||hash(a.identities)!==hash(c.attestation.identities)))deny('CREATION_ATTESTATION_CHANGED');
      c.attestation=a;c.stage='IDENTITY_ATTESTED';break;
    }
    case 'creation-admitted':{
      const c=s.creations[e.id];digest(e.evidenceHash);
      if(!c||c.stage!=='IDENTITY_ATTESTED'||!c.attestation||s.revoked[e.id]||c.reservation!==e.reservation||c.scope!==e.scope||
        c.plan.fencing.epoch!==s.epoch||!Number.isSafeInteger(e.at)||e.at<c.attestation.observedAt||c.attestation.expiresAt<=e.at)deny('CREATION_SERVICE_ADMISSION_BLOCKED');
      // Emitted only by existing trusted control-plane after its fresh service collector passes.
      c.stage='SERVICE_ADMITTED';break;
    }
    case 'key-state':
      identifier(e.id);digest(e.publicKeyHash);
      if(s.keys[e.id]&&(s.keys[e.id].state==='REVOKED'||s.keys[e.id].publicKeyHash!==e.publicKeyHash))deny('KEY_REUSE');
      if(!['ACTIVE','REVOKED'].includes(e.state))deny('INVALID_KEY_STATE');s.keys[e.id]={publicKeyHash:e.publicKeyHash,state:e.state};break;
    default:deny('UNKNOWN_EVENT');
  }
}
/** Single independently controlled writer. Directory MUST be pre-provisioned with protected ACL.
 * Exclusive wx lock is never stolen by PID/expiry; crash requires fenced operator recovery.
 * Hash chain detects corruption, not a malicious host administrator rewriting the whole store.
 * No constructor IO, automatic directory creation, reset, truncation or stale-lock deletion.
 */
export class RegistrationInfrastructureLedger {
  constructor(readonly directory:string){if(!isAbsolute(directory))deny('ABSOLUTE_DIRECTORY_REQUIRED');}
  private async load():Promise<{state:LedgerState;frames:Frame[]}> {
    const dir=await lstat(this.directory);if(!dir.isDirectory()||dir.isSymbolicLink())deny('UNSAFE_DIRECTORY');
    let raw='';try {
      const stat=await lstat(join(this.directory,'events.jsonl'));if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>16*1024*1024)deny('UNSAFE_LOG');
      raw=await readFile(join(this.directory,'events.jsonl'),'utf8');
    }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')deny('LOG_MISSING_RECOVERY_REQUIRED');throw e;}
    if(raw&&!raw.endsWith('\n'))deny('TORN_TAIL_RECOVERY_REQUIRED');
    const frames:Frame[]=[],state=initial();let previous='0'.repeat(64);
    for(const line of raw.split('\n').filter(Boolean)){
      const f=JSON.parse(line) as Frame,{sha256,...body}=f;
      if(f.version!==1||f.sequence!==frames.length+1||f.previous!==previous||f.target!==target||sha256!==hash(body)||Object.keys(f).length!==6)deny('CHAIN_INVALID');
      reduce(state,f.event);frames.push(f);previous=sha256;
    }
    return {state,frames};
  }
  async inspect():Promise<Readonly<LedgerState>> {return JSON.parse(approvalSigningBytes((await this.load()).state).toString('utf8'));}
  async transaction<T>(work:(state:LedgerState,emit:(event:LedgerEvent)=>void)=>T):Promise<T>{
    // lstat before lock; symlinked/foreign directory is never followed intentionally.
    const dir=await lstat(this.directory);if(!dir.isDirectory()||dir.isSymbolicLink())deny('UNSAFE_DIRECTORY');
    const lock=await open(join(this.directory,'writer.lock'),'wx',0o600).catch(()=>deny('WRITER_LOCKED_RECOVERY_REQUIRED'));
    let safe=false;
    try {
      await lock.writeFile(randomBytes(32).toString('hex'));await lock.sync();
      const {state,frames}=await this.load(),pending:Frame[]=[];
      safe=true; // Transition refusal before any append is a known non-write.
      const result=work(state,event=>{
        const copy=JSON.parse(approvalSigningBytes(event).toString('utf8')) as LedgerEvent;reduce(state,copy);
        const body={version:1 as const,sequence:frames.length+pending.length+1,previous:pending.at(-1)?.sha256??frames.at(-1)?.sha256??'0'.repeat(64),target,event:copy};
        pending.push({...body,sha256:hash(body)});
      });
      if(result instanceof Promise)deny('ASYNC_TRANSACTION_FORBIDDEN');
      if(pending.length){
        safe=false;
        const file=await open(join(this.directory,'events.jsonl'),'a',0o600);
        try {await file.writeFile(pending.map(f=>JSON.stringify(f)).join('\n')+'\n');await file.sync();}finally{await file.close();}
      }
      safe=true;return result;
    }finally{
      await lock.close();
      // Unknown write outcome deliberately leaves the lock for independent recovery.
      if(safe)await unlink(join(this.directory,'writer.lock'));
    }
  }
}
/** Adapter for the existing transaction contract; host boundary must remain independently held. */
export class LedgerMigrationOutcome implements DurableMigrationOutcome {
  constructor(private readonly ledger:RegistrationInfrastructureLedger,private readonly held:(epoch:string)=>Promise<boolean>){}
  async reserve(b:Readonly<ExclusivityBinding>,epoch:string):Promise<void>{
    b=Object.freeze({...b});
    if(!await this.held(epoch))deny('EXTERNAL_FENCE_MISSING');
    await this.ledger.transaction((s,emit)=>{
      if(!Object.values(s.sessions).some(v=>v.session===b.sessionSha256&&v.review===b.reviewSha256&&v.epoch===epoch&&v.expires>Date.now()&&!s.revoked[v.id]))deny('ENROLLMENT_EXPIRED');
      emit({kind:'commit-pending',review:b.reviewSha256,session:b.sessionSha256,epoch});
    });
    if(!await this.held(epoch))deny('EXTERNAL_FENCE_LOST');
  }
  async record(outcome:'COMMITTED'|'ABORTED_BEFORE_COMMIT',b:Readonly<ExclusivityBinding>,epoch:string):Promise<void>{
    b=Object.freeze({...b});
    if(!await this.held(epoch))deny('EXTERNAL_FENCE_MISSING');
    await this.ledger.transaction((_s,emit)=>emit({kind:'commit-known',review:b.reviewSha256,session:b.sessionSha256,epoch,outcome}));
    if(!await this.held(epoch))deny('EXTERNAL_FENCE_LOST');
  }
}
