import {createHash,randomUUID} from 'node:crypto';
import type {DataSource,EntityManager} from 'typeorm';
import {FinanceService} from './finance.service';
import {assertPence} from './money';
import type {Posting} from './ledger';
export type LotCommand =
 | {action:'reserve';lot:string;click:string;amount:bigint}
 | {action:'move';reservation:string;click:string}
 | {action:'release';reservation:string}
 | {action:'transfer';lot:string;recipient:string;amount:bigint}
 | {action:'recover_linked';lot:string;recipient:string;debtor:string;debt:string;amount:bigint}
 | {action:'refund_review';source:string;refund:string;orderSource:string;orderId:string;kind:'full'|'partial'}
 | {action:'collect'};
export interface LotApproval {actor:string;proof:string;verifiedFailedClick?:string;verifiedOriginDebt?:string}
export interface LotAuthority {
 /** Must authenticate principal and authorize exact command in this transaction.
  * Receipt/ownership/eligibility decisions cannot originate in a public body.
  */
 authorize(manager:EntityManager,principal:string,command:Readonly<LotCommand>):Promise<LotApproval>;
}
export class DisabledLotAuthority implements LotAuthority {
 async authorize():Promise<never>{throw new Error('LOT_AUTHORITY_NOT_CONFIGURED');}
}
type Lot={id:string;owner:string;origin:string;responsible:string;confirmedAt:Date;kind:'bonus'|'withdrawal_gbp';parent:string|null;available:string;reserved:string};
export type LotResult={status:'completed'|'pending_review';amountPence:string;reason?:string;reservationId?:string;lotId?:string;journalId?:string};
/** Internal-only transactional operations. No controllers, TTL, seed or live caller.
 * Success is provisional until the caller commits; any error must roll back ALL work.
 */
