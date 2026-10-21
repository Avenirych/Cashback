import { Injectable, Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { EvidenceService } from './evidence.service';
import { evidenceHash } from './evidence-locks';
import { CORRECTION_AUTHORITY } from './correction-authority';
import type { CorrectionAuthority, CorrectionRight } from './correction-authority';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ref(v:string):string{if(typeof v!=='string'||!uuid.test(v))throw Error('Invalid correction reference');return v.toLowerCase();}
function key(v:string):string{if(typeof v!=='string'||!/^[A-Za-z0-9:_-]{8,160}$/.test(v))throw Error('Invalid correction key');return v;}
function reason(v:string):string{if(typeof v!=='string'||!v.trim()||v.length>1000||/[\u0000-\u001f]/.test(v))throw Error('Invalid correction reason');return v;}
function fields(v:unknown,names:string[]){if(!v||typeof v!=='object'||Object.keys(v).sort().join(',')!==names.sort().join(','))throw Error('Invalid correction command fields');}
export interface CorrectionRequestCommand {commandKey:string;partId:string;contextId:string;reason:string;}
export interface ReviewCorrectionCommand {commandKey:string;requestId:string;contextId:string;decision:'approved'|'rejected';reason:string;basisReference:string;expectedOperationVersion:number;}
export class CorrectionEvidenceBlockedError extends Error {readonly code='CORRECTION_EVIDENCE_BLOCKED';constructor(){super('New correction decision blocked by bank evidence');}}
export interface CorrectionCurrentState {requestId:string;status:'requested'|'approved'|'rejected'|'review_required'|'blocked'|'identity_unverified';operationVersion:number;blocked:boolean;decisionId:string|null;applicationImplemented:false;}
@Injectable()
export class ClassificationCorrectionsService {
 constructor(private readonly ds:DataSource,private readonly evidence:EvidenceService,@Optional() @Inject(CORRECTION_AUTHORITY) private readonly authority?:CorrectionAuthority){}
 private active(m:EntityManager){const r=m?.queryRunner;if(m?.connection!==this.ds||!r||r.connection!==this.ds||r.manager!==m||!r.isTransactionActive||r.isReleased)throw Error('Active correction transaction manager required');}
 async authorizeForCorrectionWithManager(m:EntityManager,principal:string,context:string,right:CorrectionRight){
  this.active(m);const [isolation]=await m.query('SHOW transaction_isolation');if(isolation?.transaction_isolation!=='read committed')throw Error('Correction review currently requires READ COMMITTED; future application needs SERIALIZABLE');
  await m.query('SELECT pg_advisory_xact_lock(726405, 0)');if(!this.authority)throw Error('Trusted correction authority is not configured');
  const a=await this.authority.authorizeWithManager(m,ref(principal),context,right);
  if(!a||a.identityVerified!==true||a.right!==right||ref(a.contextId)!==context)throw Error('Trusted correction permission or participant identity denied');
  return {principalId:ref(a.principalId),participantId:ref(a.participantId),contextId:ref(a.contextId)};
 }
 private async lockPart(m:EntityManager,partId:string,context:string){
  const [p]=await m.query('SELECT p."receiptId",c."contextId",l.id AS "lotId" FROM public.finance_receipt_classified_parts p JOIN public.finance_receipt_classifications c ON c.id=p."classificationId" JOIN public.finance_funding_lots l ON l."receiptId"=p."receiptId" WHERE p.id=$1',[partId]);
  if(!p||p.contextId!==context)throw Error('Classified part outside trusted correction context');
  const trust=await this.evidence.inspectLotEvidenceWithManager(m,p.lotId);
  await m.query('SELECT id FROM public.finance_funding_lots WHERE id=$1 FOR UPDATE',[p.lotId]);await m.query('SELECT id FROM public.finance_bank_receipts WHERE id=$1 FOR UPDATE',[p.receiptId]);
  const [op]=await m.query('SELECT id,state,version FROM public.finance_bank_operations WHERE id=$1',[trust.operationId]);if(!op)throw Error('Missing canonical correction operation');return {...p,op};
 }
 private result(r:any,replay:boolean){return {requestId:r.id,partId:r.partId,reason:r.reason,createdAt:new Date(r.createdAt).toISOString(),status:'requested' as const,replay};}
 async requestCorrectionWithManager(m:EntityManager,principal:string,input:CorrectionRequestCommand){
  fields(input,['commandKey','partId','contextId','reason']);const c={commandKey:key(input.commandKey),partId:ref(input.partId),contextId:ref(input.contextId),reason:reason(input.reason)};
  const a=await this.authorizeForCorrectionWithManager(m,principal,c.contextId,'request_classification_correction');await this.lockPart(m,c.partId,c.contextId);
  const hash=evidenceHash([c.partId,c.reason,a]);const [old]=await m.query('SELECT * FROM public.finance_classification_correction_requests WHERE "commandKey"=$1',[c.commandKey]);
  if(old){if(!old.participantId)throw Error('Historical correction identity is unverified');if(old.requestHash!==hash)throw Error('Correction request idempotency conflict');return this.result(old,true);}
  const id=randomUUID();const [r]=await m.query('INSERT INTO public.finance_classification_correction_requests(id,"commandKey","requestHash","partId",reason,"actorId","contextId",status,"participantId") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[id,c.commandKey,hash,c.partId,c.reason,a.principalId,a.contextId,'requested',a.participantId]);return this.result(r,false);
 }
 async lockRequestWithManager(m:EntityManager,requestId:string,context:string){
  const [origin]=await m.query('SELECT * FROM public.finance_classification_correction_requests WHERE id=$1',[requestId]);if(!origin||origin.contextId!==context)throw Error('Unknown correction request in context');
  const part=await this.lockPart(m,origin.partId,context);const [r]=await m.query('SELECT * FROM public.finance_classification_correction_requests WHERE id=$1 FOR UPDATE',[requestId]);return {r,...part};
 }
 async assertIndependentWithManager(m:EntityManager,r:any,participantId:string):Promise<void>{
  if(!r.participantId)throw Error('Historical correction identity is unverified');
  if(r.participantId===participantId)throw Error('Independent correction participant required');
  if(r.linkedFromRequestId){const rows=await m.query('WITH RECURSIVE ancestry AS (SELECT id,"participantId","linkedFromRequestId" FROM public.finance_classification_correction_requests WHERE id=$1 UNION ALL SELECT p.id,p."participantId",p."linkedFromRequestId" FROM public.finance_classification_correction_requests p JOIN ancestry a ON p.id=a."linkedFromRequestId") SELECT id,"participantId" FROM ancestry',[r.id]);if(rows.some((x:any)=>!x.participantId||x.participantId===participantId))throw Error('Independent verified ancestry participant required');}
 }
 private current(r:any,op:any,ds:any[]):CorrectionCurrentState {
  const now=ds.find(d=>d.operationVersion===op.version);const status=!r.participantId?'identity_unverified':op.state!=='eligible'?'blocked':now?now.decision:ds.length?'review_required':'requested';
  return {requestId:r.id,status,operationVersion:op.version,blocked:op.state!=='eligible',decisionId:now?.id??null,applicationImplemented:false};
 }
 async stateWithManager(m:EntityManager,principal:string,requestId:string,contextId:string):Promise<CorrectionCurrentState>{
  const ctx=ref(contextId);await this.authorizeForCorrectionWithManager(m,principal,ctx,'review_classification_correction');const {r,op}=await this.lockRequestWithManager(m,ref(requestId),ctx);const rows=await m.query('SELECT * FROM public.finance_classification_correction_decisions WHERE "requestId"=$1 ORDER BY "operationVersion",id',[r.id]);return this.current(r,op,rows);
 }
 async reviewWithManager(m:EntityManager,principal:string,input:ReviewCorrectionCommand){
  fields(input,['commandKey','requestId','contextId','decision','reason','basisReference','expectedOperationVersion']);
  if(!['approved','rejected'].includes(input.decision)||!Number.isSafeInteger(input.expectedOperationVersion)||input.expectedOperationVersion<1)throw Error('Invalid correction decision/version');
  const c={commandKey:key(input.commandKey),requestId:ref(input.requestId),contextId:ref(input.contextId),decision:input.decision,reason:reason(input.reason),basisReference:ref(input.basisReference),expectedOperationVersion:input.expectedOperationVersion};
  const a=await this.authorizeForCorrectionWithManager(m,principal,c.contextId,'review_classification_correction');const {r,op}=await this.lockRequestWithManager(m,c.requestId,c.contextId);
  if(!r.participantId)throw Error('Historical correction identity is unverified');await this.assertIndependentWithManager(m,r,a.participantId);
  const hash=evidenceHash([c.requestId,c.decision,c.reason,c.basisReference,c.expectedOperationVersion,a]);
  const rows=await m.query('SELECT * FROM public.finance_classification_correction_decisions WHERE "requestId"=$1 OR "commandKey"=$2 ORDER BY "operationVersion",id',[r.id,c.commandKey]);
  const old=rows.find((d:any)=>d.commandKey===c.commandKey);
  if(old){if(old.requestHash!==hash)throw Error('Correction decision idempotency conflict');return {decisionId:old.id,requestId:old.requestId,decision:old.decision,operationVersion:old.operationVersion,createdAt:new Date(old.createdAt).toISOString(),replay:true,current:this.current(r,op,rows.filter((d:any)=>d.requestId===r.id))};}
  if(op.state!=='eligible')throw new CorrectionEvidenceBlockedError();if(op.version!==c.expectedOperationVersion)throw Error('Correction operation version changed; independent review required');
  if(rows.some((d:any)=>d.requestId===r.id&&d.operationVersion===op.version))throw Error('Correction already decided for this operation version');
  await this.authority!.verifyDecisionBasisWithManager(m,c.basisReference,r.id,c.decision);
  const id=randomUUID();const [d]=await m.query('INSERT INTO public.finance_classification_correction_decisions(id,"requestId","actorId","participantId","contextId",decision,reason,"basisReference","operationId","operationVersion","commandKey","requestHash") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',[id,r.id,a.principalId,a.participantId,a.contextId,c.decision,c.reason,c.basisReference,op.id,op.version,c.commandKey,hash]);
  return {decisionId:d.id,requestId:d.requestId,decision:d.decision,operationVersion:d.operationVersion,createdAt:new Date(d.createdAt).toISOString(),replay:false,current:this.current(r,op,[d])};
 }
}
