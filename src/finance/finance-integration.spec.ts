import {JwtLedgerAuthority} from './jwt-ledger-authority';
import {historicalReview,requireFinancialAdmission} from './financial-cutover';
import {FinanceReadController,FinanceReadModule} from './finance-read.module';
const uuid='01234567-89ab-4cde-8fab-0123456789ab';
describe('prepared finance identity and reader',()=>{
 test.each(['0','01','1 OR 1=1','-1','2147483648','1.2',''])('rejects principal %s',async(id)=>{const m:any={query:jest.fn()};await expect(new JwtLedgerAuthority().resolveOwner(m,id)).rejects.toThrow();expect(m.query).not.toHaveBeenCalled();});
 it('resolves only fresh verified server identity',async()=>{const m:any={query:jest.fn().mockResolvedValue([{id:7,email_verified:true,account_uuid:uuid}])};expect(await new JwtLedgerAuthority().resolveOwner(m,'7')).toBe('cb:user:'+uuid);expect(m.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id=$1'),['7']);});
 test.each([[],[{email_verified:true}], [{email_verified:false,account_uuid:uuid}], [{email_verified:true,account_uuid:uuid},{email_verified:true,account_uuid:uuid}]].map(rows=>({rows})))('denies missing/unverified/ambiguous identity %#',async({rows})=>{await expect(new JwtLedgerAuthority().resolveOwner({query:async()=>rows} as any,'7')).rejects.toThrow();});
 it('does not invent dates or mutate historical records',()=>{const original={amount:'123.45',expiresAt:'2020-01-01'};const r=historicalReview({sourceSystem:'legacy',sourceId:'1',original,receivedAt:'2026-11-02',receiptProven:false});expect(r.verifiedReceivedAt).toBeNull();expect(r.reason).toBe('DATE_UNPROVEN');expect(r.original).toEqual(original);expect(r.original).not.toBe(original);});
 it('classifies late historical receipt by economic time',()=>{expect(historicalReview({sourceSystem:'x',sourceId:'1',original:{},receiptProven:true,receivedAt:'2026-10-31T23:59:59Z'}).reason).toBe('LATE_PRE_CUTOVER_EVENT');});
 it('never enables financial admission by time or config',async()=>{await expect(requireFinancialAdmission({query:async()=>[{admission_enabled:true}]} as any)).rejects.toThrow('NOT_IMPLEMENTED');});
 it('rejects default/migrating data sources',()=>{expect(()=>FinanceReadModule.prepare({options:{name:'default'}} as any)).toThrow();expect(()=>FinanceReadModule.prepare({options:{name:'finance-readonly',migrationsRun:true}} as any)).toThrow();});
 it('rejects owner selectors before database access',async()=>{const source:any={createQueryRunner:jest.fn()};await expect(new FinanceReadController(source).snapshot({user:{id:7},query:{owner:'other'}})).rejects.toThrow();expect(source.createQueryRunner).not.toHaveBeenCalled();});
 it('history binds own owner and exposes no journal metadata',async()=>{const query=jest.fn(async(sql:string)=>sql.includes('FROM public.users')?[{id:7,email_verified:true,account_uuid:uuid}]:[]);const r:any={connect:jest.fn(),startTransaction:jest.fn(),query,commitTransaction:jest.fn(),release:jest.fn(),isTransactionActive:true,rollbackTransaction:jest.fn(),manager:{query}};const source:any={createQueryRunner:()=>r};const result:any=await new FinanceReadController(source).history({user:{id:7},query:{}});expect(result.entries).toEqual([]);expect(query).toHaveBeenCalledWith(expect.stringContaining('l.owner=$1'),['cb:user:'+uuid]);expect(r.startTransaction).toHaveBeenCalledWith('REPEATABLE READ');expect(query).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');expect(r.release).toHaveBeenCalled();});
});

import {classifyEconomicSource} from './financial-cutover';
describe('economic cutover is distinct from ingestion and financial activation',()=>{
 it('keeps pre-boundary receipts historical',()=>expect(classifyEconomicSource({kind:'receipt',actualAt:'2026-10-31T23:59:59.999999Z',proven:true})).toBe('historical'));
 it('boundary is inclusive but only a candidate',()=>expect(classifyEconomicSource({kind:'receipt',actualAt:'2026-11-01T00:00:00Z',proven:true})).toBe('new_candidate'));
 it('never uses arrival time for an undated receipt',()=>expect(classifyEconomicSource({kind:'receipt',actualAt:null,proven:false})).toBe('review_required'));
 it('never renews historical lineage',()=>expect(classifyEconomicSource({kind:'receipt',actualAt:'2026-11-02T00:00:00Z',proven:true,knownLegacy:true})).toBe('historical'));
 it('requires admitted transfer parent',()=>expect(classifyEconomicSource({kind:'transfer',actualAt:'2026-11-02T00:00:00Z',proven:true})).toBe('review_required'));
 it('rejects invented calendar dates',()=>expect(()=>classifyEconomicSource({kind:'receipt',actualAt:'2026-02-30T00:00:00Z',proven:true})).toThrow());
});
