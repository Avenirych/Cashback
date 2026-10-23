import {boundary,ActivityEngine,returnedRows} from './activity-engine';
import {PartnerActivityContract} from './partner-contract';
import {createHmac} from 'node:crypto';
describe('UTC activity boundaries',()=>{
 it.each([
  ['day','2026-03-29T00:30:00Z','2026-03-29T00:00:00.000Z','2026-03-30T00:00:00.000Z'],
  ['month','2024-02-29T23:59:59Z','2024-02-01T00:00:00.000Z','2024-03-01T00:00:00.000Z'],
  ['month','2026-12-31T23:59:59Z','2026-12-01T00:00:00.000Z','2027-01-01T00:00:00.000Z'],
  ['quarter_hour','2026-10-23T12:14:59Z','2026-10-23T12:00:00.000Z','2026-10-23T12:15:00.000Z'],
 ])('%s uses UTC independent of local DST', (period,now,start,end)=>expect(boundary(period,new Date(now))).toEqual({start,end}));
 it('refuses use outside an active transaction',async()=>{await expect(new ActivityEngine().lock({query:jest.fn()},'u:1','video','demo')).rejects.toThrow('transaction');});
});
describe('trusted partner proof boundary',()=>{
 const secret='s'.repeat(64),now=Date.parse('2026-10-23T12:00:00Z'),timestamp=String(now/1000);
 const raw=Buffer.from(JSON.stringify({externalId:'external-unique-001',operationId:'00000000-0000-4000-8000-000000000001',outcome:'complete'}));
 const signature=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex');
 it('ships with no partner: cannot fabricate confirmation',()=>expect(()=>new PartnerActivityContract().verify('partner',raw,timestamp,signature,now)).toThrow('not connected'));
 it('validates the exact signed bytes, timestamp and configured key',()=>{const p=new PartnerActivityContract(new Map([['partner',secret]]));expect(p.verify('partner',raw,timestamp,signature,now).event.outcome).toBe('complete');for(const [body,time,sig]of [[Buffer.from(raw.toString()+' '),timestamp,signature],[raw,String(now/1000-301),signature],[raw,timestamp,'0'.repeat(64)]] as const)expect(()=>p.verify('partner',body,time,sig,now)).toThrow();});
 it('JSON from a caller cannot manufacture the private proof symbol',async()=>{await expect(new PartnerActivityContract().apply({query:jest.fn(),queryRunner:{isTransactionActive:true}},{partner:'partner',event:{}} as any)).rejects.toThrow('proof');});
});

test('normalizes actual TypeORM UPDATE results without changing SELECT/INSERT rows',()=>{const row={id:1};expect(returnedRows([[row],1])).toEqual([row]);expect(returnedRows([[],0])).toEqual([]);expect(returnedRows([row])).toEqual([row]);});
