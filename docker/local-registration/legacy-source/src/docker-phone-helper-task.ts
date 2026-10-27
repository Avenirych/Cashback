import {createPublicKey,verify} from 'node:crypto';
import {approvalSigningBytes} from './docker-phone-approved-evidence';
import type {ApprovalTrustAnchor} from './docker-phone-approved-evidence';
import {REGISTRATION_PHONE_EXPECTED as E,registrationSecurityDigest as hash} from './docker-phone-registration-target';
import {PHONE_CATALOG_SQL,PHONE_PREVIOUS,PHONE_MIGRATION} from './docker-phone-migration-preflight';
import type {LedgerState} from './docker-phone-infrastructure-ledger';

export interface HelperIdentity {
  context:string;daemonId:string;project:string;containerId:string;
  service:'migration-executor'|'observer';image:string;configurationSha256:string;
}
export type HelperOperation='helper.describe'|'migration.plan'|'migration.catalog'|'observer.identity';
export interface HelperTask {
  format:'registration-helper-task/v1';id:string;creationId:string;identity:HelperIdentity;fencingEpoch:string;
  operation:HelperOperation;sqlApprovalId:string|null;querySha256:string|null;
  issuedAt:number;expiresAt:number;maxRuntimeMs:number;
}
export interface HelperSqlApproval {
  format:'registration-helper-sql/v1';id:string;taskSha256:string;identity:HelperIdentity;
  fencingEpoch:string;querySha256:string;expiresAt:number;readOnly:true;
}
export interface HelperTaskEnvelope {
  format:'registration-helper-task-envelope/v1';issuer:string;keyId:string;audience:'cashback-registration-helper';
  challenge:string;issuedAt:number;expiresAt:number;task:HelperTask;signature:string;
}
export type HelperTaskResult =
  | {service:string;node:string;APPLY_ELIGIBLE:false;PHONE_APPLY_CONCURRENCY_VERIFIED:false}
  | {baseline:string[];seventh:string;APPLY_ELIGIBLE:false;PHONE_APPLY_CONCURRENCY_VERIFIED:false}
  | {rowCount:number;sha256:string};
export class HelperTaskBlocked extends Error {constructor(readonly code:string){super('HELPER_TASK_BLOCKED:'+code);}}
export function taskDeny(code:string):never{throw new HelperTaskBlocked(code);}
export const OBSERVER_IDENTITY_SQL=`SELECT current_database() AS database, (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid,
current_user AS role, current_setting('server_version_num') AS version,
(SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`;
export function helperTaskQuery(op:HelperOperation):string|null {
  return op==='observer.identity'?OBSERVER_IDENTITY_SQL:op==='migration.catalog'?PHONE_CATALOG_SQL:null;
}
export function helperTaskSqlDigest(op:HelperOperation):string|null {
  const query=helperTaskQuery(op);return query===null?null:hash({identity:OBSERVER_IDENTITY_SQL,query,
    transaction:'BEGIN READ ONLY',completion:'ROLLBACK',statementTimeoutMs:1000,connectionTimeoutMs:1000});
}
const hex=/^[a-f0-9]{64}$/;
const id=/^[a-zA-Z0-9_.:-]{1,128}$/;
export function taskExact(value:any,keys:string[]):boolean{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.sort().join(',');}
export function validateHelperIdentity(i:HelperIdentity):void {
  if(!taskExact(i,['context','daemonId','project','containerId','service','image','configurationSha256'])||i.context!==E.context||i.daemonId!==E.daemonId||i.project!==E.project||
    !hex.test(i.containerId)||i.containerId===E.containerId||!['migration-executor','observer'].includes(i.service)||!hex.test(i.configurationSha256)||
    !/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(i.image))taskDeny('HELPER_IDENTITY_MISMATCH');
}
export function validateHelperTask(t:HelperTask,now?:number):void {
  if(!taskExact(t,['format','id','creationId','identity','fencingEpoch','operation','sqlApprovalId','querySha256','issuedAt','expiresAt','maxRuntimeMs'])||
    t.format!=='registration-helper-task/v1'||!id.test(t.id)||['__proto__','constructor','prototype'].includes(t.id)||!id.test(t.creationId)||
    !/^[1-9][0-9]*$/.test(t.fencingEpoch)||!['helper.describe','migration.plan','migration.catalog','observer.identity'].includes(t.operation)||
    !Number.isSafeInteger(t.issuedAt)||!Number.isSafeInteger(t.expiresAt)||t.expiresAt<=t.issuedAt||t.expiresAt-t.issuedAt>60000||
    !Number.isSafeInteger(t.maxRuntimeMs)||t.maxRuntimeMs<100||t.maxRuntimeMs>30000||
    (now!==undefined&&(t.issuedAt>now||t.expiresAt<=now)))taskDeny('INVALID_OR_EXPIRED_TASK');
  validateHelperIdentity(t.identity);
  if((t.operation.startsWith('migration.')&&t.identity.service!=='migration-executor')||(t.operation==='observer.identity'&&t.identity.service!=='observer'))taskDeny('OPERATION_NOT_ALLOWED');
  const query=helperTaskQuery(t.operation);
  if(query?(t.querySha256!==helperTaskSqlDigest(t.operation)||typeof t.sqlApprovalId!=='string'||!id.test(t.sqlApprovalId)):(t.sqlApprovalId!==null||t.querySha256!==null))taskDeny('SQL_APPROVAL_REQUIRED');
}
export function validateHelperSql(a:HelperSqlApproval,now?:number):void {
  if(!taskExact(a,['format','id','taskSha256','identity','fencingEpoch','querySha256','expiresAt','readOnly'])||a.format!=='registration-helper-sql/v1'||
    !id.test(a.id)||['__proto__','constructor','prototype'].includes(a.id)||!hex.test(a.taskSha256)||!hex.test(a.querySha256)||a.readOnly!==true||
    !/^[1-9][0-9]*$/.test(a.fencingEpoch)||!Number.isSafeInteger(a.expiresAt)||(now!==undefined&&a.expiresAt<=now))taskDeny('INVALID_SQL_APPROVAL');
  validateHelperIdentity(a.identity);
}
/** Bounded public diagnostic summaries only; never raw catalog rows, SQL or secrets. */
export function validateHelperTaskResult(t:HelperTask,r:any):asserts r is HelperTaskResult {
  if(t.operation==='helper.describe'){
    if(!taskExact(r,['service','node','APPLY_ELIGIBLE','PHONE_APPLY_CONCURRENCY_VERIFIED'])||r.service!==t.identity.service||
      typeof r.node!=='string'||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(r.node)||r.APPLY_ELIGIBLE!==false||r.PHONE_APPLY_CONCURRENCY_VERIFIED!==false)taskDeny('INVALID_TASK_RESULT');
  }else if(t.operation==='migration.plan'){
    if(!taskExact(r,['baseline','seventh','APPLY_ELIGIBLE','PHONE_APPLY_CONCURRENCY_VERIFIED'])||hash(r.baseline)!==hash(PHONE_PREVIOUS.map(([,name])=>name))||
      r.seventh!==PHONE_MIGRATION||r.APPLY_ELIGIBLE!==false||r.PHONE_APPLY_CONCURRENCY_VERIFIED!==false)taskDeny('INVALID_TASK_RESULT');
  }else if(!taskExact(r,['rowCount','sha256'])||!Number.isSafeInteger(r.rowCount)||r.rowCount<0||r.rowCount>100000||!hex.test(r.sha256))taskDeny('INVALID_TASK_RESULT');
}
/** Admission derives from the existing durable Post-Start event and full observed identities,
 * never a helper-supplied true flag, Docker label, hostname or baseline PASS. */
