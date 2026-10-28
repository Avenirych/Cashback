'use strict';
// Synthetic independent submitter/reviewer, actual EvidenceService and SQL constraints.
module.exports=async function(h,actor,receivedAt='2026-10-01T00:00:00.000Z'){
 const {randomUUID:id}=require('node:crypto'),assert=require('node:assert/strict');
 const {EvidenceService}=require('../../src/finance/evidence.service');
 const {BankReceiptsService,bankScopeKey}=require('../../src/finance/bank-receipts.service');
 const {runtime,owner,events}=h,submitter=id(),reviewer=id(),evidenceReference=id();
 const facts={sourceNamespace:'synthetic:bonususe',accountScope:id(),transactionId:'bank:'+id(),currency:'GBP',amountPence:1000n,receivedAt};
 const evidence=new EvidenceService(runtime,{
  authorize:async(_m,p,action)=>{assert([submitter,reviewer].includes(p));return{principalId:p,role:action==='submit'?'evidence_submitter':'evidence_reviewer'}},
  inspect:async(_m,e,f)=>({...f,status:'verified',verificationId:id(),evidenceReference:e,verifierReference:'synthetic:bank'}),
  assertVerificationEnabled:async()=>{},verifyReviewDocument:async()=>{}
 });
 const obs=await runtime.transaction(m=>evidence.observeWithManager(m,submitter,{commandKey:'observe:'+id(),evidenceReference,source:facts.sourceNamespace,accountScope:facts.accountScope,nativeId:facts.transactionId,ambiguous:false}));
 await runtime.transaction(m=>evidence.approveWithManager(m,reviewer,'approve:'+id(),obs.observationId,facts));
 const bank=id(),unallocated=id(),platform=id(),scope=bankScopeKey(facts.sourceNamespace,facts.accountScope);
 await owner.query('INSERT INTO finance_accounts(id,"accountKey",kind,"ownerReference","normalSide",nonnegative) VALUES($1,$2,\'company_bank_cash\',\'platform\',\'debit\',true),($3,$4,\'unallocated_received_funds\',\'platform\',\'credit\',true),($5,$6,\'platform_income\',\'platform\',\'credit\',true)',[bank,'bank_cash:'+scope,unallocated,'bank_unallocated:'+scope,platform,'test:'+platform]);
 const r=await runtime.transaction(m=>new BankReceiptsService(runtime,events,evidence).registerWithManager(m,{...facts,evidenceReference,bankAccountId:bank,unallocatedAccountId:unallocated}));
 const v={actor:actor||'income:'+id(),proof:'synthetic:proof',eventKey:'event:'+id(),source:'income:'+id(),kind:'rewarded_advertising',receipt:r.receiptId,commissionPence:1000n,confirmed:true,finality:'satisfied',confirmedAt:'2026-10-01T00:00:00.000Z',bankingFees:0n,transferExpenses:0n,otherExpenses:0n,expenseJournals:[],futureCostsPence:0n,currentBankEvidence:true,incomeClassificationApproved:true,coverageApproved:true,budgetApproved:true,paidExpensesVerified:true,platformIncomeAccount:platform};
 return{v,unallocated,platform};
};
