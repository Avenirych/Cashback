import type {EntityManager} from 'typeorm';
import {applicationWindow,ApplicationWindow,canApply,purchaseCap,BONUS_USE_RULES} from './bonus-use-policy';
import {PolicyContext} from './policy-context';
import {policyPence} from './owner-policy';
import {POLICY_21} from './policy-2026-10-21';
/** Explicit isolated composition only. No AppModule/provider/worker registration. */
export class BonusUseTerms {
 constructor(private readonly c:PolicyContext){if(c.policy!==POLICY_21)throw Error('Policy21 coordination required');}
 private check(m:EntityManager){
  const r=m?.queryRunner;
  if(m?.connection!==this.c.source||!r||r.connection!==this.c.source||r.manager!==m||r.isReleased||!r.isTransactionActive)throw Error('Active caller transaction required');
 }
 async attach(m:EntityManager,lot:string,basis:'receipt'|'transfer',reference:string){
  this.check(m);
  const old=await m.query('SELECT basis,reference FROM finance_bonus_use_terms WHERE lot=$1',[lot]);
  if(old.length){if(old[0].basis!==basis||old[0].reference!==reference)throw Error('Application terms conflict');return;}
  const rows=await m.query(`SELECT c."createdAt">=a.effective AS eligible FROM finance_domain_commands c CROSS JOIN finance_bonus_use_activation a WHERE c.result->>'lotId'=$1 ORDER BY c."createdAt" LIMIT 1`,[lot]);
  if(rows.length!==1)throw Error('Immutable source command required');
  if(rows[0].eligible!==true)return; // Historical replay: no backfill.
  let start:string;
  if(basis==='receipt'){
   const r=await m.query(`SELECT to_char(r."receivedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS t FROM finance_receipt_settlements s JOIN finance_bonus_lots l ON l.id=s.lot JOIN finance_bank_receipts r ON r.id=s.receipt WHERE s.lot=$1 AND r.id=$2 AND l.kind='bonus' AND r."verificationStatus"='verified' AND r.currency='GBP'`,[lot,reference]);
   if(r.length!==1)throw Error('Settled verified bonus receipt required');
   start=r[0].t;
  }else{
   const r=await m.query('SELECT 1 FROM finance_lot_transfers t JOIN finance_bonus_lots l ON l.id=t.child WHERE t.child=$1 AND t.id=$2 AND l.kind=\'bonus\'',[lot,reference]);
   if(r.length!==1)throw Error('Completed lot transfer required');
   start=await this.c.serverReceiptTime(m);
  }
  const terms=applicationWindow(start,basis,reference);
  await m.query('INSERT INTO finance_bonus_use_terms(lot,version,basis,reference,started,until) VALUES($1,$2,$3,$4,$5,$6)',[lot,BONUS_USE_RULES,basis,reference,terms.startedAt,terms.until]);
 }
 async eligibility(m:EntityManager,lots:string[],now:string){
  this.check(m);
  const rows=await m.query(`SELECT lot,version,basis,reference,to_char(started AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "startedAt",to_char(until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS until FROM finance_bonus_use_terms WHERE lot=ANY($1::uuid[])`,[lots]);
  const allowed=new Map<string,boolean>();
  for(const lot of lots){
   const row=rows.find((r:any)=>r.lot===lot);
   if(!row)throw Error('APPLICATION_TERMS_OR_APPROVED_HISTORICAL_TRANSITION_REQUIRED');
   allowed.set(lot,canApply(row as ApplicationWindow,now));
  }
  return allowed;
 }
 async cap(selected:any,cashback:unknown){
  if(cashback===undefined)return {status:'pending_review' as const,reason:'VERIFIED_POSSIBLE_CASHBACK_REQUIRED'};
  const order=selected.rankedOrders.find((r:any)=>r.source===selected.winner[0]&&r.id===selected.winner[1]);
  if(!order)return {status:'pending_review' as const,reason:'VERIFIED_WINNER_VALUE_REQUIRED'};
  return purchaseCap(policyPence(order.value),policyPence(cashback),policyPence(selected.cap));
 }
}
