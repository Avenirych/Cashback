import {createHash,randomUUID} from 'node:crypto';
import type {DataSource,EntityManager} from 'typeorm';
import {FinanceEventsService} from './finance-events.service';
import {planRevenue} from './business-policy';
import {assertPence} from './money';
import type {RevenueKind} from './money';
import type {Posting} from './ledger';
import {debtPriority,OWNER_POLICY} from './owner-policy';
export interface SettlementEvidence {
 actor:string; proof:string; eventKey:string; source:string; kind:RevenueKind;
 receipt:string|null; commissionPence:bigint; confirmed:boolean;
 finality:'satisfied'|'pending'|'unknown'; confirmedAt:string;
 bankingFees:bigint; transferExpenses:bigint; otherExpenses:bigint;
 expenseJournals:readonly string[]; futureCostsPence:bigint|null;
 currentBankEvidence:boolean; incomeClassificationApproved:boolean;
 coverageApproved:boolean; budgetApproved:boolean; paidExpensesVerified:boolean;
 platformIncomeAccount:string; orderSource?:string; orderId?:string;
}
export interface SettlementAuthority {
 /** Trusted verification of exact income/receipt correspondence, finality, expense
  * attribution and company-owned fee funding; never maps a public boolean to proof.
  * Called after the settlement gate; must not open another transaction or do I/O.
  */
 verify(manager:EntityManager,principal:string,reference:string):Promise<SettlementEvidence>;
}
export class DisabledSettlementAuthority implements SettlementAuthority {
 async verify():Promise<never>{throw new Error('SETTLEMENT_AUTHORITY_NOT_CONFIGURED');}
}
type Result={status:'completed'|'pending_review';amountPence:string;reason?:string;customerGross?:string;customerAvailable?:string;debtOffset?:string;platformGross?:string;platformNet?:string;journalId?:string;lotId?:string;policy?:string;debtAllocations?:{accountId:string;amountPence:string}[]};
/** Isolated internal settlement of one entire verified income receipt. No callback
 * transport, external bank call or AppModule integration. All funds remain in GBP.
 */
