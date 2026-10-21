import { ClassificationCorrectionsService } from './classification-corrections.service';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { EvidenceService } from './evidence.service';
import { evidenceHash } from './evidence-locks';
import { assertPence } from './money';
import { CLASSIFICATION_AUTHORITY, SOURCE_CATEGORIES } from './classification-authority';
import type { ClassificationAuthority, SourceOriginFacts, SourceCategory } from './classification-authority';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ref(x:string):string{if(typeof x!=='string'||!uuid.test(x))throw Error('Invalid classification reference');return x.toLowerCase();}
function key(x:string):string{if(typeof x!=='string'||!/^[A-Za-z0-9:_-]{8,160}$/.test(x))throw Error('Invalid classification key');return x;}
export function canonicalSourceFacts(input:SourceOriginFacts):SourceOriginFacts{
 if(!input||!SOURCE_CATEGORIES.includes(input.category))throw Error('Unsupported source category');
 assertPence(input.offsetPence);assertPence(input.amountPence);if(input.amountPence===0n)throw Error('Classification amount must be positive');
 if(typeof input.sourceNamespace!=='string'||!/^[A-Za-z0-9:_-]{3,60}$/.test(input.sourceNamespace)||typeof input.sourceEventId!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(input.sourceEventId))throw Error('Invalid source identity');
 if(!Array.isArray(input.documentReferences)||input.documentReferences.length<1||input.documentReferences.length>20)throw Error('Source documents required');
 const docs=input.documentReferences.map(ref).sort();if(new Set(docs).size!==docs.length)throw Error('Duplicate source documents');
 return {receiptId:ref(input.receiptId),offsetPence:input.offsetPence,amountPence:input.amountPence,category:input.category,sourceNamespace:input.sourceNamespace,sourceEventId:input.sourceEventId,basisReference:ref(input.basisReference),documentReferences:docs};
}
export interface ClassificationPartInput extends Omit<SourceOriginFacts,'receiptId'> {partId:string;}
export interface ClassifyReceiptCommand {commandKey:string;receiptId:string;contextId:string;parts:readonly ClassificationPartInput[];}
export interface ClassificationResult {
 classificationId:string;receiptId:string;currency:'GBP';classifiedPence:string;unclassifiedPenceAtCreation:string;
 parts:{partId:string;offsetPence:string;amountPence:string;category:SourceCategory}[];
}
export interface CorrectionRequestCommand {commandKey:string;partId:string;contextId:string;reason:string;}
export class ClassificationBlockedError extends Error {readonly code='CLASSIFICATION_EVIDENCE_BLOCKED';constructor(readonly receiptId:string){super('New classification blocked by bank evidence');}}
@Injectable()
export class ClassificationService {
 constructor(private readonly ds:DataSource,private readonly evidence:EvidenceService,@Optional() @Inject(CLASSIFICATION_AUTHORITY) private readonly authority?:ClassificationAuthority,@Optional() private readonly corrections?:ClassificationCorrectionsService){}
 private active(m:EntityManager){const r=m?.queryRunner;if(m?.connection!==this.ds||!r||r.connection!==this.ds||r.manager!==m||!r.isTransactionActive||r.isReleased)throw Error('Active classification transaction manager required');}
 private async actor(m:EntityManager,principal:string,context:string){
  await m.query('SELECT pg_advisory_xact_lock(726405, 0)');if(!this.authority)throw Error('Trusted classify_source authority is not configured');
  const a=await this.authority.authorizeWithManager(m,ref(principal),ref(context));
  if(!a||a.right!=='classify_source'||ref(a.contextId)!==context)throw Error('Trusted classify_source authorization denied');return {principalId:ref(a.principalId),contextId:ref(a.contextId)};
 }
 private async lockReceipt(m:EntityManager,receiptId:string){
  const [r]=await m.query('SELECT r.id,r."amountPence",l.id AS "lotId" FROM public.finance_bank_receipts r JOIN public.finance_funding_lots l ON l."receiptId"=r.id WHERE r.id=$1',[receiptId]);if(!r)throw Error('Unknown confirmed receipt');
  const trust=await this.evidence.inspectLotEvidenceWithManager(m,r.lotId);
  await m.query('SELECT id FROM public.finance_funding_lots WHERE id=$1 FOR UPDATE',[r.lotId]);
  await m.query('SELECT id FROM public.finance_bank_receipts WHERE id=$1 FOR UPDATE',[r.id]);
  return {...r,blocked:trust.blocked};
 }
 async classifyWithManager(m:EntityManager,principal:string,input:ClassifyReceiptCommand):Promise<ClassificationResult&{replay:boolean;blocked:boolean}>{
  this.active(m);const c={commandKey:key(input.commandKey),receiptId:ref(input.receiptId),contextId:ref(input.contextId)};
  if(!Array.isArray(input.parts)||input.parts.length<1||input.parts.length>100)throw Error('Invalid classification parts');
  const parts=input.parts.map(p=>({partId:ref(p.partId),facts:canonicalSourceFacts({...p,receiptId:c.receiptId})})).sort((a,b)=>a.facts.offsetPence<b.facts.offsetPence?-1:a.facts.offsetPence>b.facts.offsetPence?1:a.partId.localeCompare(b.partId));
  if(new Set(parts.map(p=>p.partId)).size!==parts.length)throw Error('Duplicate classified part ID');
  for(let i=1;i<parts.length;i++)if(parts[i-1].facts.offsetPence+parts[i-1].facts.amountPence>parts[i].facts.offsetPence)throw Error('Overlapping requested classification ranges');
  const actor=await this.actor(m,principal,c.contextId),hash=evidenceHash([c.receiptId,actor,parts]);
  const prior=await m.query('SELECT * FROM public.finance_receipt_classifications WHERE "commandKey"=$1',[c.commandKey]);if(prior.length&&prior[0].requestHash!==hash)throw Error('Classification idempotency conflict');
  const receipt=await this.lockReceipt(m,c.receiptId);
  if(prior.length)return {...prior[0].result,replay:true,blocked:receipt.blocked};
  if(receipt.blocked)throw new ClassificationBlockedError(receipt.id);
  const existing=await m.query('SELECT id,"offsetPence","amountPence" FROM public.finance_receipt_classified_parts WHERE "receiptId"=$1 ORDER BY "offsetPence",id',[receipt.id]);
  const total=parts.reduce((n,p)=>n+p.facts.amountPence,0n),used=existing.reduce((n:bigint,p:any)=>n+BigInt(p.amountPence),0n),limit=BigInt(receipt.amountPence);
  if(used+total>limit||parts.some(p=>p.facts.offsetPence+p.facts.amountPence>limit))throw Error('Classification exceeds confirmed receipt');
  for(const p of parts)if(existing.some((x:any)=>x.id===p.partId||(BigInt(x.offsetPence)<p.facts.offsetPence+p.facts.amountPence&&p.facts.offsetPence<BigInt(x.offsetPence)+BigInt(x.amountPence))))throw Error('Receipt pennies already classified');
  const verified=[];
  for(const p of parts){const proof=await this.authority!.verifyOriginWithManager(m,{...p.facts,documentReferences:[...p.facts.documentReferences]});if(!proof||proof.status!=='verified'||!uuid.test(proof.verificationId)||typeof proof.verifierReference!=='string'||!/^[A-Za-z0-9:_-]{3,60}$/.test(proof.verifierReference)||evidenceHash(canonicalSourceFacts(proof))!==evidenceHash(p.facts))throw Error('Source origin proof mismatch');verified.push({verificationId:ref(proof.verificationId),verifierReference:proof.verifierReference});}
  const classificationId=randomUUID();const result:ClassificationResult={classificationId,receiptId:receipt.id,currency:'GBP',classifiedPence:total.toString(),unclassifiedPenceAtCreation:(limit-used-total).toString(),parts:parts.map(p=>({partId:p.partId,offsetPence:p.facts.offsetPence.toString(),amountPence:p.facts.amountPence.toString(),category:p.facts.category}))};
  await m.query('INSERT INTO public.finance_receipt_classifications(id,"commandKey","requestHash","receiptId","actorId","contextId",result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[classificationId,c.commandKey,hash,receipt.id,actor.principalId,actor.contextId,JSON.stringify(result)]);
  for(let i=0;i<parts.length;i++){const p=parts[i],f=p.facts,v=verified[i];await m.query('INSERT INTO public.finance_receipt_classified_parts(id,"classificationId","receiptId",currency,"offsetPence","amountPence",category,"sourceNamespace","sourceEventId","basisReference","documentReferences","verificationId","verifierReference") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid[],$12,$13)',[p.partId,classificationId,receipt.id,'GBP',f.offsetPence.toString(),f.amountPence.toString(),f.category,f.sourceNamespace,f.sourceEventId,f.basisReference,f.documentReferences,v.verificationId,v.verifierReference]);}
  return {...result,replay:false,blocked:false};
 }
 async requestCorrectionWithManager(m:EntityManager,principal:string,input:CorrectionRequestCommand):Promise<{requestId:string;partId:string;reason:string;createdAt:string;status:'requested';replay:boolean}>{
  if(!this.corrections)throw Error('Trusted correction service is not configured; classify_source fallback forbidden');
  return this.corrections.requestCorrectionWithManager(m,principal,input);
 }
}
