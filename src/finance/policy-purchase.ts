import {BonusUseTerms} from './bonus-use-terms';
import {BONUS_USE_RULES} from './bonus-use-policy';
import {returnDestinations,recordGiftRecovery,cancelGiftGroup,GiftEvidence} from './policy-gift';
import type {EntityManager} from 'typeorm';
import {randomUUID} from 'node:crypto';
import {fifo,POLICY_21} from './policy-2026-10-21';
import {PolicyContext} from './policy-context';
import {assertPence} from './money';
import {chooseOrder,eligibleValue,OWNER_POLICY,utc,RankedOrder,policyPence} from './owner-policy';
type Observation={orderSource:string;orderId:string;click:string;version:number;messageSource:string;messageId:string;eligible:boolean;placedAt:string|null;amount:string|null;amountReference:string|null;items?:{id:string;kind:'product'|'delivery'|'excluded';eligible:boolean;afterDiscount:string}[];merchantCap:string|null;mandatoryCaps:string[]|null;restrictionsComplete:boolean;terms:string|null;finality:boolean};
export class PolicyPurchase {
 async reserve(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{click:string;amount:string}>(m,principal,'reserve_fifo',reference);
  if(this.c.policy!==POLICY_21)throw Error('FIFO policy approval required');
  return this.c.command(m,actor,key,{action:'reserve_fifo',facts:f,proof,...(this.useTerms?{applicationRules:BONUS_USE_RULES}:{})},async()=>{
   const [click]=await m.query('SELECT "buyerReference" FROM finance_purchase_clicks WHERE id=$1',[f.click]);if(click?.buyerReference!==actor)throw Error('Owned purchase click required');
   let rows=await m.query('SELECT l.*,a."balancePence" AS amount,to_char(l."confirmedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS confirmed FROM finance_bonus_lots l JOIN finance_accounts a ON a.id=l.available WHERE l.owner=$1 AND l.kind=\'bonus\' AND a."balancePence">0 ORDER BY l.id FOR UPDATE OF l,a',[actor]);
   if(this.useTerms){const allowed=await this.useTerms.eligibility(m,rows.map((r:any)=>r.id),await this.c.serverReceiptTime(m));rows=rows.filter((r:any)=>allowed.get(r.id));}
   const amount=policyPence(f.amount);if(!amount)throw Error('Positive reservation required');const plan=fifo<any>(rows,amount);if(plan.status!=='ready')return plan;if(plan.unfunded)return {status:'pending_review',reason:'INSUFFICIENT_ELIGIBLE_BONUS'};
   if((await m.query("SELECT 1 FROM finance_bonus_reservations WHERE click=$1 AND state='active'",[f.click])).length)throw Error('Click already reserved');
   const lines:any[]=[],parts:any[]=[];for(const a of plan.allocations){const id=randomUUID();lines.push({accountId:a.lot.available,side:'debit',amount:a.amount},{accountId:a.lot.reserved,side:'credit',amount:a.amount});parts.push({reservation:id,lot:a.lot.id,amount:a.amount.toString()});await m.query("INSERT INTO finance_bonus_reservations(id,lot,click,amount,state) VALUES($1,$2,$3,$4,'active')",[id,a.lot.id,f.click,a.amount.toString()]);}
   const j=await this.c.post(m,lines);return {status:'reserved',parts,journal:j.journalId,policy:this.c.policy};
  });
 }
 constructor(private readonly c:PolicyContext,private readonly useTerms?:BonusUseTerms){}
 async ingest(m:EntityManager,principal:string,reference:string){
  // Capture server receipt before potentially delayed verification/actor-lock
  // scheduling. Nothing is accepted/persisted until authority verification succeeds.
  const received=await this.c.serverReceiptTime(m);
  const {actor,proof,facts:f}=await this.c.enter<Observation>(m,principal,'order',reference);
  if(!Number.isSafeInteger(f.version)||f.version<1)throw Error('Canonical order version required');
  const [o]=await m.query('SELECT o.*,c."buyerReference" FROM finance_purchase_orders o JOIN finance_purchase_clicks c ON c.id=o."clickId" WHERE o."sourceNamespace"=$1 AND o."orderId"=$2 FOR UPDATE OF c',[f.orderSource,f.orderId]);
  if(!o||o.buyerReference!==actor)throw Error('Order owner mismatch');
  if(o.clickId!==f.click){await this.c.record(m,'attribution_conflict',JSON.stringify([f.orderSource,f.orderId]),f.messageId,{...f,actor,proof});return {status:'pending_review',reason:'ATTRIBUTION_CONFLICT'};}
  const ingestion=await this.c.get(m,'seller_ingestion',f.messageSource,f.messageId);
  await this.c.record(m,'seller_ingestion',f.messageSource,f.messageId,{actor,orderSource:f.orderSource,orderId:f.orderId,version:f.version,proof:ingestion?.payload.proof||proof},undefined,received);
  const value=f.items?eligibleValue(f.items.map(x=>({...x,afterDiscount:policyPence(x.afterDiscount)}))):f.amount!==null&&f.amountReference?policyPence(f.amount):null;
  if(value===null)return {status:'pending_review',reason:'VERIFIED_ELIGIBLE_AMOUNT_REQUIRED'};
  assertPence(value);if(f.placedAt!==null)utc(f.placedAt);if(f.merchantCap!==null)assertPence(policyPence(f.merchantCap));
  let cap=f.merchantCap===null?null:policyPence(f.merchantCap);
  if(f.restrictionsComplete!==true||!Array.isArray(f.mandatoryCaps))cap=null;
  else for(const restriction of f.mandatoryCaps){const n=policyPence(restriction);if(cap!==null&&n<cap)cap=n;}
  const payload={...f,amount:value.toString(),merchantCap:cap?.toString()??null,actor,proof,policy:this.c.policy};
  const prior=await this.c.get(m,'order',f.messageSource,f.messageId);
  if(prior)payload.proof=prior.payload.proof;
  await this.c.record(m,'order',f.messageSource,f.messageId,payload);
  const row=await this.c.get(m,'order',f.messageSource,f.messageId);
  return {status:'recorded',firstIngested:(await this.c.get(m,'seller_ingestion',f.messageSource,f.messageId)).ingested,replay:!!prior};
 }
 async select(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{click:string;complete:boolean;terminalProof:string|null;versions:{source:string;id:string;version:number}[]}>(m,principal,'select',reference);
  return this.c.command(m,actor,key,{action:'select',facts:f,proof},async()=>{
   const [click]=await m.query('SELECT * FROM finance_purchase_clicks WHERE id=$1 FOR UPDATE',[f.click]);if(!click||click.buyerReference!==actor)throw Error('Click owner mismatch');
   if(await this.c.get(m,'bonus_cancel',f.click,'return'))return {status:'pending_review',reason:'CANCELLED_WINNER_NO_AUTOMATIC_REASSIGNMENT'};
   if((await this.c.get(m,'bonus',f.click,'final')))return {status:'pending_review',reason:'BONUS_ALREADY_FINAL_REVIEW_LINKED_CORRECTION_ONLY'};
   const canonical=await m.query('SELECT "sourceNamespace","orderId" FROM finance_purchase_orders WHERE "clickId"=$1',[f.click]);
   if(canonical.length!==f.versions.length||new Set(f.versions.map(v=>JSON.stringify([v.source,v.id]))).size!==canonical.length)return {status:'pending_review',reason:'INCOMPLETE_CANONICAL_GROUP'};
   const orders:RankedOrder[]=[];
   for(const o of canonical){
    const scope=JSON.stringify([o.sourceNamespace,o.orderId]);
    if((await m.query("SELECT 1 FROM finance_policy_records WHERE kind='attribution_conflict' AND scope=$1",[scope])).length)return {status:'pending_review',reason:'ATTRIBUTION_CONFLICT'};
    const [row]=await m.query("SELECT payload,to_char(\"ingestedAt\" AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS ingested FROM finance_policy_records WHERE kind='order' AND payload->>'orderSource'=$1 AND payload->>'orderId'=$2 ORDER BY (payload->>'version')::integer DESC LIMIT 1",[o.sourceNamespace,o.orderId]);
    const version=f.versions.find(v=>v.source===o.sourceNamespace&&v.id===o.orderId);
    if(!row||!version||row.payload.version!==version.version)return {status:'pending_review',reason:'MISSING_OR_STALE_ORDER_VERSION'};
    const p=row.payload;
    // First verified seller-message ingestion for the canonical order, NOT the
    // later revision/replay time. Never copied from partner/client timestamps.
    const [first]=await m.query("SELECT to_char(min(\"ingestedAt\") AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS t FROM finance_policy_records WHERE kind='seller_ingestion' AND payload->>'orderSource'=$1 AND payload->>'orderId'=$2",[o.sourceNamespace,o.orderId]);
    orders.push({source:o.sourceNamespace,id:o.orderId,eligible:p.eligible===true,value:BigInt(p.amount),placedAt:p.placedAt,firstIngested:first.t,merchantCap:p.merchantCap===null?null:BigInt(p.merchantCap),terms:p.terms,finality:p.finality===true});
   }
   const decision=chooseOrder(orders,f.complete===true&&!!f.terminalProof);if(decision.status!=='ready')return decision;
   const result={status:'selected',click:f.click,winner:[decision.winner.source,decision.winner.id],cap:decision.cap.toString(),versions:f.versions,completionProof:f.terminalProof,rankedOrders:orders.map(o=>({...o,value:o.value.toString(),merchantCap:o.merchantCap?.toString()??null})),actor,proof,policy:this.c.policy};
   await this.c.record(m,'selection',f.click,key,result);return result;
  });
 }
 async apply(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{click:string;selection:string;reservation:string;currentVersionsVerified:boolean;possibleCashbackPence?:string}&GiftEvidence>(m,principal,'apply_bonus',reference,f=>this.c.policy===POLICY_21?(f.giftOrigins||[]):[]);
  return this.c.command(m,actor,key,{action:'apply_bonus',facts:f,proof,...(this.useTerms?{applicationRules:BONUS_USE_RULES}:{})},async()=>{
   const selected=await this.c.get(m,'selection',f.click,f.selection);
   if(await this.c.get(m,'bonus_cancel',f.click,'return'))return {status:'pending_review',reason:'CANCELLED_WINNER_NO_AUTOMATIC_REASSIGNMENT'};
   if(!selected||selected.payload.actor!==actor||f.currentVersionsVerified!==true)return {status:'pending_review',reason:'CURRENT_FINAL_SELECTION_REQUIRED'};
   // Independently recheck the canonical group and versions under the actor gate.
   const canonical=await m.query('SELECT "sourceNamespace","orderId" FROM finance_purchase_orders WHERE "clickId"=$1',[f.click]);
   const versions=selected.payload.versions as {source:string;id:string;version:number}[];
   if(canonical.length!==versions.length)return {status:'pending_review',reason:'NEW_ORDER_RESELECT_BEFORE_APPLICATION'};
   for(const v of versions){if((await m.query("SELECT 1 FROM finance_policy_records WHERE kind='attribution_conflict' AND scope=$1",[JSON.stringify([v.source,v.id])])).length)return {status:'pending_review',reason:'ATTRIBUTION_CONFLICT'};const [latest]=await m.query("SELECT max((payload->>'version')::integer) AS v FROM finance_policy_records WHERE kind='order' AND payload->>'orderSource'=$1 AND payload->>'orderId'=$2",[v.source,v.id]);if(latest.v!==v.version)return {status:'pending_review',reason:'NEW_ORDER_VERSION_RESELECT_REQUIRED'};}
   for(const ranked of selected.payload.rankedOrders){const [first]=await m.query("SELECT to_char(min(\"ingestedAt\") AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS t FROM finance_policy_records WHERE kind='seller_ingestion' AND payload->>'orderSource'=$1 AND payload->>'orderId'=$2",[ranked.source,ranked.id]);if(first.t!==ranked.firstIngested)return {status:'pending_review',reason:'SELLER_INGESTION_ORDER_CHANGED_RESELECT_REQUIRED'};}
   if(await this.c.get(m,'bonus',f.click,'final'))return {status:'pending_review',reason:'BONUS_ALREADY_APPLIED'};
   if(this.c.policy!==POLICY_21&&(await m.query('SELECT 1 FROM finance_bonus_reservations r JOIN finance_bonus_lots l ON l.id=r.lot JOIN finance_bonus_lots p ON p.id=l.parent WHERE r.click=$1 AND p.owner<>$2 LIMIT 1',[f.click,actor])).length)return {status:'pending_review',reason:'GIFT_ORIGIN_DEBT_COORDINATION_REQUIRED'};
   let group=await m.query("SELECT r.*,l.owner,l.available,l.reserved,to_char(l.\"confirmedAt\" AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS confirmed FROM finance_bonus_reservations r JOIN finance_bonus_lots l ON l.id=r.lot WHERE r.click=$1 AND r.state='active' ORDER BY r.id FOR UPDATE OF r,l",[f.click]);
   let applicationCap=BigInt(selected.payload.cap),eligible:Map<string,boolean>|null=null;
   if(this.useTerms){
    if(group.some((r:any)=>r.owner!==actor))throw Error('Owned reservation group required');
    const decision=await this.useTerms.cap(selected.payload,f.possibleCashbackPence);
    if(decision.status!=='ready')return decision;
    applicationCap=decision.cap;
    eligible=await this.useTerms.eligibility(m,group.map((r:any)=>r.lot),await this.c.serverReceiptTime(m));
   }
   if(group.length>1){
    if(group.some((r:any)=>r.owner!==actor)||!group.some((r:any)=>r.id===f.reservation))throw Error('Owned attribution-group reservations required');
    const total=group.reduce((n:bigint,r:any)=>n+BigInt(r.amount),0n),cap=applicationCap;
    let chosen:Map<string,bigint>|null=null;
    if(this.c.policy===POLICY_21){const p=fifo<any>(eligible?group.filter((r:any)=>eligible!.get(r.lot)):group,cap<total?cap:total);if(p.status!=='ready')return p;chosen=new Map(p.allocations.map(a=>[a.lot.id,a.amount]));}
    else if(cap>0n&&cap<total)return {status:'pending_review',reason:'PARTIAL_MULTI_LOT_BONUS_SOURCE_PRIORITY_REQUIRED'};
    const parts:any[]=[],lines:any[]=[],releaseRecords:any[]=[],claimed=new Map<string,bigint>();
    for(const r of group){const amount=BigInt(r.amount),used=chosen?(chosen.get(r.id)||0n):(cap===0n?0n:amount),consumed=await this.c.account(m,'policy:bonus:'+f.click+':'+r.lot,actor,'reserved','credit');lines.push({accountId:r.reserved,side:'debit',amount});if(used)lines.push({accountId:consumed,side:'credit',amount:used});if(amount>used){if(this.c.policy===POLICY_21){const dest=await returnDestinations(m,actor,f,r.lot,amount-used,claimed);if(dest.status!=='ready')return dest;lines.push(...dest.lines);releaseRecords.push({lot:r.lot,source:r.reserved,items:dest.recoveries});}else lines.push({accountId:r.available,side:'credit',amount:amount-used});}parts.push({reservation:r.id,lot:r.lot,used:used.toString(),available:r.available,consumed});}
    const j=await this.c.post(m,lines);for(const r of releaseRecords)await recordGiftRecovery(m,j.journalId,r.lot,r.source,r.items);for(const r of group)await m.query("UPDATE finance_bonus_reservations SET state='consumed' WHERE id=$1",[r.id]);
    const used=chosen?[...chosen.values()].reduce((n,x)=>n+x,0n):(cap===0n?0n:total);const result={status:'applied',actor,proof,policy:this.c.policy,selection:f.selection,reservation:f.reservation,winner:selected.payload.winner,used:used.toString(),excess:(total-used).toString(),parts,journal:j.journalId};await this.c.record(m,'bonus',f.click,'final',result,j.journalId);return result;
   }
   const [r]=await m.query('SELECT r.*,l.owner,l.available,l.reserved FROM finance_bonus_reservations r JOIN finance_bonus_lots l ON l.id=r.lot WHERE r.id=$1 FOR UPDATE OF r,l',[f.reservation]);
   if(!r||r.owner!==actor||r.click!==f.click||r.state!=='active')throw Error('Active owned reservation required');
   const amount=BigInt(r.amount),cap=applicationCap,used=eligible&&!eligible.get(r.lot)?0n:(amount<cap?amount:cap),excess=amount-used;
   const consumed=await this.c.account(m,'policy:bonus:'+f.click,actor,'reserved','credit');
   const lines=[{accountId:r.reserved,side:'debit' as const,amount},...(used?[{accountId:consumed,side:'credit' as const,amount:used}]:[]),...(excess?[{accountId:r.available,side:'credit' as const,amount:excess}]:[])];
   let release:any=null;if(this.c.policy===POLICY_21&&excess){release=await returnDestinations(m,actor,f,r.lot,excess,new Map());if(release.status!=='ready')return release;lines.splice(lines.length-1,1,...release.lines);}
   const journal=await this.c.post(m,lines);await m.query("UPDATE finance_bonus_reservations SET state='consumed' WHERE id=$1",[r.id]);
   if(release)await recordGiftRecovery(m,journal.journalId,r.lot,r.reserved,release.recoveries);
   const result={status:'applied',actor,proof,policy:this.c.policy,selection:f.selection,reservation:r.id,lot:r.lot,winner:selected.payload.winner,used:used.toString(),excess:excess.toString(),available:r.available,consumed,journal:journal.journalId};
   await this.c.record(m,'bonus',f.click,'final',result,journal.journalId);return result;
  });
 }
 async cancel(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{click:string;selection:string;cancelledOrder:[string,string];cancellationVerified:boolean;reservation:string}&GiftEvidence>(m,principal,'cancel_winner',reference,f=>this.c.policy===POLICY_21?(f.giftOrigins||[]):[]);
  return this.c.command(m,actor,key,{action:'cancel_winner',facts:f,proof},async()=>{
   const selection=await this.c.get(m,'selection',f.click,f.selection);
   if(!selection||selection.payload.actor!==actor||JSON.stringify(selection.payload.winner)!==JSON.stringify(f.cancelledOrder)||f.cancellationVerified!==true)return {status:'pending_review',reason:'VERIFIED_SELECTED_WINNER_CANCELLATION_REQUIRED'};
   if(await this.c.get(m,'bonus_cancel',f.click,'return'))return {status:'already_returned'};
   if(this.c.policy!==POLICY_21&&(await m.query('SELECT 1 FROM finance_bonus_reservations r JOIN finance_bonus_lots l ON l.id=r.lot JOIN finance_bonus_lots p ON p.id=l.parent WHERE r.click=$1 AND p.owner<>$2 LIMIT 1',[f.click,actor])).length)return {status:'pending_review',reason:'GIFT_ORIGIN_DEBT_COORDINATION_REQUIRED'};
   if(this.c.policy===POLICY_21)return cancelGiftGroup(this.c,m,actor,f,proof);
   const bonus=await this.c.get(m,'bonus',f.click,'final');let journal,returned;
   if(bonus&&bonus.payload.parts){const b=bonus.payload;if(b.actor!==actor||b.reservation!==f.reservation||JSON.stringify(b.winner)!==JSON.stringify(f.cancelledOrder))throw Error('Applied group winner mismatch');const lines:any[]=[];returned=0n;
    for(const part of b.parts){const [a]=await m.query('SELECT "balancePence" FROM finance_accounts WHERE id=$1 FOR UPDATE',[part.consumed]);const n=BigInt(part.used);if(BigInt(a.balancePence)!==n)return {status:'pending_review',reason:'SPENT_BONUS_REVERSAL_RECONCILIATION_REQUIRED'};if(n){lines.push({accountId:part.consumed,side:'debit',amount:n},{accountId:part.available,side:'credit',amount:n});returned+=n;}}
    if(returned)journal=await this.c.post(m,lines);
   }else if(bonus){const b=bonus.payload;if(b.actor!==actor||b.reservation!==f.reservation||JSON.stringify(b.winner)!==JSON.stringify(f.cancelledOrder))throw Error('Applied winner mismatch');
    const [a]=await m.query('SELECT "balancePence" FROM finance_accounts WHERE id=$1 FOR UPDATE',[b.consumed]);returned=BigInt(b.used);
    if(BigInt(a.balancePence)!==returned)return {status:'pending_review',reason:'SPENT_BONUS_REVERSAL_RECONCILIATION_REQUIRED'};
    if(returned)journal=await this.c.post(m,[{accountId:b.consumed,side:'debit',amount:returned},{accountId:b.available,side:'credit',amount:returned}]);
   }else{const group=await m.query("SELECT r.*,l.owner,l.available,l.reserved FROM finance_bonus_reservations r JOIN finance_bonus_lots l ON l.id=r.lot WHERE r.click=$1 AND r.state='active' FOR UPDATE OF r,l",[f.click]);if(!group.length||!group.some((r:any)=>r.id===f.reservation)||group.some((r:any)=>r.owner!==actor))throw Error('Owned active group reservations required');returned=0n;const lines:any[]=[];for(const r of group){const n=BigInt(r.amount);returned+=n;lines.push({accountId:r.reserved,side:'debit',amount:n},{accountId:r.available,side:'credit',amount:n});}journal=await this.c.post(m,lines);for(const r of group)await m.query("UPDATE finance_bonus_reservations SET state='released' WHERE id=$1",[r.id]);}
   const result={status:'returned',returned:returned.toString(),originalJournal:bonus?.journal||null,journal:journal?.journalId||null,actor,proof,policy:this.c.policy};await this.c.record(m,'bonus_cancel',f.click,'return',result,journal?.journalId);return result;
  });
 }
}