export class ReceiptSettlement {
 constructor(private readonly source:DataSource,private readonly events:FinanceEventsService,private readonly authority:SettlementAuthority=new DisabledSettlementAuthority()){}
 async execute(m:EntityManager,principal:string,reference:string):Promise<Result>{
  const runner=m?.queryRunner;if(m?.connection!==this.source||!runner||runner.connection!==this.source||runner.manager!==m||runner.isReleased||!runner.isTransactionActive)throw new Error('Active caller transaction required');
  await m.query('SELECT pg_advisory_xact_lock(726405,0)');
  await m.query('SELECT pg_advisory_xact_lock(726412,0)');
  const verified=await this.authority.verify(m,principal,reference);const v={...verified,expenseJournals:[...verified.expenseJournals].sort()};
  if(!/^[A-Za-z0-9:_-]{8,120}$/.test(v.eventKey)||!v.actor||!v.source||!v.proof)throw new Error('Verified stable income identities required');
  for(const amount of [v.commissionPence,v.bankingFees,v.transferExpenses,v.otherExpenses])assertPence(amount);
  if(!Number.isFinite(Date.parse(v.confirmedAt)))throw new Error('Verified confirmation timestamp required');
  await m.query('SELECT pg_advisory_xact_lock(726411,hashtext($1))',[v.actor]);
  const material=JSON.stringify([v.actor,v.source,v.kind,v.receipt,v.commissionPence.toString(),v.bankingFees.toString(),v.transferExpenses.toString(),v.otherExpenses.toString(),v.expenseJournals,v.confirmedAt,v.orderSource||null,v.orderId||null]);
  const hash=createHash('sha256').update(material).digest('hex'),key='settle:'+v.eventKey;
  const commands=await m.query('SELECT "requestHash",result FROM public.finance_domain_commands WHERE actor=$1 AND key=$2',[v.actor,key]) as {requestHash:string;result:Result}[];
  if(commands.length){if(commands[0].requestHash!==hash)throw new Error('SETTLEMENT_EVENT_CONFLICT');return commands[0].result;}
  const record=async(result:Result)=>{await m.query('INSERT INTO public.finance_domain_commands(id,actor,key,"requestHash",action,proof,command,result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)',[randomUUID(),v.actor,key,hash,'settle',v.proof,material,JSON.stringify(result)]);return result;};
  const review=(reason:string)=>record({status:'pending_review',amountPence:'0',reason});
  if(!v.currentBankEvidence||!v.incomeClassificationApproved||!v.coverageApproved||!v.budgetApproved)return review('VERIFIED_EVIDENCE_CLASSIFICATION_COVERAGE_BUDGET_REQUIRED');
  if(!v.confirmed||v.finality!=='satisfied')return review('CONFIRMATION_AND_FINALITY_REQUIRED');
  if(!v.receipt)return review('ACTUAL_MERCHANT_RECEIPT_REQUIRED');
  if(v.futureCostsPence===null||v.futureCostsPence!==0n)return review('FUTURE_COST_RECOGNITION_POLICY_REQUIRED');
  if(v.kind==='cashback'){
   const orders=await m.query('SELECT c."buyerReference" FROM public.finance_purchase_orders o JOIN public.finance_purchase_clicks c ON c.id=o."clickId" WHERE o."sourceNamespace"=$1 AND o."orderId"=$2 FOR UPDATE OF o,c',[v.orderSource,v.orderId]) as {buyerReference:string}[];
   if(orders.length!==1||orders[0].buyerReference!==v.actor)throw new Error('TRUSTED_ORDER_OWNERSHIP_REQUIRED');
   if((await m.query("SELECT to_regclass('public.finance_policy_records') AS present"))[0].present){
    if((await m.query("SELECT 1 FROM finance_policy_records WHERE kind='attribution_conflict' AND scope=$1 LIMIT 1",[JSON.stringify([v.orderSource,v.orderId])])).length)return review('ATTRIBUTION_CONFLICT');
   }
   // Same actor gate as lifecycle ingestion: a trusted but stale settlement proof
   // cannot ignore already recorded cancellation/refund evidence. No invented
   // reinstatement or proportional adjustment can clear an unresolved correction.
   if((await m.query("SELECT to_regclass('public.finance_purchase_evidence') AS present"))[0].present){
    const corrections=await m.query("SELECT 1 FROM public.finance_purchase_evidence WHERE \"orderSource\"=$1 AND \"orderId\"=$2 AND kind IN ('cancellation','full_refund','partial_refund') LIMIT 1",[v.orderSource,v.orderId]);
    if(corrections.length)return review('ORDER_CORRECTION_REVIEW_REQUIRED');
   }
  }
  const receipts=await m.query('SELECT r.*,l.id AS "fundingLot" FROM public.finance_bank_receipts r JOIN public.finance_funding_lots l ON l."receiptId"=r.id WHERE r.id=$1 FOR UPDATE OF r,l',[v.receipt]) as {amountPence:string;currency:string;verificationStatus:string;unallocatedAccountId:string;bankAccountId:string;fundingLot:string}[];
  if(receipts.length!==1||receipts[0].currency!=='GBP'||receipts[0].verificationStatus!=='verified')return review('VERIFIED_BANK_RECEIPT_REQUIRED');
  const receipt=receipts[0],gross=BigInt(receipt.amountPence),expenses=v.bankingFees+v.transferExpenses+v.otherExpenses;
  const plan=planRevenue({kind:v.kind,confirmed:v.confirmed,finality:v.finality,receivedPence:gross,commissionPence:v.commissionPence,costsPence:expenses,bankingFeesPence:v.bankingFees,transferExpensesPence:v.transferExpenses,otherCostsPence:v.otherExpenses,feeCoveragePence:expenses,customerCoveragePence:gross,budgetApproved:v.budgetApproved});
  if(plan.status!=='ready')return review(plan.reason);
  const previous=await m.query('SELECT source,receipt,"materialHash",result FROM public.finance_receipt_settlements WHERE source=$1 OR receipt=$2',[v.source,v.receipt]) as {source:string;receipt:string;materialHash:string;result:Result}[];
  if(previous.length){if(previous.length!==1||previous[0].source!==v.source||previous[0].receipt!==v.receipt||previous[0].materialHash!==hash)throw new Error('ECONOMIC_INCOME_IDENTITY_CONFLICT');return record(previous[0].result);}
  const coverageExists=(await m.query("SELECT to_regclass('public.finance_coverage_allocations') AS table"))[0].table;
  if(coverageExists){const trigger=await m.query("SELECT 1 FROM pg_trigger WHERE tgrelid='public.finance_coverage_allocations'::regclass AND tgname='finance_no_settled_coverage' AND tgenabled IN ('O','A')");if(!trigger.length)throw new Error('COVERAGE_WRITER_NOT_GUARDED');
   const coordinated=!!(await m.query("SELECT to_regclass('public.finance_receipt_repayments') AS present"))[0]?.present;
   if(coordinated){const [used]=await m.query('SELECT (COALESCE((SELECT sum(finance_active_coverage(id)) FROM finance_coverage_allocations WHERE "lotId"=$1),0)+COALESCE((SELECT sum(amount) FROM finance_receipt_repayments WHERE receipt=$2),0))::text AS n',[receipt.fundingLot,v.receipt]);if(BigInt(used.n)>0n)return review('RECEIPT_ALREADY_RESERVED_FOR_COVERAGE');}
   else if((await m.query('SELECT 1 FROM public.finance_coverage_allocations WHERE "lotId"=$1',[receipt.fundingLot])).length)return review('RECEIPT_ALREADY_RESERVED_FOR_COVERAGE');
  }
  let bankFees=0n,transfer=0n,other=0n;
  if(!v.paidExpensesVerified)return review('ACTUAL_EXPENSE_EVIDENCE_REQUIRED');
  if(new Set(v.expenseJournals).size!==v.expenseJournals.length)throw new Error('Duplicate expense evidence');
  for(const journal of v.expenseJournals){
   const rows=await m.query('SELECT p.side,p."amountPence",a.kind,a."ownerReference",a.id,j.sealed FROM public.finance_postings p JOIN public.finance_accounts a ON a.id=p."accountId" JOIN public.finance_journals j ON j.id=p."journalId" WHERE p."journalId"=$1',[journal]) as {side:string;amountPence:string;kind:string;ownerReference:string;id:string;sealed:boolean}[];
   if(rows.length<2||rows.some(r=>!r.sealed))throw new Error('Sealed expense journal required');
   for(const row of rows){const amount=BigInt(row.amountPence);if(row.side==='credit'){if(row.kind!=='company_bank_cash'||row.ownerReference!=='platform'||row.id===receipt.bankAccountId)throw new Error('CUSTOMER_FUNDS_CANNOT_PAY_PLATFORM_EXPENSES');}else if(row.kind==='bank_fee_expense')bankFees+=amount;else if(row.kind==='transfer_expense')transfer+=amount;else if(row.kind==='other_expense')other+=amount;else throw new Error('Unexpected expense posting');}
  }
  if(bankFees!==v.bankingFees||transfer!==v.transferExpenses||other!==v.otherExpenses)throw new Error('EXPENSE_EVIDENCE_MISMATCH');
  const platform=await m.query('SELECT kind,"ownerReference" FROM public.finance_accounts WHERE id=$1',[v.platformIncomeAccount]);if(platform.length!==1||platform[0].kind!=='platform_income'||platform[0].ownerReference!=='platform')throw new Error('PLATFORM_INCOME_ACCOUNT_REQUIRED');
  let debts=await m.query('SELECT d.*,a."balancePence" FROM public.finance_verified_debts d JOIN public.finance_accounts a ON a.id=d.account WHERE d.debtor=$1 AND a."balancePence">0 ORDER BY d.id FOR UPDATE OF a',[v.actor]) as {id:string;account:string;balancePence:string;cap:string}[];
  let ownerPriority=false;
  if(debts.length>1){
   if(!(await m.query("SELECT to_regclass('public.finance_policy_debt_evidence') AS present"))[0].present)return review('MULTIPLE_DEBT_PRIORITY_UNRESOLVED');
   const times=await m.query('SELECT debt,to_char("confirmedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS confirmed FROM finance_policy_debt_evidence WHERE debt=ANY($1::uuid[])',[debts.map(d=>d.id)]) as {debt:string;confirmed:string}[];
   const ordered=debtPriority(debts.map(d=>({...d,confirmedAt:times.find(t=>t.debt===d.id)?.confirmed||null})));
   if(ordered.status!=='ready')return review('MULTIPLE_DEBT_PRIORITY_UNRESOLVED');debts=ordered.debts;ownerPriority=true;
  }
  const user=plan.plan.customerLiability;let offset=0n;
  const offsets:{accountId:string;amount:bigint}[]=[];let remaining=user;
  for(const debt of debts){const due=BigInt(debt.balancePence);if(due>BigInt(debt.cap))throw new Error('Debt exceeds verified cap');const amount=due<remaining?due:remaining;if(amount){offsets.push({accountId:debt.account,amount});remaining-=amount;offset+=amount;}}
  const settlement=randomUUID(),postings:Posting[]=[{accountId:receipt.unallocatedAccountId,side:'debit',amount:gross}];let lotId:string|undefined;
  if(user>0n){lotId=randomUUID();const available=randomUUID(),reserved=randomUUID(),kind=v.kind==='cashback'?'withdrawal_gbp':'bonus';
   for(const [id,k] of [[available,kind==='bonus'?'bonus_liability':'user_gbp'],[reserved,'reserved']])await m.query('INSERT INTO public.finance_accounts(id,"accountKey",kind,"ownerReference",currency,"normalSide",nonnegative) VALUES($1,$2,$3,$4,$5,$6,true)',[id,'settle:'+id,k,v.actor,'GBP','credit']);
   await m.query('INSERT INTO public.finance_bonus_lots(id,owner,origin,responsible,"confirmedAt",kind,available,reserved) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[lotId,v.actor,v.source,v.actor,v.confirmedAt,kind,available,reserved]);
   postings.push({accountId:available,side:'credit',amount:user});if(offset){postings.push({accountId:available,side:'debit',amount:offset},...offsets.map(d=>({accountId:d.accountId,side:'credit' as const,amount:d.amount})));}
  }
  if(plan.plan.platformShare>0n)postings.push({accountId:v.platformIncomeAccount,side:'credit',amount:plan.plan.platformShare});
  const journal=await this.events.postEventWithManager(m,{type:'finance.journal.posted',schemaVersion:1,eventId:randomUUID(),idempotencyKey:'income:'+settlement,operationId:settlement,createdAt:new Date().toISOString(),data:{currency:'GBP'}},postings);
  const result:Result={status:'completed',amountPence:gross.toString(),customerGross:user.toString(),customerAvailable:(user-offset).toString(),debtOffset:offset.toString(),platformGross:plan.plan.platformShare.toString(),platformNet:plan.plan.platformNetIncome.toString(),journalId:journal.journalId,...(lotId?{lotId}:{})};
  if(ownerPriority){result.policy=OWNER_POLICY;result.debtAllocations=offsets.map(d=>({accountId:d.accountId,amountPence:d.amount.toString()}));}
  await m.query('INSERT INTO public.finance_receipt_settlements(id,source,receipt,actor,"materialHash",gross,"userGross","platformGross",expenses,"debtOffset",lot,journal,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)',[settlement,v.source,v.receipt,v.actor,hash,gross.toString(),user.toString(),plan.plan.platformShare.toString(),expenses.toString(),offset.toString(),lotId||null,journal.journalId,JSON.stringify(result)]);
  for(const expense of v.expenseJournals)await m.query('INSERT INTO public.finance_settlement_expenses(journal,settlement) VALUES($1,$2)',[expense,settlement]);
  return record(result);
 }
}
