import {evaluatePayout,PayoutFacts} from './payout-policy';
const valid:PayoutFacts={principal:1000n,providerFee:100n,ownFeeFunds:100n,debtFree:true,restrictionsClear:true,principalCovered:true,feeUnassigned:true,budgetApproved:true,providerReady:true,recipientVerified:true,priorOutcome:'none'};
describe('B54/B64/B65 internal payout evaluation',()=>{
 it('evaluates full principal at threshold without deducting platform fee',()=>expect(evaluatePayout(valid)).toMatchObject({status:'eligible_evaluation_only',principalPence:'1000',platformFeePence:'100',moneyMovedPence:'0'}));
 it.each(['debtFree','restrictionsClear','principalCovered','feeUnassigned','budgetApproved','providerReady','recipientVerified'] as const)('fails closed on %s',field=>expect(evaluatePayout({...valid,[field]:false}).status).toBe('pending_review'));
 it.each([null,1000n,1001n])('requires known full fee and principal strictly above it: %s',providerFee=>expect(evaluatePayout({...valid,providerFee}).status).toBe('pending_review'));
 it('requires separate own fee liquidity and reconciliation of unknown outcome',()=>{
  expect(evaluatePayout({...valid,ownFeeFunds:99n}).reason).toBe('SEPARATE_PLATFORM_FEE_FUNDS_REQUIRED');
  expect(evaluatePayout({...valid,priorOutcome:'unknown'}).reason).toBe('PRIOR_PAYOUT_RECONCILIATION_REQUIRED');
 });
 it('does not invent six-month arithmetic or expire liabilities below threshold',()=>expect(evaluatePayout({...valid,principal:999n})).toMatchObject({status:'pending_review',reason:'SIX_CALENDAR_MONTH_POLICY_Q14_REQUIRED',principalPence:'999',moneyMovedPence:'0'}));
});
