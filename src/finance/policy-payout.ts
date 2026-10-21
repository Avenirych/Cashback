import type {EntityManager} from 'typeorm';
import {PolicyContext} from './policy-context';
import {OWNER_POLICY,sixMonthsUtc,utc,policyPence} from './owner-policy';
import {evaluatePayout} from './payout-policy';
import {POLICY_21,fifo} from './policy-2026-10-21';
type ClaimFacts={lots:string[];excluded?:{lot:string;restrictionEvidence:string}[];currency:string;expectedPrincipal:string;fee:string;quote:string;quoteExpires:string;feeBank:string;principalBank:string;providerVerified:boolean;recipientVerified:boolean;coverageVerified:boolean;budgetApproved:boolean;restrictionsClear:boolean};
export class PolicyPayout {
 constructor(private readonly c:PolicyContext,private readonly isolatedClock?:()=>string){}
 async claim(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<ClaimFacts>(m,principal,'payout_claim',reference);
  return this.c.command(m,actor,key,{action:'payout_claim',facts:f,proof},async()=>{
   const now=this.isolatedClock?this.isolatedClock():await this.c.serverReceiptTime(m);
   utc(now);utc(f.quoteExpires);if(f.currency!=='GBP'||!f.quote||utc(now)>=utc(f.quoteExpires))return {status:'pending_review',reason:'CURRENT_VERIFIED_FEE_QUOTE_REQUIRED'};
   const jobs=await m.query("SELECT key FROM finance_policy_records WHERE kind='payout' AND scope=$1",[actor]);
   for(const j of jobs){const end=await this.c.get(m,'payout_terminal',actor,j.key);if(!end)return {status:'pending_review',reason:'EXISTING_PAYOUT_HOLD_RECONCILE_FIRST'};}
   if(new Set(f.lots).size!==f.lots.length||!f.lots.length)throw Error('Unique eligible payout lots required');
   let lots=await m.query('SELECT l.*,a."balancePence",to_char(l."confirmedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS confirmed FROM finance_bonus_lots l JOIN finance_accounts a ON a.id=l.available WHERE l.id=ANY($1::uuid[]) AND l.owner=$2 ORDER BY l.id FOR UPDATE OF l,a',[f.lots,actor]);
   if(lots.length!==f.lots.length||lots.some((l:any)=>BigInt(l.balancePence)<=0n))throw Error('Verified owned free lots required');
   const allFree=await m.query('SELECT l.id FROM finance_bonus_lots l JOIN finance_accounts a ON a.id=l.available WHERE l.owner=$1 AND a."balancePence">0',[actor]);
   const excluded=f.excluded||[];
   if(new Set(excluded.map(x=>x.lot)).size!==excluded.length||excluded.some(x=>!x.restrictionEvidence||f.lots.includes(x.lot))||allFree.some((l:any)=>!f.lots.includes(l.id)&&!excluded.some(x=>x.lot===l.id)))return {status:'pending_review',reason:'COMPLETE_VERIFIED_PAYOUT_ELIGIBILITY_SET_REQUIRED'};
   let principalAmount=lots.reduce((n:bigint,l:any)=>n+BigInt(l.balancePence),0n);const aged=lots.filter((l:any)=>utc(now)>=utc(sixMonthsUtc(l.confirmed)));
   const totalFree=principalAmount,matureFree=aged.reduce((n:bigint,l:any)=>n+BigInt(l.balancePence),0n),youngFree=totalFree-matureFree;
   const dates=lots.filter((l:any)=>!aged.includes(l)).map((l:any)=>sixMonthsUtc(l.confirmed)).sort((a:string,b:string)=>utc(a)<utc(b)?-1:1);
   if(this.c.policy===POLICY_21){
    if(totalFree<1000n){lots=aged;principalAmount=matureFree;}
    if(!principalAmount)return {status:'pending_review',reason:'SIX_MONTHS_NOT_REACHED',totalFree:totalFree.toString(),matureFree:'0',youngerFree:youngFree.toString(),nextMaturity:dates[0]||null};
    const order=fifo(lots.map((l:any)=>({...l,amount:l.balancePence})),principalAmount);if(order.status!=='ready')return order;lots=order.allocations.map(x=>x.lot);
   }
   if(policyPence(f.expectedPrincipal)!==principalAmount)return {status:'pending_review',reason:'FEE_QUOTE_PRINCIPAL_CHANGED_REQUOTE_REQUIRED'};
   if(this.c.policy!==POLICY_21&&principalAmount<1000n&&aged.length!==lots.length)return {status:'pending_review',reason:aged.length?'MIXED_AGE_PAYOUT_GROUPING_REQUIRES_DECISION':'SIX_MONTHS_NOT_REACHED',eligibleAgedPence:aged.reduce((n:bigint,l:any)=>n+BigInt(l.balancePence),0n).toString(),milestones:lots.map((l:any)=>({lot:l.id,at:sixMonthsUtc(l.confirmed)}))};
   const debt=(await m.query('SELECT 1 FROM finance_verified_debts d JOIN finance_accounts a ON a.id=d.account WHERE d.debtor=$1 AND a."balancePence">0 LIMIT 1',[actor])).length>0;
   const banks=await m.query('SELECT * FROM finance_accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[f.feeBank,f.principalBank].sort()]);const feeBank=banks.find((a:any)=>a.id===f.feeBank),principalBank=banks.find((a:any)=>a.id===f.principalBank);
   if(!feeBank||!principalBank||feeBank.id===principalBank.id||[feeBank,principalBank].some(a=>a.kind!=='company_bank_cash'||a.ownerReference!=='platform'||a.normalSide!=='debit'))throw Error('Independently verified separate bank asset accounts required');
   const fee=policyPence(f.fee),gate=evaluatePayout({principal:principalAmount,providerFee:fee,ownFeeFunds:BigInt(feeBank.balancePence),debtFree:!debt,restrictionsClear:f.restrictionsClear,principalCovered:f.coverageVerified&&BigInt(principalBank.balancePence)>=principalAmount,feeUnassigned:true,budgetApproved:f.budgetApproved,providerReady:f.providerVerified,recipientVerified:f.recipientVerified,priorOutcome:'none'},{policy:OWNER_POLICY,allEligibleLotsMature:aged.length===lots.length});
   if(gate.status!=='eligible_evaluation_only'||principalAmount<=fee)return {status:'pending_review',reason:gate.status==='pending_review'?gate.reason:'PRINCIPAL_MUST_EXCEED_FULL_FEE'};
   const hold=await this.c.account(m,'policy:payout:'+actor+':'+key,actor,'reserved','credit'),feeHold=await this.c.account(m,'policy:payout-fee:'+actor+':'+key,'platform','company_bank_cash','debit'),bankHold=await this.c.account(m,'policy:payout-bank:'+actor+':'+key,'platform','company_bank_cash','debit');
   const lines:any[]=lots.map((l:any)=>({accountId:l.available,side:'debit',amount:BigInt(l.balancePence)}));lines.push({accountId:hold,side:'credit',amount:principalAmount},{accountId:f.principalBank,side:'credit',amount:principalAmount},{accountId:bankHold,side:'debit',amount:principalAmount});if(fee)lines.push({accountId:f.feeBank,side:'credit',amount:fee},{accountId:feeHold,side:'debit',amount:fee});
   const j=await this.c.post(m,lines);const result={status:'held',actor,proof,policy:this.c.policy,attempt:key,evaluatedAt:now,principal:principalAmount.toString(),fee:fee.toString(),hold,feeHold,bankHold,feeBank:f.feeBank,principalBank:f.principalBank,lots:lots.map((l:any)=>({id:l.id,available:l.available,amount:l.balancePence,confirmedAt:l.confirmed})),quote:f.quote,quoteExpires:f.quoteExpires,reason:principalAmount>=1000n?'TEN_POUND_TRIGGER':'SIX_UTC_CALENDAR_MONTHS',journal:j.journalId};
   const extended=this.c.policy===POLICY_21?{...result,policy:this.c.policy,totalFree:totalFree.toString(),matureFree:matureFree.toString(),youngerFree:youngFree.toString(),nextMaturity:dates[0]||null}:result;
   await this.c.record(m,'payout',actor,key,extended,j.journalId);return extended;
  });
 }
 async outcome(m:EntityManager,principal:string,key:string,reference:string){
  const {actor,proof,facts:f}=await this.c.enter<{attempt:string;providerMessage:string;state:'success'|'failed'|'unknown';reconciled:boolean;currency:string;quote:string;principalPaid:string|null;bankFee:string|null;transferFee:string|null}>(m,principal,'payout_outcome',reference);
  return this.c.command(m,actor,key,{action:'payout_outcome',facts:f,proof},async()=>{
   const p=await this.c.get(m,'payout',actor,f.attempt);if(!p)throw Error('Owned payout attempt required');const job=p.payload;
   const terminal=await this.c.get(m,'payout_terminal',actor,f.attempt);if(terminal){if(terminal.payload.state!==f.state||['currency','quote','principalPaid','bankFee','transferFee'].some(k=>terminal.payload[k]!==f[k as keyof typeof f]))throw Error('Conflicting terminal payout outcome');return terminal.payload;}
   if(!f.providerMessage||!['success','failed','unknown'].includes(f.state))throw Error('Verified provider state required');
   const history=await m.query("SELECT payload FROM finance_policy_records WHERE kind='payout_outcome' AND scope=$1",[actor+':'+f.attempt]);
   if(history.some((r:any)=>r.payload.state==='unknown')&&f.state!=='unknown'&&f.reconciled!==true)return {status:'pending_review',reason:'UNKNOWN_OUTCOME_RECONCILIATION_REQUIRED'};
   const amount=BigInt(job.principal),fee=BigInt(job.fee);
   if(f.state!=='unknown'&&(f.currency!=='GBP'||f.quote!==job.quote||f.principalPaid===null||f.bankFee===null||f.transferFee===null))return {status:'pending_review',reason:'EXACT_PROVIDER_AMOUNT_AND_FEE_EVIDENCE_REQUIRED'};
   const bankFee=f.bankFee===null?0n:policyPence(f.bankFee),transferFee=f.transferFee===null?0n:policyPence(f.transferFee),charged=bankFee+transferFee;
   if(f.state!=='unknown'&&(bankFee<0n||transferFee<0n||charged>fee||policyPence(f.principalPaid!)!==(f.state==='success'?amount:0n)))return {status:'pending_review',reason:'PROVIDER_AMOUNT_OR_FEE_RECONCILIATION_REQUIRED'};
   await this.c.record(m,'payout_outcome',actor+':'+f.attempt,f.providerMessage,{...f,proof,policy:this.c.policy});
   if(f.state==='unknown')return {status:'held_unknown',attempt:f.attempt};
   const lines:any[]=[{accountId:job.hold,side:'debit',amount}];
   if(f.state==='failed'){for(const l of job.lots)lines.push({accountId:l.available,side:'credit',amount:BigInt(l.amount)});lines.push({accountId:job.bankHold,side:'credit',amount},{accountId:job.principalBank,side:'debit',amount});}
   else lines.push({accountId:job.bankHold,side:'credit',amount});
   const j=await this.c.post(m,lines);let expenseJournal:string|null=null,feeReleaseJournal:string|null=null;
   if(charged){const expenses:any[]=[{accountId:job.feeHold,side:'credit',amount:charged}];for(const [cost,kind] of [[bankFee,'bank_fee_expense'],[transferFee,'transfer_expense']] as const)if(cost){const expense=await this.c.account(m,'policy:payout-fees:'+kind,'platform',kind,'debit');expenses.push({accountId:expense,side:'debit',amount:cost});}expenseJournal=(await this.c.post(m,expenses)).journalId;}
   if(fee>charged)feeReleaseJournal=(await this.c.post(m,[{accountId:job.feeBank,side:'debit',amount:fee-charged},{accountId:job.feeHold,side:'credit',amount:fee-charged}])).journalId;
   const result={status:f.state==='success'?'paid':'released',state:f.state,attempt:f.attempt,currency:f.currency,quote:f.quote,principalPaid:f.principalPaid,bankFee:f.bankFee,transferFee:f.transferFee,originalJournal:p.journal,journal:j.journalId,expenseJournal,feeReleaseJournal,actor,proof,policy:this.c.policy};await this.c.record(m,'payout_terminal',actor,f.attempt,result,j.journalId);return result;
  });
 }
}
