import {PolicyPayout} from './policy-payout';
import {POLICY_21} from './policy-2026-10-21';
import {AddBonusUseTerms1793200000000} from './migrations/1793200000000-AddBonusUseTerms';
function payout(bonus:string,money:string){
 const all=[{id:'bonus',owner:'buyer',available:'bonus-free',balancePence:bonus,confirmed:'2026-01-01T00:00:00Z',applicationUntil:'2026-05-01T00:00:00Z'},{id:'cashback',owner:'buyer',available:'cash-free',balancePence:money,confirmed:'2026-01-01T00:00:00Z'}].filter(x=>BigInt(x.balancePence)>0n);
 const total=(BigInt(bonus)+BigInt(money)).toString(),posts:any[]=[];
 const m:any={query:jest.fn(async(sql:string)=>{
  if(sql.startsWith('SELECT key'))return[];
  if(sql.startsWith('SELECT l.*,a.'))return all;
  if(sql.startsWith('SELECT l.id'))return all.map(x=>({id:x.id}));
  if(sql.startsWith('SELECT 1 FROM finance_verified_debts'))return[];
  if(sql.startsWith('SELECT * FROM finance_accounts'))return ['fee-bank','principal-bank'].map(id=>({id,kind:'company_bank_cash',ownerReference:'platform',normalSide:'debit',balancePence:'100000'}));
  throw Error('Unexpected payout query '+sql);
 })};
 const c:any={policy:POLICY_21,enter:async()=>({actor:'buyer',proof:'verified',facts:{lots:all.map(x=>x.id),currency:'GBP',expectedPrincipal:total,fee:'1',quote:'verified-quote',quoteExpires:'2026-07-02T00:00:00Z',feeBank:'fee-bank',principalBank:'principal-bank',providerVerified:true,recipientVerified:true,coverageVerified:true,budgetApproved:true,restrictionsClear:true}}),command:async(_m:any,_a:any,_k:any,_v:any,run:any)=>run(),serverReceiptTime:async()=> '2026-07-01T00:00:00Z',account:async(_m:any,key:string)=>key,post:async(_m:any,lines:any[])=>{posts.push(lines);return{journalId:'held-journal'};},record:async()=>{}};
 return{m,posts,run:()=>new PolicyPayout(c).claim(m,'principal','payout-key','reference')};
}
describe('application deadline does not extinguish payout liability or rewrite payout rules',()=>{
 it.each([['999','1','1000'],['1000','0','1000'],['990','11','1001']])('combined bonus/cashback payout at/above ten GBP: %s + %s',async(b,c,total)=>{
  const x=payout(b,c),r=await x.run();expect(r.status).toBe('held');expect(r.principal).toBe(total);
  expect(x.posts[0]).toContainEqual({accountId:'bonus-free',side:'debit',amount:BigInt(b)});
  expect(x.m.query.mock.calls.some(([sql]:[string])=>sql.includes('finance_bonus_use_terms'))).toBe(false);
 });
 it('preserves the separately approved mature-below-ten payout rule',async()=>{
  const r=await payout('999','0').run();expect(r.status).toBe('held');expect(r.principal).toBe('999');
 });
 it('migration is additive, immutable and does not backfill or delete money',async()=>{
  const sql:string[]=[];await new AddBonusUseTerms1793200000000().up({query:async(s:string)=>{sql.push(s);}} as any);
  expect(sql.join('')).toContain('Historical transition not approved');expect(sql.join('')).toContain('finance_domain_immutable');
  expect(sql.join('')).not.toMatch(/UPDATE\s+finance_(?:bonus_lots|accounts|postings)/i);
  expect(sql.join('')).toContain('r."receivedAt"');
 });
 it('refuses destructive migration rollback when application history exists',async()=>{
  await expect(new AddBonusUseTerms1793200000000().down({query:async()=>[{n:1}]} as any)).rejects.toThrow('destructive rollback refused');
 });
});