export class LotOperations {
 constructor(private readonly source:DataSource,private readonly ledger:FinanceService,private readonly authority:LotAuthority=new DisabledLotAuthority()){}
 async execute(manager:EntityManager,principal:string,key:string,input:LotCommand):Promise<LotResult>{
  const r=manager?.queryRunner;
  if(manager?.connection!==this.source||!r||r.connection!==this.source||r.manager!==manager||r.isReleased||!r.isTransactionActive)throw new Error('Active caller transaction required');
  if(!/^[A-Za-z0-9:_-]{8,160}$/.test(key))throw new Error('Stable command key required');
  const command={...input} as LotCommand;
  if('amount' in command){assertPence(command.amount);if(command.amount<1n)throw new Error('Minimum one penny');}
  const approval={...(await this.authority.authorize(manager,principal,Object.freeze({...command})))};
  if(!approval.actor||!approval.proof)throw new Error('Verified actor and evidence required');
  const actors=[...new Set([approval.actor,...(command.action==='transfer'||command.action==='recover_linked'?[command.recipient]:[])])].sort();
  for(const actor of actors)await manager.query('SELECT pg_advisory_xact_lock(726411,hashtext($1))',[actor]);
  const material=JSON.stringify(command,(_k,v:unknown)=>typeof v==='bigint'?v.toString():v);
  const hash=createHash('sha256').update(material).digest('hex');
  const prior=await manager.query('SELECT "requestHash",result FROM public.finance_domain_commands WHERE actor=$1 AND key=$2',[approval.actor,key]) as {requestHash:string;result:LotResult}[];
  if(prior.length){if(prior[0].requestHash!==hash)throw new Error('DOMAIN_IDEMPOTENCY_CONFLICT');return prior[0].result;}
  const commandId=randomUUID();const event='lot:'+commandId;
  const post=async(lines:Posting[])=>this.ledger.postWithManager(manager,event,lines);
  let result:LotResult;
  if(command.action==='recover_linked'){
   if(approval.actor!==command.debtor||command.recipient===command.debtor||approval.verifiedOriginDebt!==command.debt)throw new Error('VERIFIED_ORIGIN_OBLIGATION_REQUIRED');
   const lot=await this.ownedLot(manager,command.lot,command.recipient);
   const debts=await manager.query('SELECT d.*,a."balancePence" FROM public.finance_verified_debts d JOIN public.finance_accounts a ON a.id=d.account WHERE d.id=$1 FOR UPDATE OF a',[command.debt]) as {debtor:string;origin:string;account:string;cap:string;balancePence:string}[];
   const debt=debts[0];
   if(!debt||!lot.parent||lot.responsible!==command.debtor||lot.origin!==debt.origin||debt.debtor!==command.debtor||BigInt(debt.balancePence)>BigInt(debt.cap)||command.amount>BigInt(debt.balancePence))throw new Error('LINKED_RECOVERY_NOT_ELIGIBLE');
   const journal=await post([{accountId:lot.available,side:'debit',amount:command.amount},{accountId:debt.account,side:'credit',amount:command.amount}]);
   result={status:'completed',amountPence:command.amount.toString(),journalId:journal.journalId};
  }else if(command.action==='refund_review'){
   const orders=await manager.query('SELECT c."buyerReference" FROM public.finance_purchase_orders o JOIN public.finance_purchase_clicks c ON c.id=o."clickId" WHERE o."sourceNamespace"=$1 AND o."orderId"=$2 FOR UPDATE OF o,c',[command.orderSource,command.orderId]) as {buyerReference:string}[];
   if(orders.length!==1||orders[0].buyerReference!==approval.actor)throw new Error('REFUND_ORDER_OWNER_MISMATCH');
   await manager.query('INSERT INTO public.finance_refund_reviews(id,source,refund,"orderSource","orderId",actor,kind,state,proof) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(source,refund) DO NOTHING',[randomUUID(),command.source,command.refund,command.orderSource,command.orderId,approval.actor,command.kind,'pending_review',approval.proof]);
   const reviews=await manager.query('SELECT * FROM public.finance_refund_reviews WHERE source=$1 AND refund=$2 FOR UPDATE',[command.source,command.refund]) as {orderSource:string;orderId:string;actor:string;kind:string}[];
   if(reviews.length!==1||reviews[0].orderSource!==command.orderSource||reviews[0].orderId!==command.orderId||reviews[0].actor!==approval.actor||reviews[0].kind!==command.kind)throw new Error('REFUND_IDENTITY_CONFLICT');
   result={status:'pending_review',amountPence:'0',reason:'REFUND_LIABILITY_AND_ALLOCATION_POLICY_REQUIRED'};
  }else if(command.action==='collect')result=await this.collect(manager,approval.actor,post);
  else if(command.action==='reserve'){
   const lot=await this.ownedLot(manager,command.lot,approval.actor);if(lot.kind!=='bonus')throw new Error('Withdrawal GBP cannot fund purchases');
   await this.click(manager,command.click,approval.actor);
   const exists=await manager.query('SELECT id FROM public.finance_bonus_reservations WHERE lot=$1 AND click=$2 AND state=$3',[lot.id,command.click,'active']);
   if(exists.length)throw new Error('RESERVATION_ALREADY_EXISTS');
   const id=randomUUID();const journal=await post([{accountId:lot.available,side:'debit',amount:command.amount},{accountId:lot.reserved,side:'credit',amount:command.amount}]);
   await manager.query('INSERT INTO public.finance_bonus_reservations(id,lot,click,amount,state) VALUES($1,$2,$3,$4,$5)',[id,lot.id,command.click,command.amount.toString(),'active']);
   result={status:'completed',amountPence:command.amount.toString(),reservationId:id,journalId:journal.journalId};
  }else if(command.action==='move'||command.action==='release'){
   const rows=await manager.query('SELECT * FROM public.finance_bonus_reservations WHERE id=$1 FOR UPDATE',[command.reservation]) as {id:string;lot:string;click:string;amount:string;state:string}[];
   if(rows.length!==1)throw new Error('Unknown reservation');const reservation=rows[0];const lot=await this.ownedLot(manager,reservation.lot,approval.actor);
   if(reservation.state!=='active')throw new Error('Reservation is not active');
   if(command.action==='move'){
    await this.click(manager,command.click,approval.actor);
    await manager.query('UPDATE public.finance_bonus_reservations SET click=$1 WHERE id=$2',[command.click,reservation.id]);
    result={status:'completed',amountPence:reservation.amount,reservationId:reservation.id};
   }else if(approval.verifiedFailedClick!==reservation.click)result={status:'pending_review',amountPence:'0',reason:'VERIFIED_UNUSED_PURCHASE_FAILURE_REQUIRED'};
   else{
    const amount=BigInt(reservation.amount);const journal=await post([{accountId:lot.reserved,side:'debit',amount},{accountId:lot.available,side:'credit',amount}]);
    await manager.query('UPDATE public.finance_bonus_reservations SET state=$1 WHERE id=$2',['released',reservation.id]);
    result={status:'completed',amountPence:reservation.amount,reservationId:reservation.id,journalId:journal.journalId};
   }
  }else{
   const lot=await this.ownedLot(manager,command.lot,approval.actor);
   if(lot.kind!=='bonus'||command.recipient===approval.actor)throw new Error('Invalid bonus transfer');
   if((await this.debts(manager,command.recipient)).length)result={status:'pending_review',amountPence:'0',reason:'RECIPIENT_DEBT_SETTLEMENT_REQUIRED'};
   else{
    const child=randomUUID(),available=randomUUID(),reserved=randomUUID();
    await this.account(manager,available,command.recipient,'bonus_liability');await this.account(manager,reserved,command.recipient,'reserved');
    await manager.query('INSERT INTO public.finance_bonus_lots(id,owner,origin,responsible,"confirmedAt",kind,parent,available,reserved) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[child,command.recipient,lot.origin,lot.responsible,lot.confirmedAt,lot.kind,lot.id,available,reserved]);
    const journal=await post([{accountId:lot.available,side:'debit',amount:command.amount},{accountId:available,side:'credit',amount:command.amount}]);
    await manager.query('INSERT INTO public.finance_lot_transfers(id,parent,child,amount,command) VALUES($1,$2,$3,$4,$5)',[randomUUID(),lot.id,child,command.amount.toString(),commandId]);
    result={status:'completed',amountPence:command.amount.toString(),lotId:child,journalId:journal.journalId};
   }
  }
  await manager.query('INSERT INTO public.finance_domain_commands(id,actor,key,"requestHash",action,proof,command,result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)',[commandId,approval.actor,key,hash,command.action,approval.proof,material,JSON.stringify(result)]);
  return result;
 }
 private async ownedLot(m:EntityManager,id:string,actor:string):Promise<Lot>{const rows=await m.query('SELECT * FROM public.finance_bonus_lots WHERE id=$1 FOR UPDATE',[id]) as Lot[];if(rows.length!==1||rows[0].owner!==actor)throw new Error('LOT_OWNER_MISMATCH');return rows[0];}
 private async click(m:EntityManager,id:string,actor:string){const rows=await m.query('SELECT "buyerReference" FROM public.finance_purchase_clicks WHERE id=$1 FOR UPDATE',[id]) as {buyerReference:string}[];if(rows.length!==1||rows[0].buyerReference!==actor)throw new Error('CLICK_OWNER_MISMATCH');}
 private async account(m:EntityManager,id:string,owner:string,kind:string){await m.query('INSERT INTO public.finance_accounts(id,"accountKey",kind,"ownerReference",currency,"normalSide",nonnegative) VALUES($1,$2,$3,$4,$5,$6,true)',[id,'lot:'+id,kind,owner,'GBP','credit']);}
 private async debts(m:EntityManager,actor:string):Promise<{id:string;account:string;balancePence:string;cap:string}[]>{return m.query('SELECT d.id,d.account,d.cap,a."balancePence" FROM public.finance_verified_debts d JOIN public.finance_accounts a ON a.id=d.account WHERE d.debtor=$1 AND a."balancePence">0 ORDER BY d.id FOR UPDATE OF a',[actor]);}
 private async collect(m:EntityManager,actor:string,post:(p:Posting[])=>Promise<{journalId:string}>):Promise<LotResult>{
  const debts=await this.debts(m,actor);if(!debts.length)return {status:'completed',amountPence:'0'};
  if(debts.length!==1)return {status:'pending_review',amountPence:'0',reason:'MULTIPLE_DEBT_PRIORITY_UNRESOLVED'};
  const debt=debts[0],due=BigInt(debt.balancePence);if(due>BigInt(debt.cap))throw new Error('DEBT_EXCEEDS_VERIFIED_CAP');
  const lots=await m.query('SELECT l.*,a."balancePence" FROM public.finance_bonus_lots l JOIN public.finance_accounts a ON a.id=l.available WHERE l.owner=$1 AND a."balancePence">0 ORDER BY l.id FOR UPDATE OF l,a',[actor]) as (Lot&{balancePence:string})[];
  const total=lots.reduce((sum,l)=>sum+BigInt(l.balancePence),0n);
  if(lots.length>1&&total>due)return {status:'pending_review',amountPence:'0',reason:'SOURCE_SLICE_PRIORITY_UNRESOLVED'};
  let left=due;const lines:Posting[]=[];
  for(const lot of lots){const balance=BigInt(lot.balancePence),amount=balance<left?balance:left;if(amount){lines.push({accountId:lot.available,side:'debit',amount});left-=amount;}}
  const amount=due-left;if(!amount)return {status:'completed',amountPence:'0'};
  lines.push({accountId:debt.account,side:'credit',amount});const journal=await post(lines);
  return {status:'completed',amountPence:amount.toString(),journalId:journal.journalId};
 }
}
