import { gbpToPence, percentageOfGbp, splitRevenue, MAX_PENCE } from './money';
import { validatePostings, balanceAfter } from './ledger';
import type { RevenueKind } from './money';
import { FinanceService } from './finance.service';
import { DataSource } from 'typeorm';
import { CreateFinanceCore1791890000000 } from './migrations/1791890000000-CreateFinanceCore';
import type { QueryRunner } from 'typeorm';
const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002';
const lines = [{accountId:a,side:'debit' as const,amount:5n},{accountId:b,side:'credit' as const,amount:5n}];
describe('Exact GBP arithmetic', () => {
 it.each([['0',0n],['0.004999',0n],['0.005',1n],['0.014999',1n],['0.015',2n],['1.005',101n],['92233720368547758.07',MAX_PENCE]])('rounds %s HALF_UP', (value,want)=>expect(gbpToPence(value)).toBe(want));
 it.each(['-1','NaN','1e3','1,00',' 1','01','1.','92233720368547758.08'])('rejects %s',v=>expect(()=>gbpToPence(v)).toThrow());
 it('multiplies decimal intermediates exactly',()=>expect(percentageOfGbp('0.10','5')).toBe(1n));
 it.each([['cashback',80n,20n],['rewarded_advertising',80n,20n],['research_referral',50n,50n],['passive_advertising',0n,100n]] as const)('splits %s', (kind,user,platform)=>expect(splitRevenue(100n,kind)).toEqual({total:100n,user,platform}));
 it('gives remainder to platform after user rounding',()=>expect(splitRevenue(1n,'research_referral')).toEqual({total:1n,user:1n,platform:0n}));
 it.each(['cashback','rewarded_advertising','research_referral','passive_advertising'] as RevenueKind[])('conserves pennies for %s',kind=>{ for(const total of [0n,1n,2n,3n,101n,MAX_PENCE]) { const x=splitRevenue(total,kind); expect(x.user+x.platform).toBe(total); expect(x.platform>=0n).toBe(true); } });
 it('rejects unknown source and number inputs',()=>{expect(()=>splitRevenue(1n,'unknown' as RevenueKind)).toThrow();expect(()=>gbpToPence(1 as unknown as string)).toThrow();});
});
describe('Posting invariants',()=>{
 it('accepts balanced debit/credit',()=>expect(()=>validatePostings(lines)).not.toThrow());
 it('rejects imbalance',()=>expect(()=>validatePostings([lines[0],{...lines[1],amount:4n}])).toThrow('Unbalanced'));
 it.each([0n,-1n,MAX_PENCE+1n])('rejects invalid posting amount %s',amount=>expect(()=>validatePostings([{...lines[0],amount},lines[1]])).toThrow());
 it('rejects invalid identity/side and single line',()=>{expect(()=>validatePostings([{...lines[0],accountId:'bad'},lines[1]])).toThrow();expect(()=>validatePostings([{...lines[0],side:'bad' as 'debit'},lines[1]])).toThrow();expect(()=>validatePostings([lines[0]])).toThrow();});
 it('prevents negative available balance',()=>expect(()=>balanceAfter(4n,'credit',-5n,true)).toThrow());
 it('accepts exact depletion and signed clearing',()=>{expect(balanceAfter(5n,'credit',-5n,true)).toBe(0n);expect(balanceAfter(0n,'debit',-5n,false)).toBe(-5n);});
 it('rejects overflow',()=>expect(()=>balanceAfter(MAX_PENCE,'credit',1n,true)).toThrow());
});
describe('Financial events with mocked transactional manager only',()=>{
 function harness(balance='0') {
  let saved: {id:string; requestHash:string; sealed:boolean} | undefined;
  const query=jest.fn(async(sql:string,params:unknown[]=[])=>{
   if(sql.startsWith('SELECT id,')) return saved ? [saved] : [];
   if(sql.startsWith('SELECT *')) return [{id:a,currency:'GBP',normalSide:'debit',nonnegative:false,balancePence:'0'},{id:b,currency:'GBP',normalSide:'credit',nonnegative:true,balancePence:balance}];
   if(sql.startsWith('INSERT INTO finance_journals')) saved={id:params[0] as string,requestHash:params[2] as string,sealed:false};
   if(sql.startsWith('UPDATE finance_journals')) saved!.sealed=true;
   return [];
  });
  const dataSource = {} as DataSource;
  const manager = {query,connection:dataSource} as unknown as import('typeorm').EntityManager;
  Object.assign(manager,{queryRunner:{connection:dataSource,manager,isReleased:false,isTransactionActive:true}});
  const transaction=jest.fn(async(work:(m:unknown)=>Promise<unknown>)=>work(manager));
  Object.assign(dataSource,{transaction});
  return {service:new FinanceService(dataSource),query,transaction};
 }
 it('posts once and replays equivalent reordered event',async()=>{const h=harness();const first=await h.service.post('event:test:001',lines);expect(first.replay).toBe(false);const second=await h.service.post('event:test:001',[...lines].reverse());expect(second).toEqual({...first,replay:true});expect(h.query.mock.calls.filter(([s])=>s.startsWith('INSERT INTO finance_postings'))).toHaveLength(2);});
 it('rejects key reuse with different content',async()=>{const h=harness();await h.service.post('event:test:001',lines);await expect(h.service.post('event:test:001',lines.map(l=>({...l,amount:6n})))).rejects.toThrow('conflict');});
 it('rejects negative funds before inserting journal',async()=>{const h=harness();await expect(h.service.post('event:test:002',lines.map(l=>({...l,side:l.side==='debit'?'credit':'debit'})))).rejects.toThrow('Insufficient');expect(h.query.mock.calls.some(([s])=>s.startsWith('INSERT'))).toBe(false);});
 it('rejects imbalance before opening transaction',async()=>{const h=harness();await expect(h.service.post('event:test:003',[lines[0],{...lines[1],amount:6n}])).rejects.toThrow();expect(h.transaction).not.toHaveBeenCalled();});
 it('propagates DB failure without retry',async()=>{const h=harness();h.query.mockRejectedValueOnce(new Error('Synthetic DB failure'));await expect(h.service.post('event:test:004',lines)).rejects.toThrow('Synthetic DB failure');expect(h.transaction).toHaveBeenCalledTimes(1);});
});
describe('Prepared migration (no PostgreSQL)',()=>{
 it('defines isolated tables, balanced deferred checks and immutability guards',async()=>{const query=jest.fn();await new CreateFinanceCore1791890000000().up({query} as unknown as QueryRunner);const sql=query.mock.calls[0][0] as string;expect([...sql.matchAll(/CREATE TABLE (\w+)/g)].map(m=>m[1])).toEqual(['finance_accounts','finance_journals','finance_postings']);expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');expect(sql).toContain('deb<>cred');expect(sql).toContain('nonnegative AND "balancePence"<0');expect(sql).toContain('BEFORE TRUNCATE');expect(sql).not.toMatch(/bonus_transfers|users\(/);});
 it('down touches only finance objects without CASCADE',async()=>{const query=jest.fn();await new CreateFinanceCore1791890000000().down({query} as unknown as QueryRunner);const sql=query.mock.calls[0][0] as string;expect(sql).not.toContain('CASCADE');expect([...sql.matchAll(/DROP (?:TABLE|FUNCTION) (\w+)/g)].every(m=>m[1].startsWith('finance_'))).toBe(true);});
});
