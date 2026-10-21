import { Injectable, Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { COVERAGE_MANDATE_PROVIDER } from './coverage-mandate';
import type { CoverageMandateProvider, SyntheticCoverageMandate } from './coverage-mandate';
import { EvidenceService } from './evidence.service';
import { evidenceHash, lockEvidenceScope } from './evidence-locks';
import { assertPence } from './money';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ref(x:string):string{if(typeof x!=='string'||!uuid.test(x))throw Error('Invalid coverage reference');return x.toLowerCase();}
function key(x:string):string{if(typeof x!=='string'||!/^[A-Za-z0-9:_-]{8,160}$/.test(x))throw Error('Invalid coverage command key');return x;}
function positive(x:bigint):bigint{assertPence(x);if(x===0n)throw Error('Coverage amount must be positive');return x;}
export interface SyntheticTargetCommand {commandKey:string;targetId:string;mandateId:string;contextId:string;currency:'GBP';amountPence:bigint;}
export interface ReserveCoverageCommand {commandKey:string;targetId:string;mandateId:string;contextId:string;allocations:readonly {lotId:string;amountPence:bigint}[];}
export interface HistoricalCoverageResult {reservationId:string;targetId:string;mandateId:string;currency:'GBP';amountPence:string;allocationIds:string[];purpose:'synthetic_test_coverage';}
export class CoverageBlockedError extends Error {readonly code='COVERAGE_EVIDENCE_BLOCKED';constructor(readonly reservationId:string){super('Coverage is historically reserved but blocked for further use');}}
@Injectable()
export class CoverageService {
 constructor(private readonly ds:DataSource,private readonly evidence:EvidenceService,@Optional() @Inject(COVERAGE_MANDATE_PROVIDER) private readonly provider?:CoverageMandateProvider){}
 private active(m:EntityManager){const r=m?.queryRunner;if(m?.connection!==this.ds||!r||r.connection!==this.ds||r.manager!==m||!r.isTransactionActive||r.isReleased)throw Error('Active coverage transaction manager required');}
 private async grant(m:EntityManager,principal:string,mandate:string,context:string):Promise<SyntheticCoverageMandate>{
  await m.query('SELECT pg_advisory_xact_lock(726405, 0)');
  if(!this.provider)throw Error('Trusted synthetic coverage mandate provider is not configured');
  const g=await this.provider.verifyWithManager(m,ref(principal),ref(mandate),ref(context));
  if(!g||g.purpose!=='synthetic_test_coverage'||g.currency!=='GBP'||ref(g.id)!==mandate||ref(g.contextId)!==context||!Array.isArray(g.allowedLotIds)||g.allowedLotIds.length<1||g.allowedLotIds.length>100)throw Error('Invalid trusted synthetic mandate');
  const lots=g.allowedLotIds.map(ref).sort();if(new Set(lots).size!==lots.length)throw Error('Duplicate mandate lot');
  return {id:ref(g.id),principalId:ref(g.principalId),contextId:ref(g.contextId),purpose:'synthetic_test_coverage',currency:'GBP',limitPence:positive(g.limitPence),allowedLotIds:lots};
 }
 private async lockGrant(m:EntityManager,g:SyntheticCoverageMandate):Promise<void>{
  await m.query('INSERT INTO public.finance_coverage_mandates(id,"principalId","contextId",purpose,currency,"limitPence","allowedLotIds") VALUES($1,$2,$3,$4,$5,$6,$7::uuid[]) ON CONFLICT(id) DO NOTHING',[g.id,g.principalId,g.contextId,g.purpose,g.currency,g.limitPence.toString(),g.allowedLotIds]);
  const [stored]=await m.query('SELECT * FROM public.finance_coverage_mandates WHERE id=$1 FOR UPDATE',[g.id]);
  if(!stored||stored.principalId!==g.principalId||stored.contextId!==g.contextId||stored.purpose!==g.purpose||stored.currency!==g.currency||stored.limitPence!==g.limitPence.toString()||JSON.stringify(stored.allowedLotIds)!==JSON.stringify(g.allowedLotIds))throw Error('Trusted mandate material conflict');
 }
 async createTargetWithManager(m:EntityManager,principal:string,input:SyntheticTargetCommand):Promise<{targetId:string;state:'created'|'reserved';replay:boolean}>{
  this.active(m);const c={commandKey:key(input.commandKey),targetId:ref(input.targetId),mandateId:ref(input.mandateId),contextId:ref(input.contextId),currency:input.currency,amountPence:positive(input.amountPence)};
  if(c.currency!=='GBP')throw Error('Synthetic target must use GBP');
  const g=await this.grant(m,principal,c.mandateId,c.contextId);await this.lockGrant(m,g);const hash=evidenceHash([c.targetId,g.principalId,c.mandateId,c.contextId,c.currency,c.amountPence]);
  const rows=await m.query('SELECT * FROM public.finance_coverage_targets WHERE id=$1 OR "creationKey"=$2 FOR UPDATE',[c.targetId,c.commandKey]);
  if(rows.length){const t=rows[0];if(rows.length!==1||t.id!==c.targetId||t.creationKey!==c.commandKey||t.creationHash!==hash)throw Error('Synthetic target creation conflict');return {targetId:t.id,state:t.state,replay:true};}
  await m.query('INSERT INTO public.finance_coverage_targets(id,"contextId","creatorId","creationMandateId",kind,currency,"amountPence",state,"creationKey","creationHash") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[c.targetId,c.contextId,g.principalId,g.id,'synthetic_test_coverage','GBP',c.amountPence.toString(),'created',c.commandKey,hash]);return {targetId:c.targetId,state:'created',replay:false};
 }
 /** Prelock ALL scopes before ANY identity. Never call per-lot guard on an uncollected multi-scope set. */
 private async prelock(m:EntityManager,lotIds:readonly string[]):Promise<boolean>{
  const rows=await m.query('SELECT l.id,o.id AS "operationId",o.identity,o."accountScope" FROM public.finance_funding_lots l JOIN public.finance_bank_operations o ON o."receiptId"=l."receiptId" WHERE l.id=ANY($1::uuid[]) ORDER BY l.id',[lotIds]);
  if(rows.length!==lotIds.length)throw Error('Untrusted or unknown funding lot');
  for(const scope of [...new Set<string>(rows.map((x:any)=>x.accountScope))].sort())await lockEvidenceScope(m,scope);
  for(const identity of [...new Set<string>(rows.map((x:any)=>x.identity))].sort())await m.query('SELECT pg_advisory_xact_lock(726403, hashtext($1))',[identity]);
  await m.query('SELECT id FROM public.finance_bank_operations WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set(rows.map((x:any)=>x.operationId))].sort()]);
  let blocked=false;for(const id of lotIds){const s=await this.evidence.inspectLotEvidenceWithManager(m,id);blocked=blocked||s.blocked;}return blocked;
 }
 async reserveWithManager(m:EntityManager,principal:string,input:ReserveCoverageCommand):Promise<HistoricalCoverageResult&{replay:boolean;blocked:boolean}>{
  this.active(m);const c={commandKey:key(input.commandKey),targetId:ref(input.targetId),mandateId:ref(input.mandateId),contextId:ref(input.contextId)};
  if(!Array.isArray(input.allocations)||input.allocations.length<1||input.allocations.length>100)throw Error('Invalid coverage allocation list');
  const fragments=input.allocations.map(x=>({lotId:ref(x.lotId),amountPence:positive(x.amountPence)})).sort((a,b)=>a.lotId.localeCompare(b.lotId));
  if(new Set(fragments.map(x=>x.lotId)).size!==fragments.length)throw Error('Duplicate coverage lot');
  const g=await this.grant(m,principal,c.mandateId,c.contextId);
  if(fragments.some(x=>!g.allowedLotIds.includes(x.lotId)))throw Error('Lot outside synthetic mandate');
  const hash=evidenceHash([c.targetId,g.id,g.principalId,c.contextId,fragments]);
  const prior=await m.query('SELECT * FROM public.finance_coverage_reservations WHERE "commandKey"=$1',[c.commandKey]);
  if(prior.length&&prior[0].requestHash!==hash)throw Error('Coverage idempotency conflict');
  const blocked=await this.prelock(m,fragments.map(x=>x.lotId));
  const lots=await m.query('SELECT * FROM public.finance_funding_lots WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[fragments.map(x=>x.lotId)]);
  await this.lockGrant(m,g);
  const [target]=await m.query('SELECT * FROM public.finance_coverage_targets WHERE id=$1 FOR UPDATE',[c.targetId]);
  if(!target||target.contextId!==g.contextId||target.creatorId!==g.principalId||target.currency!=='GBP'||target.kind!=='synthetic_test_coverage')throw Error('Target outside trusted synthetic context');
  if(prior.length)return {...prior[0].result,replay:true,blocked};
  if(target.state!=='created')throw Error('Synthetic target already reserved by another command');
  if(blocked)throw new CoverageBlockedError('uncommitted');
  const total=fragments.reduce((a,x)=>a+x.amountPence,0n);if(total!==BigInt(target.amountPence))throw Error('Full coverage must equal target exactly');
  const coordinated=!!(await m.query("SELECT to_regclass('public.finance_coverage_releases') AS present"))[0]?.present;
  const [used]=await m.query(coordinated?'SELECT COALESCE(sum(finance_active_coverage(a.id)),0)::text AS used FROM public.finance_coverage_allocations a JOIN public.finance_coverage_reservations r ON r.id=a."reservationId" WHERE r."mandateId"=$1':'SELECT COALESCE(sum(a."amountPence"),0)::text AS used FROM public.finance_coverage_allocations a JOIN public.finance_coverage_reservations r ON r.id=a."reservationId" WHERE r."mandateId"=$1',[g.id]);
  if(BigInt(used.used)+total>g.limitPence)throw Error('Synthetic mandate limit exceeded');
  for(const f of fragments){const lot=lots.find((x:any)=>x.id===f.lotId);if(!lot||lot.status!=='restricted'||lot.currency!=='GBP')throw Error('Unsupported funding lot');const [n]=await m.query(coordinated?'SELECT (COALESCE((SELECT sum(finance_active_coverage(id)) FROM finance_coverage_allocations WHERE "lotId"=$1),0)+COALESCE((SELECT sum(r.amount) FROM finance_receipt_repayments r JOIN finance_funding_lots l ON l."receiptId"=r.receipt WHERE l.id=$1),0))::text AS used':'SELECT COALESCE(sum("amountPence"),0)::text AS used FROM public.finance_coverage_allocations WHERE "lotId"=$1',[f.lotId]);if(BigInt(n.used)+f.amountPence>BigInt(lot.amountPence))throw Error('Insufficient lot coverage capacity');}
  const reservationId=randomUUID(),allocations=fragments.map(x=>({...x,id:randomUUID()}));
  const result:HistoricalCoverageResult={reservationId,targetId:target.id,mandateId:g.id,currency:'GBP',amountPence:target.amountPence,allocationIds:allocations.map(x=>x.id),purpose:'synthetic_test_coverage'};
  await m.query('INSERT INTO public.finance_coverage_reservations(id,"commandKey","requestHash","targetId","mandateId",result) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[reservationId,c.commandKey,hash,target.id,g.id,JSON.stringify(result)]);
  for(const a of allocations)await m.query('INSERT INTO public.finance_coverage_allocations(id,"reservationId","lotId","amountPence",currency,state) VALUES($1,$2,$3,$4,$5,$6)',[a.id,reservationId,a.lotId,a.amountPence.toString(),'GBP','held']);
  await m.query('UPDATE public.finance_coverage_targets SET state=$1 WHERE id=$2',['reserved',target.id]);
  return {...result,replay:false,blocked:false};
 }
 /** Future trust/mandate gate only. Not a permission to spend, release, pay or reclassify. */
 async assertReservationUsableWithManager(m:EntityManager,principal:string,reservationId:string,contextId:string):Promise<{restricted:true}>{
  this.active(m);await m.query('SELECT pg_advisory_xact_lock(726405, 0)');const [r]=await m.query('SELECT * FROM public.finance_coverage_reservations WHERE id=$1',[ref(reservationId)]);if(!r)throw Error('Unknown synthetic reservation');
  const g=await this.grant(m,principal,r.mandateId,ref(contextId));const rows=await m.query('SELECT "lotId" FROM public.finance_coverage_allocations WHERE "reservationId"=$1 ORDER BY "lotId"',[r.id]);
  if(rows.some((x:any)=>!g.allowedLotIds.includes(x.lotId)))throw Error('Lot outside synthetic mandate');const blocked=await this.prelock(m,rows.map((x:any)=>x.lotId));await this.lockGrant(m,g);if(blocked)throw new CoverageBlockedError(r.id);return {restricted:true};
 }
}
