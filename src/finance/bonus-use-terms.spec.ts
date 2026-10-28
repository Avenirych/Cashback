import {BonusUseTerms} from './bonus-use-terms';
import {ApprovedBonusOperations} from './approved-bonus-operations';
import {POLICY_21} from './policy-2026-10-21';
function setup(basis:'receipt'|'transfer',historical=false){
 const source={} as any,writes:any[]=[];
 const m:any={connection:source,queryRunner:null,query:jest.fn(async(sql:string,args:any[])=>{
  if(sql.startsWith('SELECT basis'))return[];
  if(sql.includes('CROSS JOIN finance_bonus_use_activation'))return[{eligible:!historical}];
  if(sql.includes('r."receivedAt"'))return[{t:'2026-08-31T12:00:00.123456Z'}];
  if(sql.startsWith('SELECT 1 FROM finance_lot_transfers'))return[{}];
  if(sql.startsWith('INSERT INTO finance_bonus_use_terms')){writes.push(args);return[];}
  return[];
 })};m.queryRunner={connection:source,manager:m,isReleased:false,isTransactionActive:true};
 const c:any={source,policy:POLICY_21,serverReceiptTime:async()=> '2026-10-31T10:00:00.000001Z'};
 return{m,c,writes,terms:new BonusUseTerms(c),basis};
}
describe('new immutable application terms, isolated transaction contract',()=>{
 it('anchors to verified actual receipt time, not confirmation/order time',async()=>{
  const x=setup('receipt');await x.terms.attach(x.m,'lot','receipt','receipt');
  expect(x.writes[0].slice(4)).toEqual(['2026-08-31T12:00:00.123456Z','2027-02-28T12:00:00.123456Z']);
 });
 it('new transfer window uses server completion time with month-end clamp',async()=>{
  const x=setup('transfer');await x.terms.attach(x.m,'child','transfer','completed-transfer');
  expect(x.writes[0].slice(4)).toEqual(['2026-10-31T10:00:00.000001Z','2027-04-30T10:00:00.000001Z']);
 });
 it('does not silently enroll a historical settled lot',async()=>{
  const x=setup('receipt',true);await x.terms.attach(x.m,'old','receipt','receipt');expect(x.writes).toEqual([]);
 });
 it('missing actual receipt cannot create a term',async()=>{
  const x=setup('receipt'),query=x.m.query;
  x.m.query=async(sql:string,args:any[])=>sql.includes('r."receivedAt"')?[]:query(sql,args);
  await expect(x.terms.attach(x.m,'lot','receipt','missing')).rejects.toThrow('Settled verified');
  expect(x.writes).toEqual([]);
 });
 it('missing terms are unavailable, not an invented new date or zero',async()=>{
  const x=setup('receipt');await expect(x.terms.eligibility(x.m,['unknown'],'2026-11-01T00:00:00Z')).rejects.toThrow('HISTORICAL_TRANSITION');
 });
 it('requires active same-source transaction',async()=>{
  const x=setup('receipt');x.m.queryRunner.isTransactionActive=false;
  await expect(x.terms.attach(x.m,'lot','receipt','r')).rejects.toThrow('Active caller');
 });
 it('same transfer replay never resets the window',async()=>{
  const x=setup('transfer');x.m.query=async(sql:string)=>sql.startsWith('SELECT basis')?[{basis:'transfer',reference:'completed'}]:[];
  await x.terms.attach(x.m,'child','transfer','completed');expect(x.writes).toEqual([]);
  await expect(x.terms.attach(x.m,'child','transfer','another')).rejects.toThrow('conflict');
 });
 it('keeps existing payout service and propagates transfer metadata failure for outer rollback',async()=>{
  const x=setup('transfer');const lots={execute:jest.fn(async()=>({status:'completed',lotId:'child'}))};
  const op=new ApprovedBonusOperations(x.c,{} as any,lots as any);
  expect(op.payout.constructor.name).toBe('PolicyPayout');
  await expect(op.transfer(x.m,'actor','stable-key',{action:'transfer',lot:'parent',recipient:'recipient',amount:100n})).rejects.toThrow('Completed transfer history');
  expect(lots.execute).toHaveBeenCalledTimes(1);
 });
});
