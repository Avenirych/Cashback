import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { EvidenceRefusedError } from './bank-evidence-verifier';
import type { BankReceiptFacts, VerifiedBankEvidence, TransactionalBankEvidenceVerifier } from './bank-evidence-verifier';
import { EVIDENCE_AUTHORITY } from './evidence-authority';
import type { TrustedEvidenceAuthority, EvidenceAction } from './evidence-authority';
import { bankIdentity, evidenceHash, lockBankIdentity, lockEvidenceScope } from './evidence-locks';
import { assertPence } from './money';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ref(x:string):string{if(typeof x!=='string'||!uuid.test(x))throw Error('Invalid opaque evidence reference');return x.toLowerCase();}
function token(x:string):string{if(typeof x!=='string'||!/^[A-Za-z0-9:_-]{3,160}$/.test(x))throw Error('Invalid evidence command/identity');return x;}
export function snapshotBankFacts(f:BankReceiptFacts):BankReceiptFacts{
 if(!f||Object.keys(f).sort().join(',')!==['sourceNamespace','accountScope','transactionId','currency','amountPence','receivedAt'].sort().join(','))throw Error('Invalid bank facts');
 assertPence(f.amountPence);if(f.amountPence===0n||f.currency!=='GBP'||typeof f.sourceNamespace!=='string'||!/^[A-Za-z0-9:_-]{3,60}$/.test(f.sourceNamespace)||typeof f.transactionId!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(f.transactionId)||typeof f.receivedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(f.receivedAt)||!Number.isFinite(Date.parse(f.receivedAt))||new Date(f.receivedAt).toISOString()!==f.receivedAt)throw Error('Invalid confirmed GBP bank facts');
 return {sourceNamespace:f.sourceNamespace,accountScope:ref(f.accountScope),transactionId:f.transactionId,currency:'GBP',amountPence:f.amountPence,receivedAt:f.receivedAt};
}
export interface ObserveEvidenceCommand {commandKey:string;evidenceReference:string;source:string;accountScope:string;nativeId:string|null;ambiguous:boolean;}
@Injectable()
export class EvidenceService implements TransactionalBankEvidenceVerifier {
 constructor(private readonly ds:DataSource,@Inject(EVIDENCE_AUTHORITY) private readonly authority:TrustedEvidenceAuthority){}
 private manager(m:EntityManager){const r=m?.queryRunner;if(m?.connection!==this.ds||!r||r.connection!==this.ds||r.manager!==m||!r.isTransactionActive||r.isReleased)throw Error('Active evidence transaction manager required');}
 private async actor(m:EntityManager,principal:string,action:EvidenceAction){
  await m.query('SELECT pg_advisory_xact_lock(726405, 0)');const a=await this.authority.authorize(m,ref(principal),action);
  const role=action==='submit'?'evidence_submitter':action==='approve'||action==='recheck'?'evidence_reviewer':action==='history'?null:'evidence_controller';
  if(!a||!uuid.test(a.principalId)||!['evidence_submitter','evidence_reviewer','evidence_controller'].includes(a.role)||(role&&a.role!==role))throw Error('Trusted evidence authorization denied');return {...a,principalId:a.principalId.toLowerCase()};
 }
 private async replay(m:EntityManager,key:string,action:string,actor:string,data:unknown):Promise<any|null>{const hash=evidenceHash([action,actor,data]);const rows=await m.query('SELECT * FROM public.finance_evidence_events WHERE "commandKey"=$1',[token(key)]);if(rows.length){if(rows[0].requestHash!==hash)throw Error('Evidence command conflict');return rows[0].result;}return null;}
 private async event(m:EntityManager,key:string,action:string,actor:string,data:unknown,result:unknown,op:string|null=null){await m.query('INSERT INTO public.finance_evidence_events(id,"commandKey",action,"actorId","requestHash",data,result,"operationId") VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)',[randomUUID(),key,action,actor,evidenceHash([action,actor,data]),JSON.stringify(data),JSON.stringify(result),op]);}
 async observeWithManager(m:EntityManager,principal:string,input:ObserveEvidenceCommand):Promise<{observationId:string;state:string}>{
  this.manager(m);const c={commandKey:token(input.commandKey),evidenceReference:ref(input.evidenceReference),source:token(input.source),accountScope:ref(input.accountScope),nativeId:input.nativeId===null?null:token(input.nativeId),ambiguous:input.ambiguous};
  if(typeof c.ambiguous!=='boolean')throw Error('Invalid observation ambiguity');const actor=await this.actor(m,principal,'submit');await lockEvidenceScope(m,c.accountScope);const old=await this.replay(m,c.commandKey,'submit',actor.principalId,c);if(old)return old;
  const rows=c.nativeId?await m.query('SELECT * FROM public.finance_bank_observations WHERE source=$1 AND "accountScope"=$2 AND "nativeId"=$3',[c.source,c.accountScope,c.nativeId]):[];
  const state=c.ambiguous||!c.nativeId?'quarantined':'pending_review';let observationId:string;
  if(rows.length){if(rows[0].evidenceReference!==c.evidenceReference||rows[0].submitterId!==actor.principalId||rows[0].state!==state)throw Error('Observation alias conflict');observationId=rows[0].id;}
  else{observationId=randomUUID();await m.query('INSERT INTO public.finance_bank_observations(id,"evidenceReference",source,"accountScope","nativeId",state,"submitterId") VALUES($1,$2,$3,$4,$5,$6,$7)',[observationId,c.evidenceReference,c.source,c.accountScope,c.nativeId,state,actor.principalId]);}
  const result={observationId,state};await this.event(m,c.commandKey,'submit',actor.principalId,c,result);return result;
 }
 private async checkedProof(m:EntityManager,evidence:string,f:BankReceiptFacts){const p=await this.authority.inspect(m,evidence,{...f});if(!p||p.status!=='verified'||!uuid.test(p.verificationId)||p.evidenceReference!==evidence||typeof p.verifierReference!=='string'||!/^[A-Za-z0-9:_-]{3,60}$/.test(p.verifierReference)||evidenceHash(snapshotBankFacts({sourceNamespace:p.sourceNamespace,accountScope:p.accountScope,transactionId:p.transactionId,currency:p.currency,amountPence:p.amountPence,receivedAt:p.receivedAt}))!==evidenceHash(f))throw Error('Independent bank proof mismatch');return {...p};}
 async approveWithManager(m:EntityManager,principal:string,key:string,observationId:string,input:BankReceiptFacts,resolutionReference:string|null=null):Promise<{operationId:string;decisionId:string}>{
  this.manager(m);const f=snapshotBankFacts(input),obsId=ref(observationId),resolution=resolutionReference?ref(resolutionReference):null;token(key);const actor=await this.actor(m,principal,'approve');await lockBankIdentity(m,f);
  const data={observationId:obsId,facts:JSON.parse(JSON.stringify(f,(_k,v)=>typeof v==='bigint'?v.toString():v)),resolutionReference:resolution};const old=await this.replay(m,key,'approve',actor.principalId,data);if(old)return old;
  const [obs]=await m.query('SELECT * FROM public.finance_bank_observations WHERE id=$1 FOR UPDATE',[obsId]);if(!obs||obs.accountScope!==f.accountScope||obs.submitterId===actor.principalId)throw Error('Independent reviewer required');if(obs.state==='quarantined'&&!resolution)throw Error('Documented independent reconciliation required');
  if(resolution)await this.authority.verifyReviewDocument(m,resolution,obs.evidenceReference);
  const proof=await this.checkedProof(m,obs.evidenceReference,f);let [op]=await m.query('SELECT * FROM public.finance_bank_operations WHERE identity=$1 FOR UPDATE',[bankIdentity(f)]);
  if(op&&op.factsHash!==evidenceHash(f))throw Error('Canonical bank facts conflict');if(op&&op.state!=='eligible')throw new EvidenceRefusedError('Operation requires independent restoration',op.receiptId);
  if(!op){op={id:randomUUID()};await m.query('INSERT INTO public.finance_bank_operations(id,identity,"accountScope",facts,"factsHash",state) VALUES($1,$2,$3,$4::jsonb,$5,$6)',[op.id,bankIdentity(f),f.accountScope,JSON.stringify(data.facts),evidenceHash(f),'eligible']);}
  const mapped=await m.query('SELECT "operationId" FROM public.finance_bank_decisions WHERE "observationId"=$1',[obsId]);if(mapped.some((x:any)=>x.operationId!==op.id))throw Error('Observation already mapped to another operation');
  const decisionId=randomUUID();await m.query('INSERT INTO public.finance_bank_decisions(id,"operationId","observationId","reviewerId","verifierReference","documentReference") VALUES($1,$2,$3,$4,$5,$6)',[decisionId,op.id,obsId,actor.principalId,proof.verifierReference,resolution]);
  const result={operationId:op.id,decisionId};await this.event(m,key,'approve',actor.principalId,data,result,op.id);return result;
 }
 private async operation(m:EntityManager,id:string){const [peek]=await m.query('SELECT facts FROM public.finance_bank_operations WHERE id=$1',[ref(id)]);if(!peek)throw Error('Unknown bank operation');const f=snapshotBankFacts({...peek.facts,amountPence:BigInt(peek.facts.amountPence)});await lockBankIdentity(m,f);const [op]=await m.query('SELECT * FROM public.finance_bank_operations WHERE id=$1 FOR UPDATE',[id]);return {op,f};}
 async revokeWithManager(m:EntityManager,principal:string,key:string,operationId:string,documentReference:string):Promise<{operationId:string;state:string}>{
  this.manager(m);const id=ref(operationId),doc=ref(documentReference);token(key);const a=await this.actor(m,principal,'revoke');const {op}=await this.operation(m,id);const data={operationId:id,documentReference:doc};const old=await this.replay(m,key,'revoke',a.principalId,data);if(old)return old;
  await this.authority.verifyReviewDocument(m,doc,null);
  await m.query('UPDATE public.finance_bank_operations SET state=$1,version=version+1 WHERE id=$2',['revoked',id]);const result={operationId:id,state:'revoked'};await this.event(m,key,'revoke',a.principalId,data,result,op.id);return result;
 }
 async recheckWithManager(m:EntityManager,principal:string,key:string,operationId:string,observationId:string,documentReference:string):Promise<{reviewId:string}>{
  this.manager(m);const id=ref(operationId),obsId=ref(observationId),doc=ref(documentReference);token(key);const a=await this.actor(m,principal,'recheck');const {op,f}=await this.operation(m,id);const data={operationId:id,observationId:obsId,documentReference:doc};const old=await this.replay(m,key,'recheck',a.principalId,data);if(old)return old;
  if(op.state!=='revoked')throw Error('Only revoked operations require restoration review');const [obs]=await m.query('SELECT * FROM public.finance_bank_observations WHERE id=$1',[obsId]);if(!obs||obs.accountScope!==f.accountScope||obs.submitterId===a.principalId)throw Error('Independent reviewer required');
  await this.authority.verifyReviewDocument(m,doc,obs.evidenceReference);const proof=await this.checkedProof(m,obs.evidenceReference,f);const reviewId=randomUUID();await m.query('INSERT INTO public.finance_bank_restore_reviews(id,"operationId","operationVersion","reviewerId","observationId","documentReference","verifierReference") VALUES($1,$2,$3,$4,$5,$6,$7)',[reviewId,id,op.version,a.principalId,obsId,doc,proof.verifierReference]);const result={reviewId};await this.event(m,key,'recheck',a.principalId,data,result,id);return result;
 }
 async restoreWithManager(m:EntityManager,principal:string,key:string,operationId:string,reviewId:string):Promise<{operationId:string;state:string}>{
  this.manager(m);const id=ref(operationId),review=ref(reviewId);token(key);const a=await this.actor(m,principal,'restore');const {op}=await this.operation(m,id);const data={operationId:id,reviewId:review};const old=await this.replay(m,key,'restore',a.principalId,data);if(old)return old;
  const [r]=await m.query('SELECT * FROM public.finance_bank_restore_reviews WHERE id=$1',[review]);if(op.state!=='revoked'||!r||r.operationId!==id||r.operationVersion!==op.version||r.reviewerId===a.principalId)throw Error('Current independent restoration review required');await m.query('UPDATE public.finance_bank_operations SET state=$1,version=version+1 WHERE id=$2',['eligible',id]);const result={operationId:id,state:'eligible'};await this.event(m,key,'restore',a.principalId,data,result,id);return result;
 }
 async verify():Promise<never>{throw Error('Active manager verification required; no legacy fallback');}
 async verifyWithManager(m:EntityManager,evidence:string,input:BankReceiptFacts):Promise<VerifiedBankEvidence>{
  this.manager(m);await this.authority.assertVerificationEnabled(m);const f=snapshotBankFacts(input),refId=ref(evidence);await lockBankIdentity(m,f);const [op]=await m.query('SELECT * FROM public.finance_bank_operations WHERE identity=$1 FOR UPDATE',[bankIdentity(f)]);if(!op||op.state!=='eligible')throw new EvidenceRefusedError('Bank evidence blocked or unapproved',op?.receiptId??null);if(op.factsHash!==evidenceHash(f))throw Error('Canonical bank facts conflict');
  const [d]=await m.query('SELECT d.*,o."evidenceReference" FROM public.finance_bank_decisions d JOIN public.finance_bank_observations o ON o.id=d."observationId" WHERE d."operationId"=$1 AND o."evidenceReference"=$2 ORDER BY d.id LIMIT 1',[op.id,refId]);if(!d)throw new EvidenceRefusedError('No trusted evidence decision',op.receiptId);return {...f,status:'verified',verificationId:d.id,evidenceReference:refId,verifierReference:d.verifierReference};
 }
 async bindReceiptWithManager(m:EntityManager,p:VerifiedBankEvidence,receiptId:string):Promise<void>{
  const proof=await this.verifyWithManager(m,p.evidenceReference,{sourceNamespace:p.sourceNamespace,accountScope:p.accountScope,transactionId:p.transactionId,currency:p.currency,amountPence:p.amountPence,receivedAt:p.receivedAt});if(proof.verificationId!==p.verificationId)throw Error('Evidence decision changed');const [op]=await m.query('SELECT * FROM public.finance_bank_operations WHERE identity=$1',[bankIdentity(p)]);if(op.receiptId&&op.receiptId!==ref(receiptId))throw Error('Operation already recognised');await m.query('UPDATE public.finance_bank_operations SET "receiptId"=$1 WHERE id=$2',[receiptId,op.id]);
 }
 /** Trust guard only, not permission to spend. Locks remain until caller commit. */
 async inspectLotEvidenceWithManager(m:EntityManager,lotId:string):Promise<{restricted:true;operationId:string;blocked:boolean;receiptId:string}>{
  this.manager(m);await this.authority.assertVerificationEnabled(m);
  const [x]=await m.query('SELECT o.id FROM public.finance_bank_operations o JOIN public.finance_funding_lots l ON l."receiptId"=o."receiptId" WHERE l.id=$1',[ref(lotId)]);
  if(!x)throw new EvidenceRefusedError('No trusted lot provenance');
  const {op}=await this.operation(m,x.id);
  return {restricted:true,operationId:op.id,blocked:op.state!=='eligible',receiptId:op.receiptId};
 }
 async assertLotEvidenceWithManager(m:EntityManager,lotId:string):Promise<{restricted:true;operationId:string}>{
  const status=await this.inspectLotEvidenceWithManager(m,lotId);
  if(status.blocked)throw new EvidenceRefusedError('Lot bank evidence blocked',status.receiptId);
  return {restricted:true,operationId:status.operationId};
 }
 async historyWithManager(m:EntityManager,principal:string,operationId:string){this.manager(m);await this.actor(m,principal,'history');const id=ref(operationId);return {operation:(await m.query('SELECT id,state,version,"receiptId" FROM public.finance_bank_operations WHERE id=$1',[id]))[0]??null,events:await m.query('SELECT action,"actorId",data,result,"createdAt" FROM public.finance_evidence_events WHERE "operationId"=$1 ORDER BY "createdAt",id',[id])};}
}
