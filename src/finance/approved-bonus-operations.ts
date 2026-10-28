import type {EntityManager} from 'typeorm';
import {LotOperations,LotCommand} from './lot-operations';
import {ReceiptSettlement} from './receipt-settlement';
import {PolicyContext} from './policy-context';
import {PolicyPurchase} from './policy-purchase';
import {PolicyPayout} from './policy-payout';
import {BonusUseTerms} from './bonus-use-terms';
import {POLICY_21} from './policy-2026-10-21';
/** Explicit, isolated composition. Never imported by AppModule.
 * Caller MUST commit/rollback the entire active transaction; no public facts adapter. */
export class ApprovedBonusOperations {
 readonly terms:BonusUseTerms;
 readonly purchase:PolicyPurchase;
 readonly payout:PolicyPayout;
 constructor(private readonly c:PolicyContext,private readonly receipts:ReceiptSettlement,private readonly lots:LotOperations){
  if(c.policy!==POLICY_21)throw Error('Existing policy21 debt/FIFO behavior required');
  this.terms=new BonusUseTerms(c);this.purchase=new PolicyPurchase(c,this.terms);
  this.payout=new PolicyPayout(c); // Application-window expiry NEVER removes payout liability.
 }
 private async prepare(m:EntityManager){
  await this.c.serverReceiptTime(m);
  await m.query('SELECT pg_advisory_xact_lock(726405,0)');
  await m.query('SELECT effective FROM finance_bonus_use_activation');
 }
 async settle(m:EntityManager,principal:string,reference:string){
  await this.prepare(m);
  const result=await this.receipts.execute(m,principal,reference);
  if(result.status==='completed'&&result.lotId){
   const [lot]=await m.query('SELECT kind FROM finance_bonus_lots WHERE id=$1',[result.lotId]);
   if(lot?.kind==='bonus'){
    const [settled]=await m.query('SELECT receipt FROM finance_receipt_settlements WHERE lot=$1',[result.lotId]);
    if(!settled)throw Error('Verified settlement required');
    await this.terms.attach(m,result.lotId,'receipt',settled.receipt);
   }
  }
  return result;
 }
 async transfer(m:EntityManager,principal:string,key:string,command:Extract<LotCommand,{action:'transfer'}>){
  await this.prepare(m);
  const result=await this.lots.execute(m,principal,key,command);
  if(result.status==='completed'&&result.lotId){
   const [transfer]=await m.query('SELECT id FROM finance_lot_transfers WHERE child=$1',[result.lotId]);
   if(!transfer)throw Error('Completed transfer history required');
   await this.terms.attach(m,result.lotId,'transfer',transfer.id);
  }
  return result;
 }
}
