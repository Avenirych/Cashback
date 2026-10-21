import { planRevenue, planDebtCollection, selectBonusOrder, unresolvedAdjustment } from './business-policy';
import type { RevenueFacts, ConfirmedSource } from './business-policy';
const received: RevenueFacts = { kind:'cashback', confirmed:true, finality:'satisfied', receivedPence:1000n,
  commissionPence:1000n, costsPence:100n, bankingFeesPence:20n,transferExpensesPence:30n,otherCostsPence:50n,
  feeCoveragePence:100n, customerCoveragePence:800n, budgetApproved:true };
describe('Confirmed historical business policy (planning only)',()=>{
  it('separates receipts, customer liabilities, expenses and platform net income',()=>{
    expect(planRevenue(received)).toEqual({status:'ready',plan:{received:1000n,customerLiability:800n,platformShare:200n,expenses:100n,bankingFees:20n,transferExpenses:30n,otherCosts:50n,platformNetIncome:100n}});
  });
  it('does not release funds on confirmation without actual receipt',()=>expect(planRevenue({...received,receivedPence:0n}).status).toBe('blocked'));
  it.each(['pending','unknown'] as const)('actual received funds do not bypass %s finality',finality=>expect(planRevenue({...received,finality})).toEqual({status:'blocked',reason:'REFUND_FINALITY_REQUIRED'}));
  it('does not allocate a receipt before confirmation',()=>expect(planRevenue({...received,confirmed:false}).status).toBe('blocked'));
  it('requires known separate expenses reconciled to their total',()=>{
    expect(planRevenue({...received,bankingFeesPence:null})).toEqual({status:'blocked',reason:'EXPENSE_BREAKDOWN_REQUIRED'});
    expect(planRevenue({...received,costsPence:99n})).toEqual({status:'blocked',reason:'EXPENSE_RECONCILIATION_REQUIRED'});
  });
  it.each([null,200n,201n])('fails closed for unknown or nonpositive margin costs %s',costsPence=>expect(planRevenue({...received,costsPence}).status).toBe('blocked'));
  it('does not treat a partial/over receipt as the full payable commission',()=>{
    for(const receivedPence of [999n,1001n]) expect(planRevenue({...received,receivedPence}).status).toBe('blocked');
  });
  it('requires customer coverage, fee coverage and budget independently',()=>{
    for(const patch of [{customerCoveragePence:799n},{feeCoveragePence:99n},{budgetApproved:false}]) expect(planRevenue({...received,...patch}).status).toBe('blocked');
  });
  it.each([['rewarded_advertising',800n],['research_referral',500n],['passive_advertising',0n]] as const)('preserves %s share', (kind,customer)=>{
    const result=planRevenue({...received,kind}); expect(result.status).toBe('ready');
    if(result.status!=='ready')throw Error('Expected allocation plan');
    expect(result.plan.customerLiability).toBe(customer);
    expect(result.plan.customerLiability+result.plan.platformNetIncome+result.plan.expenses).toBe(result.plan.received);
  });
  const source=(id:string,patch:Partial<ConfirmedSource>={}):ConfirmedSource=>({id,ownerId:'debtor',confirmed:true,availablePence:100n,actualFundsPence:100n,protectedReservation:false,...patch});
  it('collects from multiple own confirmed monetary sources and caps the obligation',()=>{
    expect(planDebtCollection('debtor',150n,[source('cashback'),source('bonus'),source('GBP')])).toEqual({allocations:[{sourceId:'cashback',amountPence:100n},{sourceId:'bonus',amountPence:50n}],collectedPence:150n,outstandingPence:0n});
  });
  it('requires actual funds and excludes unrelated recipients, pending and protected sources',()=>{
    const result=planDebtCollection('debtor',200n,[source('partial',{actualFundsPence:20n}),source('other',{ownerId:'recipient'}),source('pending',{confirmed:false}),source('reserved',{protectedReservation:true})]);
    expect(result.collectedPence).toBe(20n); expect(result.outstandingPence).toBe(180n);
  });
  it('refuses duplicate source references and never collects zero debt',()=>{
    expect(()=>planDebtCollection('debtor',100n,[source('x'),source('x')])).toThrow('Duplicate');
    expect(planDebtCollection('debtor',0n,[source('x')]).allocations).toEqual([]);
  });
  it('selects one highest eligible order only after approved metric and finality',()=>{
    const orders=[{id:'a',eligible:true,comparableCostPence:100n},{id:'b',eligible:true,comparableCostPence:200n}];
    expect(selectBonusOrder(orders,{metricApproved:true,groupFinal:true})).toEqual({status:'ready',plan:{orderId:'b'}});
    expect(selectBonusOrder(orders,{metricApproved:true,groupFinal:false}).status).toBe('blocked');
    expect(selectBonusOrder(orders,{metricApproved:false,groupFinal:true}).status).toBe('blocked');
  });
  it('does not guess tie rules or silently accept duplicate orders',()=>{
    const order={id:'a',eligible:true,comparableCostPence:100n};
    expect(selectBonusOrder([order,{...order,id:'b'}],{metricApproved:true,groupFinal:true}).status).toBe('blocked');
    expect(()=>selectBonusOrder([order,order],{metricApproved:true,groupFinal:true})).toThrow('Duplicate');
  });
  it.each(['full_refund','partial_refund','cancellation'] as const)('blocks unknown %s with no money movement',kind=>expect(unresolvedAdjustment(kind).moneyMovedPence).toBe(0n));
});
