import { FinanceEventsService } from './finance-events.service';
import { FinanceService } from './finance.service';
import { snapshotFinancialEvent } from './finance-event';
import type { FinancialEvent } from './finance-event';
import type { EntityManager, QueryRunner } from 'typeorm';
import { AddFinanceOutbox1791891000000 } from './migrations/1791891000000-AddFinanceOutbox';
const id='00000000-0000-0000-0000-000000000001';
const event:FinancialEvent={type:'finance.journal.posted',schemaVersion:1,eventId:id,idempotencyKey:'event:unit:1',operationId:id,createdAt:'2026-10-14T00:00:00.000Z',data:{currency:'GBP'}};
const lines=[{accountId:id,side:'debit' as const,amount:1n},{accountId:id,side:'credit' as const,amount:1n}];
function setup(){
 let stored: {eventId:string;journalId:string;envelopeHash:string}|undefined;
 const post=jest.fn().mockResolvedValue({journalId:id,replay:false});
 const query=jest.fn(async(sql:string,params:unknown[]=[])=>{if(sql.startsWith('SELECT'))return stored?[stored]:[];stored={eventId:params[0] as string,journalId:params[5] as string,envelopeHash:params[7] as string};return [];});
 const manager={query,transaction:jest.fn()} as unknown as EntityManager;
 const service=new FinanceEventsService({postWithManager:post} as unknown as FinanceService);
 return {service,manager,query,post};
}
it('uses same manager and minimal payload, no nested transaction',async()=>{const h=setup();const x=await h.service.postEventWithManager(h.manager,event,lines);expect(x).toEqual({journalId:id,eventId:id,replay:false});expect(h.post).toHaveBeenCalledWith(h.manager,event.idempotencyKey,lines);expect(h.manager.transaction).not.toHaveBeenCalled();const args=h.query.mock.calls[1][1];expect(JSON.parse(args![8] as string)).toEqual({currency:'GBP',journalId:id,postingCount:2});});
it('replay creates no second outbox',async()=>{const h=setup();await h.service.postEventWithManager(h.manager,event,lines);h.post.mockResolvedValue({journalId:id,replay:true});expect((await h.service.postEventWithManager(h.manager,event,lines)).replay).toBe(true);expect(h.query.mock.calls.filter(([s])=>s.startsWith('INSERT'))).toHaveLength(1);});
it('changed envelope on same key is conflict',async()=>{const h=setup();await h.service.postEventWithManager(h.manager,event,lines);h.post.mockResolvedValue({journalId:id,replay:true});await expect(h.service.postEventWithManager(h.manager,{...event,operationId:'00000000-0000-0000-0000-000000000002'},lines)).rejects.toThrow('envelope conflict');});
it('does not retrofit event to plain ledger replay',async()=>{const h=setup();h.post.mockResolvedValue({journalId:id,replay:true});await expect(h.service.postEventWithManager(h.manager,event,lines)).rejects.toThrow('without this financial event');expect(h.query.mock.calls.filter(([s])=>s.startsWith('INSERT'))).toHaveLength(0);});
it('ledger failure prevents outbox queries',async()=>{const h=setup();h.post.mockRejectedValue(new Error('Ledger failed'));await expect(h.service.postEventWithManager(h.manager,event,lines)).rejects.toThrow('Ledger failed');expect(h.query).not.toHaveBeenCalled();});
it('outbox failure propagates for caller rollback',async()=>{const h=setup();h.query.mockRejectedValueOnce(new Error('Synthetic SQL failure'));await expect(h.service.postEventWithManager(h.manager,event,lines)).rejects.toThrow('Synthetic SQL failure');expect(h.manager.transaction).not.toHaveBeenCalled();});
it.each([2,0,'1'])('rejects unsupported version %s before ledger',async schemaVersion=>{const h=setup();await expect(h.service.postEventWithManager(h.manager,{...event,schemaVersion} as FinancialEvent,lines)).rejects.toThrow('version');expect(h.post).not.toHaveBeenCalled();});
it.each([{bankAccount:'synthetic'}, {currency:'GBP',token:'synthetic'}, {currency:'USD'}])('rejects unknown or sensitive payload fields %p',data=>expect(()=>snapshotFinancialEvent({...event,data} as FinancialEvent)).toThrow());
it('rejects unknown envelope fields and invalid timestamps',()=>{expect(()=>snapshotFinancialEvent({...event,secret:'synthetic'} as FinancialEvent)).toThrow();expect(()=>snapshotFinancialEvent({...event,createdAt:'2026-02-30T00:00:00.000Z'})).toThrow();});
it('creates isolated immutable outbox migration only',async()=>{const query=jest.fn();await new AddFinanceOutbox1791891000000().up({query} as unknown as QueryRunner);const sql=query.mock.calls[0][0];expect(sql).toContain('CREATE TABLE public.finance_outbox');expect(sql).toContain('UNIQUE');expect(sql).toContain('REFERENCES public.finance_journals');expect(sql).not.toMatch(/ALTER TABLE|CREATE TABLE public.users/);});
