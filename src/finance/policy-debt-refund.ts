import {randomUUID} from 'node:crypto';
import type {EntityManager} from 'typeorm';
import {PolicyContext,digest} from './policy-context';
import {cashbackRecovery,debtPriority,OWNER_POLICY,utc,policyPence} from './owner-policy';
import {splitRevenue} from './money';
import {fifo,POLICY_21} from './policy-2026-10-21';
export class PolicyDebtRefund {
 constructor(private readonly c:PolicyContext){}
 private async slice(m:EntityManager,journal:string,debt:string|null,scope:string|null,lot:string,account:string,kind:'collection'|'restoration',amount:bigint){
  if(amount)await m.query('INSERT INTO finance_policy_recovery_slices(id,journal,debt,scope,lot,account,kind,amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),journal,debt,scope,lot,account,kind,amount.toString()]);
 }
 private async decrease(m:EntityManager,actor:string,scope:string,f:any,proof:string,prior:bigint,target:bigint,settlements:any[]){
  const history=await m.query("SELECT payload FROM finance_policy_records WHERE kind='refund' AND scope=$1",[scope]);
  const ids=history.map((r:any)=>r.payload.debtId).filter(Boolean);
  // Import only source associations already proven by immutable old journals.
  // Ambiguous many-source/many-debt historical mappings are never guessed.
  for(const row of history){const p=row.payload;if(!p.journal||!p.sources?.length)continue;const exists=await m.query('SELECT 1 FROM finance_policy_recovery_slices WHERE journal=$1 AND scope=$2',[p.journal,scope]);if(exists.length)continue;
   for(const s of p.sources){const [l]=await m.query('SELECT * FROM finance_bonus_lots WHERE id=$1',[s.lot]);if(!l||l.owner!==actor)return {status:'pending_review',reason:'ORIGINAL_RECOVERY_SOURCE_OWNERSHIP_REQUIRED'};await this.slice(m,p.journal,null,scope,l.id,l.available,'collection',BigInt(s.amount));}
  }
  if(ids.length){const old=await m.query("SELECT journal,payload FROM finance_policy_records WHERE kind IN ('debt_allocation','linked_recovery')",[]);
   for(const record of old){const p=record.payload;if((await m.query('SELECT 1 FROM finance_policy_recovery_slices WHERE journal=$1',[record.journal])).length)continue;
    if(p.debt&&ids.includes(p.debt)&&p.lot){const [l]=await m.query('SELECT * FROM finance_bonus_lots WHERE id=$1',[p.lot]);if(l)await this.slice(m,record.journal,p.debt,null,l.id,l.available,'collection',BigInt(p.amount));continue;}
    const debtParts=(p.allocations||[]).filter((a:any)=>a.debt),sourceParts=(p.allocations||[]).filter((a:any)=>a.lot);if(!debtParts.some((a:any)=>ids.includes(a.debt)))continue;
    if(debtParts.length>1&&sourceParts.length>1)return {status:'pending_review',reason:'HISTORICAL_RECOVERY_PAIRING_NOT_PROVEN'};
    let i=0,sourceLeft=BigInt(sourceParts[0]?.amount||'0');for(const d of debtParts){let remaining=BigInt(d.amount);while(remaining){const s=sourceParts[i];if(!s||!sourceLeft)return {status:'pending_review',reason:'RECOVERY_SOURCE_HISTORY_RECONCILIATION_REQUIRED'};const n=remaining<sourceLeft?remaining:sourceLeft;if(ids.includes(d.debt)){const [l]=await m.query('SELECT * FROM finance_bonus_lots WHERE id=$1',[s.lot]);if(!l)return {status:'pending_review',reason:'ORIGINAL_RECOVERY_SOURCE_OWNERSHIP_REQUIRED'};await this.slice(m,record.journal,d.debt,null,l.id,l.available,'collection',n);}remaining-=n;sourceLeft-=n;if(!sourceLeft){i++;sourceLeft=BigInt(sourceParts[i]?.amount||'0');}}
    }
   }
  }
  const debts=ids.length?await m.query('SELECT d.*,a."balancePence",to_char(e."confirmedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS confirmed FROM finance_verified_debts d JOIN finance_accounts a ON a.id=d.account JOIN finance_policy_debt_evidence e ON e.debt=d.id WHERE d.id=ANY($1::uuid[]) ORDER BY d.id FOR UPDATE OF a',[ids]):[];
  if(debts.some((d:any)=>d.debtor!==actor||BigInt(d.balancePence)>BigInt(d.cap)))throw Error('Refund debt ownership/cap mismatch');
  const rows=await m.query(`SELECT s.lot,l.available AS account,sum(CASE WHEN s.kind='collection' THEN s.amount ELSE -s.amount END)::text AS amount,
   l.owner,l.available,l.parent,l.responsible,to_char(l."confirmedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS confirmed
   FROM finance_policy_recovery_slices s JOIN finance_bonus_lots l ON l.id=s.lot
   WHERE s.scope=$1 OR s.debt=ANY($2::uuid[]) GROUP BY s.lot,l.owner,l.available,l.parent,l.responsible,l."confirmedAt"`,[scope,ids]);
  if(rows.some((r:any)=>(r.owner!==actor&&!f.restorationOwners?.includes(r.owner))||BigInt(r.amount)<0n))return {status:'pending_review',reason:'ORIGINAL_RECOVERY_SOURCE_OWNERSHIP_REQUIRED'};
  const collected=rows.reduce((n:bigint,r:any)=>n+BigInt(r.amount),0n),outstanding=debts.reduce((n:bigint,d:any)=>n+BigInt(d.balancePence),0n);
  if(collected+outstanding!==prior)return {status:'pending_review',reason:'RECOVERY_SOURCE_HISTORY_RECONCILIATION_REQUIRED'};
  let decrease=prior-target;const cancel=decrease<outstanding?decrease:outstanding,restore=decrease-cancel;
  const debtOrder=debtPriority(debts.filter((d:any)=>BigInt(d.balancePence)>0n).map((d:any)=>({...d,confirmedAt:d.confirmed})));
  if(cancel&&debtOrder.status!=='ready')return debtOrder;
  const plan=fifo<any>(rows.filter((r:any)=>BigInt(r.amount)>0n).map((r:any)=>({...r,id:r.lot})),restore);if(plan.status!=='ready')return plan;
  const clearing=await this.c.account(m,'policy:cashback-recovery:'+actor,actor,'clearing','debit',false),lines:any[]=[{accountId:clearing,side:'debit',amount:decrease}],cancelled:any[]=[],restored:any[]=[];
  let left=cancel;
  if(debtOrder.status==='ready')for(const d of debtOrder.debts as any[]){const n=BigInt(d.balancePence)<left?BigInt(d.balancePence):left;if(n){lines.push({accountId:d.account,side:'credit',amount:n});cancelled.push({debt:d.id,amount:n.toString()});left-=n;}}
  for(const a of plan.allocations){const l=a.lot;const restricted=!!l.parent||(await m.query("SELECT 1 FROM finance_bonus_reservations WHERE lot=$1 AND state='active' LIMIT 1",[l.lot])).length>0;
   const destination=restricted?await this.c.account(m,'policy:restoration-held:'+l.lot,l.owner,'reserved','credit'):l.available;
   lines.push({accountId:destination,side:'credit',amount:a.amount});restored.push({lot:l.lot,account:destination,amount:a.amount.toString(),restricted});
  }
  const journal=await this.c.post(m,lines);
  for(const a of restored)await this.slice(m,journal.journalId,null,scope,a.lot,a.account,'restoration',BigInt(a.amount));
  const result={status:'corrected',...f,actor,proof,policy:this.c.policy,target:target.toString(),debtReduced:cancel.toString(),restored:restore.toString(),cancelled,restorations:restored,originalJournals:settlements.map(s=>s.journal),journal:journal.journalId};
  await this.c.record(m,'refund',scope,f.refundId,result,journal.journalId);return result;
 }
 async collect(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts}=await this.c.enter<{confirmationEvidence:string}>(m,principal,'collect_debt',reference);
  return this.c.command(m,actor,key,{action:'collect_debt',facts,proof},async()=>this.collectOwned(m,actor));
 }
 async collectOwned(m:EntityManager,actor:string){
  const rows=await m.query('SELECT d.*,a."balancePence",to_char(e."confirmedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS confirmed FROM finance_verified_debts d JOIN finance_accounts a ON a.id=d.account LEFT JOIN finance_policy_debt_evidence e ON e.debt=d.id WHERE d.debtor=$1 AND a."balancePence">0 FOR UPDATE OF a',[actor]);
  if(!rows.length)return {status:'completed',collected:'0'};
  const priority=debtPriority<{id:string;confirmedAt:string|null;balancePence:string;cap:string;account:string}>(rows.map((r:any)=>({...r,confirmedAt:r.confirmed})));
  if(priority.status!=='ready')return priority;
  let lots=await m.query('SELECT l.*,a."balancePence",to_char(l."confirmedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS confirmed FROM finance_bonus_lots l JOIN finance_accounts a ON a.id=l.available WHERE l.owner=$1 AND a."balancePence">0 ORDER BY l.id FOR UPDATE OF a,l',[actor]);
  const due=rows.reduce((n:bigint,r:any)=>n+BigInt(r.balancePence),0n),free=lots.reduce((n:bigint,l:any)=>n+BigInt(l.balancePence),0n);
  // Q12 orders DEBTS, not competing funding slices of different provenance/age.
  if(this.c.policy===POLICY_21){const choice=fifo<any>(lots.map((l:any)=>({...l,amount:l.balancePence})),free<due?free:due);if(choice.status!=='ready')return choice;lots=choice.allocations.map(a=>({...a.lot,balancePence:a.amount.toString()}));}
  else if(lots.length>1&&free>due)return {status:'pending_review',reason:'SOURCE_SLICE_ORDER_NOT_APPROVED'};
  let left=free<due?free:due;const total=left;if(!total)return {status:'completed',collected:'0'};
  const lines:any[]=[],allocations:any[]=[];
  for(const l of lots){const n=BigInt(l.balancePence)<left?BigInt(l.balancePence):left;if(n){lines.push({accountId:l.available,side:'debit',amount:n});allocations.push({lot:l.id,amount:n.toString()});left-=n;}}
  left=total;
  for(const d of priority.debts){if(BigInt(d.balancePence)>BigInt(d.cap))throw Error('Debt exceeds cap');const n=BigInt(d.balancePence)<left?BigInt(d.balancePence):left;if(n){lines.push({accountId:d.account,side:'credit',amount:n});allocations.push({debt:d.id,amount:n.toString()});left-=n;}}
  const journal=await this.c.post(m,lines);await this.c.record(m,'debt_allocation',actor,journal.journalId,{allocations,policy:this.c.policy},journal.journalId);
  if(this.c.policy===POLICY_21){let index=0,sourceLeft=lots.length?BigInt(lots[0].balancePence):0n;for(const d of allocations.filter(a=>a.debt)){let n=BigInt(d.amount);while(n){const l=lots[index],take=n<sourceLeft?n:sourceLeft;await this.slice(m,journal.journalId,d.debt,null,l.id,l.available,'collection',take);n-=take;sourceLeft-=take;if(!sourceLeft){index++;sourceLeft=lots[index]?BigInt(lots[index].balancePence):0n;}}}}
  return {status:'completed',collected:total.toString(),journal:journal.journalId,allocations};
 }
 async refund(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{source:string;orderId:string;refundId:string;version:number;full:boolean;revisedCommission:string|null;currency:string;verified:boolean;payoutReconciled:boolean;confirmedAt:string;restorationOwners?:string[]}>(m,principal,'refund_cashback',reference,f=>this.c.policy===POLICY_21?(f.restorationOwners||[]):[]);
  return this.c.command(m,actor,key,{action:'refund_cashback',facts:f,proof},async()=>{
   if(f.verified!==true||f.payoutReconciled!==true||f.currency!=='GBP')return {status:'pending_review',reason:'VERIFIED_REFUND_BASIS_AND_PAYOUT_STATE_REQUIRED'};
   if(!Number.isSafeInteger(f.version)||f.version<1||typeof f.full!=='boolean'||!f.refundId)throw Error('Canonical refund version/identity required');
   utc(f.confirmedAt);
   // Original order binding is read from the already immutable settlement command,
   // not supplied journal IDs or a product-price proportional calculation.
   const settlements=await m.query("SELECT DISTINCT s.* FROM finance_receipt_settlements s JOIN finance_domain_commands c ON c.result->>'journalId'=s.journal::text WHERE c.action='settle' AND c.command->>2='cashback' AND c.command->>10=$1 AND c.command->>11=$2 AND s.actor=$3",[f.source,f.orderId,actor]);
   if(!settlements.length)return {status:'pending_review',reason:'ORIGINAL_CASHBACK_SETTLEMENT_REQUIRED'};
   for(const s of settlements){
    const [l]=await m.query('SELECT * FROM finance_bonus_lots WHERE id=$1',[s.lot]),[r]=await m.query('SELECT * FROM finance_bank_receipts WHERE id=$1',[s.receipt]);
    const postings=await m.query('SELECT p.side,p."amountPence",p."accountId",j.sealed FROM finance_postings p JOIN finance_journals j ON j.id=p."journalId" WHERE j.id=$1',[s.journal]);
    const credits=postings.filter((p:any)=>p.side==='credit'&&p.accountId===l?.available).reduce((n:bigint,p:any)=>n+BigInt(p.amountPence),0n),funded=postings.filter((p:any)=>p.side==='debit'&&p.accountId===r?.unallocatedAccountId).reduce((n:bigint,p:any)=>n+BigInt(p.amountPence),0n);
    if(!l||l.owner!==actor||l.kind!=='withdrawal_gbp'||l.origin!==s.source||!r||r.currency!=='GBP'||r.verificationStatus!=='verified'||r.amountPence!==s.gross||!postings.length||postings.some((p:any)=>!p.sealed)||credits!==BigInt(s.userGross)||funded!==BigInt(s.gross)||splitRevenue(BigInt(s.gross),'cashback').user!==BigInt(s.userGross))return {status:'pending_review',reason:'ORIGINAL_JOURNAL_RECEIPT_AND_CUSTOMER_BASIS_RECONCILIATION_REQUIRED'};
   }
   const activeHolds=await m.query("SELECT p.payload FROM finance_policy_records p WHERE p.kind='payout' AND p.scope=$1 AND NOT EXISTS(SELECT 1 FROM finance_policy_records t WHERE t.kind='payout_terminal' AND t.scope=p.scope AND t.key=p.key)",[actor]);
   if(activeHolds.some((p:any)=>p.payload.lots.some((l:any)=>settlements.some((s:any)=>s.lot===l.id))))return {status:'pending_review',reason:'PAYOUT_HOLD_RECONCILIATION_REQUIRED'};
   const original=settlements.reduce((n:bigint,s:any)=>n+BigInt(s.userGross),0n),recovery=cashbackRecovery(original,f.revisedCommission===null?null:policyPence(f.revisedCommission),f.full);
   if(recovery.status!=='ready')return recovery;
   const scope=JSON.stringify([f.source,f.orderId]);
   const previous=await m.query("SELECT payload FROM finance_policy_records WHERE kind='refund' AND scope=$1 ORDER BY (payload->>'version')::integer DESC LIMIT 1",[scope]);
   const last=previous[0]?.payload,prior=BigInt(last?.target||'0');
   if(last&&f.version<=last.version){if(f.version===last.version&&last.refundId===f.refundId&&prior===recovery.target)return {status:'already_corrected',target:prior.toString()};throw Error('Refund version conflict');}
   if(recovery.target<prior){if(this.c.policy!==POLICY_21)return {status:'pending_review',reason:'RECOVERY_REDUCTION_RECONCILIATION_REQUIRED'};return this.decrease(m,actor,scope,f,proof,prior,recovery.target,settlements);}
   const delta=recovery.target-prior;if(!delta){await this.c.record(m,'refund',scope,f.refundId,{...f,target:recovery.target.toString(),actor,proof,originalJournals:settlements.map((s:any)=>s.journal)});return {status:'completed',recovered:'0',debt:'0'};}
   const originals=await m.query('SELECT l.*,a."balancePence" FROM finance_bonus_lots l JOIN finance_accounts a ON a.id=l.available WHERE l.id=ANY($1::uuid[]) AND l.owner=$2 FOR UPDATE OF l,a',[settlements.map((s:any)=>s.lot).filter(Boolean),actor]);
   let funded=originals.filter((l:any)=>BigInt(l.balancePence)>0n);let chosen:any[]|null=null;
   if(this.c.policy===POLICY_21)funded=await m.query('SELECT l.*,a."balancePence" FROM finance_bonus_lots l JOIN finance_accounts a ON a.id=l.available WHERE l.owner=$1 AND a."balancePence">0 ORDER BY l.id FOR UPDATE OF l,a',[actor]);
   if(this.c.policy===POLICY_21){const dates=await m.query('SELECT id,to_char("confirmedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS confirmed FROM finance_bonus_lots WHERE id=ANY($1::uuid[])',[funded.map((l:any)=>l.id)]);const plan=fifo<any>(funded.map((l:any)=>({...l,amount:l.balancePence,confirmed:dates.find((d:any)=>d.id===l.id).confirmed})),delta);if(plan.status!=='ready')return plan;chosen=plan.allocations.map(a=>({...a.lot,take:a.amount}));}
   else if(funded.length>1&&funded.reduce((n:bigint,l:any)=>n+BigInt(l.balancePence),0n)>delta)return {status:'pending_review',reason:'ORIGINAL_REFUND_SOURCE_SLICE_PRIORITY_REQUIRED'};
   const recoveryAccount=await this.c.account(m,'policy:cashback-recovery:'+actor,actor,'clearing','debit',false);
   let left=delta;const lines:any[]=[],sources:any[]=[];
   for(const s of chosen||settlements){const id=chosen?s.id:s.lot;if(!id)continue;const [lot]=await m.query('SELECT l.*,a."balancePence" FROM finance_bonus_lots l JOIN finance_accounts a ON a.id=l.available WHERE l.id=$1 AND l.owner=$2 FOR UPDATE OF l,a',[id,actor]);if(!lot)throw Error('Original cashback lot mismatch');const n=chosen?s.take:(BigInt(lot.balancePence)<left?BigInt(lot.balancePence):left);if(n){lines.push({accountId:lot.available,side:'debit',amount:n});sources.push({lot:lot.id,account:lot.available,amount:n.toString()});left-=n;}}
   let debtId:string|null=null;
   if(left){debtId=randomUUID();const account=await this.c.account(m,'policy:debt:'+debtId,actor,'user_debt','debit');lines.push({accountId:account,side:'debit',amount:left});await m.query('INSERT INTO finance_verified_debts(id,debtor,origin,evidence,cap,account) VALUES($1,$2,$3,$4,$5,$6)',[debtId,actor,settlements.length===1?settlements[0].source:'order:'+digest(scope),'policy:'+debtId,left.toString(),account]);await m.query('INSERT INTO finance_policy_debt_evidence(debt,"confirmedAt",proof,policy) VALUES($1,$2,$3,$4)',[debtId,f.confirmedAt,proof,this.c.policy]);}
   lines.push({accountId:recoveryAccount,side:'credit',amount:delta});const journal=await this.c.post(m,lines);
   const result={status:'corrected',...f,actor,proof,target:recovery.target.toString(),recovered:(delta-left).toString(),debt:left.toString(),debtId,sources,originalJournals:settlements.map((s:any)=>s.journal),journal:journal.journalId,policy:this.c.policy};
   await this.c.record(m,'refund',scope,f.refundId,result,journal.journalId);
   if(this.c.policy===POLICY_21)for(const s of sources)await this.slice(m,journal.journalId,null,scope,s.lot,s.account,'collection',BigInt(s.amount));
   // The correction clears customer entitlement / creates its capped receivable.
   // This clearing account is NOT platform income or inferred merchant payable.
   return result;
  });
 }
 async externalRepayment(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{receipt:string;debt:string;amount:string}>(m,principal,'external_repayment',reference);
  return this.c.command(m,actor,key,{action:'external_repayment',facts:f,proof},async()=>{
   const amount=policyPence(f.amount);if(amount<=0n)throw Error('Positive repayment required');
   const [r]=await m.query("SELECT * FROM finance_bank_receipts WHERE id=$1 AND \"verificationStatus\"='verified' AND currency='GBP' FOR UPDATE",[f.receipt]);
   const [d]=await m.query('SELECT d.*,a."balancePence" FROM finance_verified_debts d JOIN finance_accounts a ON a.id=d.account WHERE d.id=$1 AND d.debtor=$2 FOR UPDATE OF a',[f.debt,actor]);
   if(!r||!d)return {status:'pending_review',reason:'VERIFIED_BANK_RECEIPT_AND_OWN_DEBT_REQUIRED'};
   if(await this.c.get(m,'external_repayment',f.receipt,'used'))throw Error('Receipt repayment already used');
   if((await m.query('SELECT 1 FROM finance_receipt_settlements WHERE receipt=$1',[f.receipt])).length)throw Error('Receipt already settled');
   // Coverage writers use their own reservation protocol. Until the repayment
   // participates in that protocol, absence of a row is not a race-safe proof.
   const coverage=(await m.query("SELECT to_regclass('public.finance_coverage_allocations') AS t"))[0].t;
   const coordinated=this.c.policy===POLICY_21&&!!(await m.query("SELECT to_regclass('public.finance_receipt_repayments') AS t"))[0].t;
   if(coverage&&!coordinated)return {status:'pending_review',reason:'COVERAGE_REPAYMENT_COORDINATION_REQUIRED'};
   if(amount>BigInt(r.amountPence)||amount>BigInt(d.balancePence))throw Error('Repayment cap exceeded');
   const j=await this.c.post(m,[{accountId:r.unallocatedAccountId,side:'debit',amount},{accountId:d.account,side:'credit',amount}]);if(coordinated)await m.query('INSERT INTO finance_receipt_repayments(receipt,debt,journal,amount) VALUES($1,$2,$3,$4)',[r.id,d.id,j.journalId,amount.toString()]);const result={status:'completed',amount:amount.toString(),actor,proof,journal:j.journalId};await this.c.record(m,'external_repayment',f.receipt,'used',result,j.journalId);return result;
  });
 }
 async feeLiability(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{expenseJournal:string;terms:string|null;buyerLiable:boolean;providerEvidence:string|null;confirmedAt:string}>(m,principal,'fee_liability',reference);
  return this.c.command(m,actor,key,{action:'fee_liability',facts:f,proof},async()=>{
   if(f.buyerLiable!==true||!f.terms||!f.providerEvidence)return {status:'pending_review',reason:'NO_AUTOMATIC_CUSTOMER_FEE_LIABILITY'};
   utc(f.confirmedAt);if(await this.c.get(m,'fee_liability',f.expenseJournal,'charged'))throw Error('Expense already assigned for recovery');
   const rows=await m.query('SELECT p.side,p."amountPence",a.kind,a."ownerReference",j.sealed FROM finance_postings p JOIN finance_accounts a ON a.id=p."accountId" JOIN finance_journals j ON j.id=p."journalId" WHERE j.id=$1',[f.expenseJournal]);
   if(rows.length<2||rows.some((r:any)=>!r.sealed))throw Error('Actual sealed expense journal required');
   let amount=0n;for(const r of rows){if(r.side==='debit'){if(!['bank_fee_expense','transfer_expense'].includes(r.kind)||r.ownerReference!=='platform')throw Error('Unverified refund fee expense');amount+=BigInt(r.amountPence);}else if(r.kind!=='company_bank_cash'||r.ownerReference!=='platform')throw Error('Actual website bank payment evidence required');}
   if(!amount)throw Error('Positive actual expense required');const debt=randomUUID(),account=await this.c.account(m,'policy:fee-debt:'+debt,actor,'user_debt','debit'),clearing=await this.c.account(m,'policy:fee-recovery:'+actor,actor,'clearing','debit',false);
   const j=await this.c.post(m,[{accountId:account,side:'debit',amount},{accountId:clearing,side:'credit',amount}]);await m.query('INSERT INTO finance_verified_debts(id,debtor,origin,evidence,cap,account) VALUES($1,$2,$3,$4,$5,$6)',[debt,actor,'expense:'+f.expenseJournal,'policy:'+debt,amount.toString(),account]);await m.query('INSERT INTO finance_policy_debt_evidence(debt,"confirmedAt",proof,policy) VALUES($1,$2,$3,$4)',[debt,f.confirmedAt,proof,this.c.policy]);const result={status:'recorded',debt,amount:amount.toString(),actor,proof,terms:f.terms,expense:f.expenseJournal,journal:j.journalId};await this.c.record(m,'fee_liability',f.expenseJournal,'charged',result,j.journalId);return result;
  });
 }
 async linkedRecovery(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{recipient:string;lot:string;debt:string;amount:string;lineageVerified:boolean}>(m,principal,'linked_recovery',reference,f=>[f.recipient]);
  return this.c.command(m,actor,key,{action:'linked_recovery',facts:f,proof},async()=>{
   const [l]=await m.query('SELECT l.*,p.owner AS parent_owner,a."balancePence" FROM finance_bonus_lots l JOIN finance_bonus_lots p ON p.id=l.parent JOIN finance_accounts a ON a.id=l.available WHERE l.id=$1 FOR UPDATE OF l,a',[f.lot]);
   const [d]=await m.query('SELECT d.*,a."balancePence" FROM finance_verified_debts d JOIN finance_accounts a ON a.id=d.account WHERE d.id=$1 FOR UPDATE OF a',[f.debt]);
   if(f.lineageVerified!==true||!l||!d||l.owner!==f.recipient||d.debtor!==actor||l.responsible!==actor||l.origin!==d.origin||l.parent_owner!==actor)return {status:'pending_review',reason:'PROVEN_DIRECT_RELATED_FREE_CHAIN_REQUIRED'};
   const amount=policyPence(f.amount);if(amount<=0n||amount>BigInt(l.balancePence)||amount>BigInt(d.balancePence)||BigInt(d.balancePence)>BigInt(d.cap))throw Error('Linked recovery cap/free balance exceeded');
   const j=await this.c.post(m,[{accountId:l.available,side:'debit',amount},{accountId:d.account,side:'credit',amount}]);if(this.c.policy===POLICY_21)await this.slice(m,j.journalId,d.id,null,l.id,l.available,'collection',amount);const result={status:'completed',actor,proof,lot:l.id,origin:l.origin,amount:amount.toString(),debt:d.id,journal:j.journalId};await this.c.record(m,'linked_recovery',d.id,j.journalId,result,j.journalId);return result;
  });
 }
 async recalculateReservation(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{reservation:string;selection:string;click:string;purchaseRecalculationVerified:boolean}>(m,principal,'debt_reservation_recalculation',reference);
  return this.c.command(m,actor,key,{action:'debt_reservation_recalculation',facts:f,proof},async()=>{
   if(f.purchaseRecalculationVerified!==true)return {status:'pending_review',reason:'SEPARATE_SAFE_PURCHASE_RECALCULATION_REQUIRED'};
   const selection=await this.c.get(m,'selection',f.click,f.selection);
   if(!selection||selection.payload.actor!==actor||await this.c.get(m,'bonus',f.click,'final'))return {status:'pending_review',reason:'CURRENT_UNCONSUMED_PURCHASE_SELECTION_REQUIRED'};
   if(await this.c.get(m,'bonus_cancel',f.click,'return'))return {status:'pending_review',reason:'CANCELLED_PURCHASE_RECALCULATION_BLOCKED'};
   const canonical=await m.query('SELECT "sourceNamespace","orderId" FROM finance_purchase_orders WHERE "clickId"=$1',[f.click]);
   if(canonical.length!==selection.payload.versions.length)return {status:'pending_review',reason:'PURCHASE_RECALCULATION_STALE'};
   for(const v of selection.payload.versions){if((await m.query("SELECT 1 FROM finance_policy_records WHERE kind='attribution_conflict' AND scope=$1",[JSON.stringify([v.source,v.id])])).length)return {status:'pending_review',reason:'ATTRIBUTION_CONFLICT'};const [latest]=await m.query("SELECT max((payload->>'version')::integer) AS v FROM finance_policy_records WHERE kind='order' AND payload->>'orderSource'=$1 AND payload->>'orderId'=$2",[v.source,v.id]);if(latest.v!==v.version)return {status:'pending_review',reason:'PURCHASE_RECALCULATION_STALE'};}
   for(const ranked of selection.payload.rankedOrders){const [first]=await m.query("SELECT to_char(min(\"ingestedAt\") AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS t FROM finance_policy_records WHERE kind='seller_ingestion' AND payload->>'orderSource'=$1 AND payload->>'orderId'=$2",[ranked.source,ranked.id]);if(first.t!==ranked.firstIngested)return {status:'pending_review',reason:'PURCHASE_RECALCULATION_STALE'};}
   const [r]=await m.query('SELECT r.*,l.owner,l.reserved FROM finance_bonus_reservations r JOIN finance_bonus_lots l ON l.id=r.lot WHERE r.id=$1 FOR UPDATE OF r,l',[f.reservation]);if(!r||r.owner!==actor||r.click!==f.click||r.state!=='active')throw Error('Debtor own active reservation required');
   const free=await this.collectOwned(m,actor);if(free.status==='pending_review')return free;
   const debts=await m.query('SELECT d.*,a."balancePence",to_char(e."confirmedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS confirmed FROM finance_verified_debts d JOIN finance_accounts a ON a.id=d.account LEFT JOIN finance_policy_debt_evidence e ON e.debt=d.id WHERE d.debtor=$1 AND a."balancePence">0 FOR UPDATE OF a',[actor]);
   const priority=debtPriority<{id:string;confirmedAt:string|null;account:string;balancePence:string;cap:string}>(debts.map((d:any)=>({...d,confirmedAt:d.confirmed})));if(priority.status!=='ready')return priority;
   if(this.c.policy===POLICY_21){
    const reserves=await m.query("SELECT r.*,l.owner,l.reserved,to_char(l.\"confirmedAt\" AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS confirmed FROM finance_bonus_reservations r JOIN finance_bonus_lots l ON l.id=r.lot WHERE r.click=$1 AND r.state='active' ORDER BY r.id FOR UPDATE OF r,l",[f.click]);
    if(reserves.some((x:any)=>x.owner!==actor))throw Error('Reservation group ownership mismatch');
    const due=debts.reduce((n:bigint,d:any)=>n+BigInt(d.balancePence),0n),plan=fifo<any>(reserves,due);if(plan.status!=='ready')return plan;
    if(!plan.allocated)return {status:'completed',reserved:r.amount,reservation:r.id,debtCollected:'0'};
    const lines:any[]=[],sources:any[]=[],allocations:any[]=[],replacements:any[]=[];
    for(const a of plan.allocations){lines.push({accountId:a.lot.reserved,side:'debit',amount:a.amount});sources.push({lot:a.lot.lot,account:a.lot.reserved,amount:a.amount});}
    let left=plan.allocated;for(const d of priority.debts){if(BigInt(d.balancePence)>BigInt(d.cap))throw Error('Debt cap exceeded');const n=BigInt(d.balancePence)<left?BigInt(d.balancePence):left;if(n){lines.push({accountId:d.account,side:'credit',amount:n});allocations.push({debt:d.id,amount:n});left-=n;}}
    const journal=await this.c.post(m,lines);
    for(const a of plan.allocations){const remaining=BigInt(a.lot.amount)-a.amount;await m.query("UPDATE finance_bonus_reservations SET state='consumed' WHERE id=$1",[a.lot.id]);const next=remaining?randomUUID():null;if(next)await m.query("INSERT INTO finance_bonus_reservations(id,lot,click,amount,state) VALUES($1,$2,$3,$4,'active')",[next,a.lot.lot,f.click,remaining.toString()]);replacements.push({previous:a.lot.id,reservation:next,lot:a.lot.lot,remaining:remaining.toString()});}
    let si=0,sl=sources[0].amount;for(const d of allocations){let n=d.amount;while(n){const src=sources[si],take=n<sl?n:sl;await this.slice(m,journal.journalId,d.debt,null,src.lot,src.account,'collection',take);sl-=take;n-=take;if(!sl){si++;sl=sources[si]?.amount||0n;}}}
    const result={status:'recalculated',actor,proof,policy:this.c.policy,debtCollected:plan.allocated.toString(),replacements,reservation:replacements.find(x=>x.reservation)?.reservation||reserves.find((x:any)=>!replacements.some(y=>y.previous===x.id))?.id||null,journal:journal.journalId};await this.c.record(m,'reservation_recalculation',f.click,key,result,journal.journalId);return result;
   }
   let left=BigInt(r.amount);const lines:any[]=[],allocations:any[]=[];
   for(const d of priority.debts){if(BigInt(d.balancePence)>BigInt(d.cap))throw Error('Debt cap exceeded');const n=BigInt(d.balancePence)<left?BigInt(d.balancePence):left;if(n){lines.push({accountId:d.account,side:'credit',amount:n});allocations.push({debt:d.id,amount:n.toString()});left-=n;}}
   const amount=BigInt(r.amount)-left;if(!amount)return {status:'completed',reserved:r.amount,reservation:r.id,debtCollected:'0'};
   lines.push({accountId:r.reserved,side:'debit',amount});const j=await this.c.post(m,lines);await m.query("UPDATE finance_bonus_reservations SET state='consumed' WHERE id=$1",[r.id]);
   const next=left?randomUUID():null;if(next)await m.query("INSERT INTO finance_bonus_reservations(id,lot,click,amount,state) VALUES($1,$2,$3,$4,'active')",[next,r.lot,r.click,left.toString()]);
   const cap=BigInt(selection.payload.cap),result={status:'recalculated',actor,proof,originalReservation:r.id,reservation:next,reserved:left.toString(),applicableBonus:(left<cap?left:cap).toString(),debtCollected:amount.toString(),freeCollection:free,allocations,policy:this.c.policy,journal:j.journalId};await this.c.record(m,'reservation_recalculation',r.id,key,result,j.journalId);return result;
  });
 }
}
