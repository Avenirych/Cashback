import {BonusUseSnapshot} from './bonus-use-snapshot';
import {applicationWindow} from './bonus-use-policy';
function fixture(rows:any[]=[]){
 const source:any={},queryRunner:any={connection:source,isReleased:false,isTransactionActive:true},m:any={connection:source,queryRunner};queryRunner.manager=m;
 m.query=jest.fn(async(sql:string)=>sql.startsWith('SHOW')?[{transaction_read_only:'on'}]:sql.includes('clock_timestamp')?[{t:'2026-10-28T12:00:00.000000Z'}]:rows);
 const authority={resolveOwner:jest.fn(async()=> 'verified-owner')};
 return{source,m,authority,read:()=>new BonusUseSnapshot(source,authority).read(m,'authenticated-principal')};
}
const row=(patch:any={})=>({id:'own-lot',kind:'bonus',currency:'GBP',free:'800',reserved:'25',...patch});
describe('prepared bonus read model: no public activation or financial actions',()=>{
 it('default authority denies before financial reads',async()=>{
  const x=fixture();await expect(new BonusUseSnapshot(x.source).read(x.m,'x')).rejects.toThrow('AUTHORITY_NOT_CONFIGURED');expect(x.m.query).not.toHaveBeenCalled();
 });
 it('requires an active same-source transaction',async()=>{
  const x=fixture();x.m.queryRunner.isTransactionActive=false;await expect(x.read()).rejects.toThrow('Active caller');expect(x.authority.resolveOwner).not.toHaveBeenCalled();
 });
 it('requires a read-only transaction',async()=>{
  const x=fixture();x.m.query.mockResolvedValue([{transaction_read_only:'off'}]);await expect(x.read()).rejects.toThrow('Read-only transaction');
 });
 it('uses exclusively the server-resolved owner and SELECTs; no public user selector',async()=>{
  const x=fixture();await x.read();const q=x.m.query.mock.calls.find(([sql]:[string])=>sql.includes('finance_bonus_lots'))!;
  expect(q[0]).toContain('WHERE l.owner=$1');expect(q[1]).toEqual(['verified-owner']);expect(x.authority.resolveOwner).toHaveBeenCalledWith(x.m,'authenticated-principal');expect(x.m.query.mock.calls.every(([sql]:[string])=>/^SELECT|^SHOW/.test(sql))).toBe(true);
 });
 it('expired application leaves precise free/reserved balances and bonus units intact',async()=>{
  const x=fixture([row(applicationWindow('2025-01-31T00:00:00.000000Z','receipt','evidence'))]);const r=await x.read();
  expect(r.lots[0]).toMatchObject({freePence:'800',purchaseReservedPence:'25',bonusUnits:{free:'8.00',purchaseReserved:'0.25'},application:{state:'expired'}});expect(r.payoutEligibility).toBe('not_evaluated');
 });
 it('does not mislabel a future window as expired',async()=>{const r=await fixture([row(applicationWindow('2027-01-01T00:00:00.000000Z','receipt','evidence'))]).read();expect(r.lots[0].application.state).toBe('not_started');});
 it('unknown historical terms are unknown, with no invented dates or zero balances',async()=>{
  const r=await fixture([row()]).read();expect(r.lots[0].application).toEqual({state:'unknown',startedAt:null,until:null});expect(r.lots[0].freePence).toBe('800');
 });
 it('withdrawal-only money has no bonus units or purchase eligibility',async()=>{
  const r=await fixture([row({kind:'withdrawal_gbp'})]).read();expect(r.lots[0].bonusUnits).toBeNull();expect(r.lots[0].application.state).toBe('not_applicable');expect(r.lots[0].payoutCurrency).toBe('GBP');
 });
 it('does not round financial values through JavaScript numbers',async()=>{
  const r=await fixture([row({free:'9007199254740993'})]).read();expect(r.lots[0].freePence).toBe('9007199254740993');expect(r.lots[0].bonusUnits?.free).toBe('90071992547409.93');
 });
 it('does not fabricate a fallback snapshot on database failure',async()=>{
  const x=fixture();x.m.query.mockRejectedValue(Error('database unavailable'));await expect(x.read()).rejects.toThrow('database unavailable');
 });
 it('rejects malformed currency and owner mappings',async()=>{
  await expect(fixture([row({currency:'USD'})]).read()).rejects.toThrow('denomination');const x=fixture();x.authority.resolveOwner.mockResolvedValue('');await expect(x.read()).rejects.toThrow('Verified ledger owner');
 });
});
