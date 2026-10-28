import {applicationWindow,canApply,bonusUnits,unitsText,purchaseCap,bonusView} from './bonus-use-policy';
import {BonusUseTerms} from './bonus-use-terms';
import {POLICY_21} from './policy-2026-10-21';
describe('approved bonus application rules 2026-10-28',()=>{
 it.each([
 ['2026-08-31T12:13:14.123456Z','2027-02-28T12:13:14.123456Z'],
 ['2023-08-31T00:00:00Z','2024-02-29T00:00:00.000000Z'],
 ['2024-02-29T00:00:00Z','2024-08-29T00:00:00.000000Z'],
 ['2026-01-31T23:59:59Z','2026-07-31T23:59:59.000000Z'],
 ])('six UTC calendar months with clamping: %s',(from,until)=>expect(applicationWindow(from,'receipt','verified').until).toBe(until));
 it('rejects timezone ambiguity and invalid dates',()=>{
  for(const d of ['2026-02-30T00:00:00Z','2026-01-01T00:00:00+01:00','2026-01-01'])expect(()=>applicationWindow(d,'receipt','r')).toThrow();
 });
 const w=applicationWindow('2026-01-01T00:00:00Z','receipt','r');
 it('allows application from actual receipt, not before it',()=>{
  expect(canApply(w,'2025-12-31T23:59:59Z')).toBe(false);
  expect(canApply(w,'2026-01-01T00:00:00Z')).toBe(true);
 });
 it('application ends exactly at six months without cancelling units or payout',()=>{
  expect(canApply(w,w.until)).toBe(false);
  expect(bonusView(12345n,12345n,w,w.until)).toEqual({bonusUnits:'123.45',applicationValuePence:'12345',payablePence:'12345',canApplyToPurchase:false,applicationUntil:w.until});
 });
 it('transfer renews only recipient application window, not parent or payout age',()=>{
  const original={window:w,confirmedAt:'2026-01-01T00:00:00Z',amount:10000n};
  const child=applicationWindow('2026-05-31T01:00:00Z','transfer','completed');
  expect(child.until).toBe('2026-11-30T01:00:00.000000Z');
  expect(original.window).toBe(w);expect(original.confirmedAt).toBe('2026-01-01T00:00:00Z');
 });
 it.each([['0.01',1n],['0.29',29n],['150',15000n],['1234567890.12',123456789012n]])('exact bonus units %s',(text,value)=>{
  expect(bonusUnits(text)).toBe(value);expect(bonusUnits(unitsText(value))).toBe(value);
 });
 it.each(['-1','1e2','0.001','NaN','01.00','1.'])('rejects invalid units %s',v=>expect(()=>bonusUnits(v)).toThrow());
 it.each([
  [10000n,1250n,10000n,8750n],
  [10000n,10000n,10000n,0n],
  [10000n,0n,1234n,1234n],
  [100n,99n,100n,1n]
 ])('purchase ceiling preserves merchant cap and pennies',(p,c,m,cap)=>expect(purchaseCap(p,c,m)).toEqual({status:'ready',cap}));
 it('never changes cashback exceeding product value',()=>expect(purchaseCap(100n,101n,100n)).toEqual({status:'pending_review',reason:'CASHBACK_EXCEEDS_PRODUCT_PRICE'}));
 it('unknown cashback does not become zero',async()=>{
  const t=new BonusUseTerms({policy:POLICY_21} as any);
  expect(await t.cap({},undefined)).toEqual({status:'pending_review',reason:'VERIFIED_POSSIBLE_CASHBACK_REQUIRED'});
 });
 it('does not mix decimal bonus values with float financial input',()=>{
  expect(()=>purchaseCap(1.1 as any,0n,1n)).toThrow();
 });
});
