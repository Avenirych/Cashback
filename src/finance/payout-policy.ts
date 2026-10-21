import {assertPence} from './money';
/** Pure internal policy, not authentication, a payout claim or external payment.
 * Facts must be obtained from independently verified sources by a trusted adapter.
 * B54/B64 supersede threshold-only policy; Q14 calendar arithmetic is unresolved.
 */
export interface PayoutFacts {
 principal:bigint; providerFee:bigint|null; ownFeeFunds:bigint;
 debtFree:boolean; restrictionsClear:boolean; principalCovered:boolean;
 feeUnassigned:boolean; budgetApproved:boolean; providerReady:boolean;
 recipientVerified:boolean; priorOutcome:'none'|'confirmed'|'unknown';
}
export function evaluatePayout(f:PayoutFacts,calendar?:{policy:'FINANCIAL_BUSINESS_POLICY_2026_10_20';allEligibleLotsMature:boolean}) {
 for(const amount of [f.principal,f.ownFeeFunds])assertPence(amount);
 if(f.providerFee!==null)assertPence(f.providerFee);
 const deferred=(reason:string)=>({status:'pending_review' as const,reason,principalPence:f.principal.toString(),moneyMovedPence:'0'});
 if(!['none','confirmed'].includes(f.priorOutcome))return deferred('PRIOR_PAYOUT_RECONCILIATION_REQUIRED');
 if(f.debtFree!==true)return deferred('DEBT_COLLECTION_REQUIRED');
 if([f.restrictionsClear,f.principalCovered,f.feeUnassigned,f.budgetApproved,f.providerReady,f.recipientVerified].some(x=>x!==true))return deferred('COVERAGE_BUDGET_PROVIDER_RECIPIENT_OR_RESTRICTIONS');
 if(f.providerFee===null)return deferred('FULL_PROVIDER_FEE_UNKNOWN');
 if(f.principal<=f.providerFee)return deferred('PRINCIPAL_MUST_EXCEED_FULL_FEE');
 if(f.ownFeeFunds<f.providerFee)return deferred('SEPARATE_PLATFORM_FEE_FUNDS_REQUIRED');
 // No 180-day approximation, guessed timezone/month-end or new date on transfer.
 if(f.principal<1000n&&!(calendar?.policy==='FINANCIAL_BUSINESS_POLICY_2026_10_20'&&calendar.allEligibleLotsMature===true))return deferred('SIX_CALENDAR_MONTH_POLICY_Q14_REQUIRED');
 return {status:'eligible_evaluation_only' as const,reason:f.principal>=1000n?'TEN_POUND_TRIGGER_ALL_GATES':'SIX_UTC_CALENDAR_MONTHS_ALL_GATES',principalPence:f.principal.toString(),platformFeePence:f.providerFee.toString(),moneyMovedPence:'0'};
}
