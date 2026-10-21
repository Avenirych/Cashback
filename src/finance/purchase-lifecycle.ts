import {createHash,randomUUID} from 'node:crypto';
import type {DataSource,EntityManager} from 'typeorm';
import {assertPence} from './money';
import {selectBonusOrder} from './business-policy';
export interface LifecycleEvidence {
 actor:string; proof:string; source:string; event:string; orderSource:string; orderId:string;
 version:number; kind:'order_update'|'cancellation'|'full_refund'|'partial_refund';
 eligible:boolean; rankPence:bigint|null; metricReference:string|null;
 groupFinal:boolean; finalityReference:string|null;
 refundPence:bigint|null; payoutState:'not_paid'|'paid'|'unknown';
}
export interface LifecycleAuthority {
 /** Verifies authenticated actor, canonical order/version, partner facts and exact
  * evidence. Rank definition/finality cannot be approved by a browser boolean.
  * No production adapter or approved Q13 metric currently exists.
  */
 verify(m:EntityManager,principal:string,reference:string):Promise<LifecycleEvidence>;
}
export class DisabledLifecycleAuthority implements LifecycleAuthority {
 async verify():Promise<never>{throw Error('LIFECYCLE_AUTHORITY_NOT_CONFIGURED');}
}
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** Append-only review orchestration. Never consumes a reservation, reverses a
 * journal, creates a debt or authorizes payout. Unknown Q08/Q13 remain explicit.
 */
export class PurchaseLifecycle {
 constructor(private readonly source:DataSource,private readonly authority:LifecycleAuthority=new DisabledLifecycleAuthority()){}
 async record(m:EntityManager,principal:string,reference:string){
  const r=m?.queryRunner;if(m?.connection!==this.source||!r||r.connection!==this.source||r.manager!==m||r.isReleased||!r.isTransactionActive)throw Error('Active caller transaction required');
  const raw=await this.authority.verify(m,principal,reference);
  const v:LifecycleEvidence={actor:raw.actor,proof:raw.proof,source:raw.source,event:raw.event,orderSource:raw.orderSource,orderId:raw.orderId,version:raw.version,kind:raw.kind,eligible:raw.eligible,rankPence:raw.rankPence,metricReference:raw.metricReference,groupFinal:raw.groupFinal,finalityReference:raw.finalityReference,refundPence:raw.refundPence,payoutState:raw.payoutState};
  for(const value of [v.actor,v.proof,v.source,v.event,v.orderSource,v.orderId])if(typeof value!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(value))throw Error('Verified lifecycle identities required');
  if(!Number.isSafeInteger(v.version)||v.version<1||v.version>2147483647)throw Error('Canonical positive order version required');
  if(!['order_update','cancellation','full_refund','partial_refund'].includes(v.kind)||!['not_paid','paid','unknown'].includes(v.payoutState)||typeof v.eligible!=='boolean'||typeof v.groupFinal!=='boolean')throw Error('Invalid lifecycle facts');
  for(const amount of [v.rankPence,v.refundPence])if(amount!==null)assertPence(amount);
  for(const value of [v.metricReference,v.finalityReference])if(value!==null&&(typeof value!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(value)))throw Error('Invalid policy evidence reference');
  if((v.kind==='full_refund'||v.kind==='partial_refund')&&(v.refundPence===null||v.refundPence===0n))throw Error('Verified positive refund evidence required');
  await m.query('SELECT pg_advisory_xact_lock(726411,hashtext($1))',[v.actor]);
  const orders=await m.query('SELECT o."clickId",c."buyerReference" FROM finance_purchase_orders o JOIN finance_purchase_clicks c ON c.id=o."clickId" WHERE o."sourceNamespace"=$1 AND o."orderId"=$2 FOR UPDATE OF c',[v.orderSource,v.orderId]) as {clickId:string;buyerReference:string}[];
  if(orders.length!==1||orders[0].buyerReference!==v.actor)throw Error('LIFECYCLE_ORDER_OWNER_MISMATCH');
  const click=orders[0].clickId;
  const material=JSON.stringify({...v,rankPence:v.rankPence?.toString()??null,refundPence:v.refundPence?.toString()??null});
  const materialHash=hash(JSON.parse(material));
  const previous=await m.query('SELECT "materialHash" FROM finance_purchase_evidence WHERE source=$1 AND event=$2',[v.source,v.event]);
  if(previous.length&&previous[0].materialHash!==materialHash)throw Error('LIFECYCLE_EVENT_CONFLICT');
  // A canonical version is bound to exactly one source event. Late older versions
  // are retained, but never overwrite a newer cancellation/return observation.
  if(!previous.length)await m.query('INSERT INTO finance_purchase_evidence(source,event,actor,"orderSource","orderId",version,kind,material,"materialHash") VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)',[v.source,v.event,v.actor,v.orderSource,v.orderId,v.version,v.kind,material,materialHash]);
  const latest=await m.query('SELECT DISTINCT ON (o."sourceNamespace",o."orderId") o."sourceNamespace",o."orderId",e.version,e."materialHash",e.material FROM finance_purchase_orders o LEFT JOIN finance_purchase_evidence e ON e."orderSource"=o."sourceNamespace" AND e."orderId"=o."orderId" WHERE o."clickId"=$1 ORDER BY o."sourceNamespace",o."orderId",e.version DESC NULLS LAST',[click]) as {sourceNamespace:string;orderId:string;version:number|null;materialHash:string|null;material:Record<string,unknown>|null}[];
  const complete=latest.every(x=>x.material!==null);
  const facts=latest.map(x=>x.material).filter((x):x is Record<string,unknown>=>!!x);
  const corrections=(await m.query("SELECT 1 FROM finance_purchase_evidence e JOIN finance_purchase_orders o ON o.\"sourceNamespace\"=e.\"orderSource\" AND o.\"orderId\"=e.\"orderId\" WHERE o.\"clickId\"=$1 AND e.kind<>'order_update' LIMIT 1",[click])).length>0;
  const metrics=new Set(facts.map(x=>x.metricReference));
  const metricKnown=complete&&metrics.size===1&&!metrics.has(null)&&facts.every(x=>x.rankPence!==null);
  const final=complete&&facts.every(x=>x.groupFinal===true&&!!x.finalityReference);
  const selected=selectBonusOrder(latest.filter(x=>x.material).map(x=>({id:JSON.stringify([x.sourceNamespace,x.orderId]),eligible:x.material!.eligible===true,comparableCostPence:BigInt(x.material!.rankPence as string??'0')})),{metricApproved:metricKnown,groupFinal:final&&!corrections});
  const result={status:'pending_review',reason:corrections?'REFUND_CANCELLATION_AND_RERANK_POLICY_REQUIRED':selected.status==='blocked'?selected.reason:'BONUS_CAP_AND_RELEASE_POLICY_Q13_REQUIRED',provisionalHighestOrder:selected.status==='ready'?JSON.parse(selected.plan.orderId):null,moneyMovedPence:'0'};
  const snapshotHash=hash(latest.map(x=>[x.sourceNamespace,x.orderId,x.version,x.materialHash]));
  await m.query('INSERT INTO finance_purchase_reviews(id,click,actor,"snapshotHash",result) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(click,"snapshotHash") DO NOTHING',[randomUUID(),click,v.actor,snapshotHash,JSON.stringify(result)]);
  return result;
 }
}