export function assertHelperAdmission(s:LedgerState,t:HelperTask,now:number):void {
  const c=s.creations[t.creationId],peer=c?.plan.helpers.find(p=>p.service===t.identity.service);
  if(!c||c.stage!=='SERVICE_ADMITTED'||s.revoked[c.id]||!c.attestation||!peer||
    !c.identities?.some(p=>p.service===t.identity.service&&p.id===t.identity.containerId)||peer.image!==t.identity.image||
    c.attestation.identities.find(p=>p.service===t.identity.service)?.observedConfigurationSha256!==t.identity.configurationSha256)taskDeny('SERVICE_NOT_ADMITTED');
  if(s.epoch!==t.fencingEpoch||c.plan.fencing.epoch!==s.epoch)taskDeny('STALE_FENCING_EPOCH');
  if(s.keys[c.keyId]?.state!=='ACTIVE'||s.keys[c.keyId]?.publicKeyHash!==c.publicKeyHash)taskDeny('AUTHORITY_KEY_REVOKED');
  validateHelperTask(t,now);
}
export function verifyHelperTaskEnvelope(e:HelperTaskEnvelope,anchor:ApprovalTrustAnchor|null,identity:HelperIdentity,challenge:string,now=Date.now()):HelperTask {
  if(!anchor||anchor.purpose!=='enrollment')taskDeny('TRUST_ANCHOR_MISSING');
  try{
    const {signature,...body}=e;
    if(!taskExact(e,['format','issuer','keyId','audience','challenge','issuedAt','expiresAt','task','signature'])||e.format!=='registration-helper-task-envelope/v1'||
      e.issuer!==anchor.issuer||e.keyId!==anchor.keyId||e.audience!=='cashback-registration-helper'||e.challenge!==challenge||!hex.test(challenge)||
      !Number.isSafeInteger(e.issuedAt)||!Number.isSafeInteger(e.expiresAt)||e.issuedAt>now||e.expiresAt<=now||e.expiresAt-e.issuedAt>4000||
      e.expiresAt>e.task.expiresAt||hash(e.task.identity)!==hash(identity)||createPublicKey(anchor.publicKeyPem).asymmetricKeyType!=='ed25519'||
      typeof signature!=='string'||Buffer.from(signature,'base64').toString('base64')!==signature||
      !verify(null,approvalSigningBytes(body),createPublicKey(anchor.publicKeyPem),Buffer.from(signature,'base64')))taskDeny('INVALID_TASK_SIGNATURE');
    validateHelperTask(e.task,now);return JSON.parse(approvalSigningBytes(e.task).toString());
  }catch(e){if(e instanceof HelperTaskBlocked)throw e;taskDeny('INVALID_TASK_SIGNATURE');}
}
