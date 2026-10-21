import { BankReceiptsService, bankScopeKey, RegisterBankReceiptCommand } from './bank-receipts.service';
import { DisabledBankEvidenceVerifier } from './bank-evidence-verifier';
import type { BankEvidenceVerifier } from './bank-evidence-verifier';
import type { DataSource, EntityManager, QueryRunner } from 'typeorm';
import type { FinanceEventsService } from './finance-events.service';
import { AddBankReceipts1791892000000 } from './migrations/1791892000000-AddBankReceipts';
const id=(n:number)=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const command:RegisterBankReceiptCommand={sourceNamespace:'synthetic:bank',accountScope:id(1),transactionId:'tx:1',currency:'GBP',amountPence:1000n,receivedAt:'2026-10-14T00:00:00.000Z',evidenceReference:id(2),bankAccountId:id(3),unallocatedAccountId:id(4)};
function setup(){
 const ds={} as DataSource;let prior:any;const scope=bankScopeKey(command.sourceNamespace,command.accountScope);
 const query=jest.fn(async(sql:string,p:any[]=[])=>{
 if(sql.includes('FROM public.finance_bank_receipts'))return prior?[prior]:[];
 if(sql.includes('FROM public.finance_accounts'))return [{id:id(3),kind:'company_bank_cash',currency:'GBP',accountKey:'bank_cash:'+scope},{id:id(4),kind:'unallocated_received_funds',currency:'GBP',accountKey:'bank_unallocated:'+scope}];
 if(sql.startsWith('INSERT INTO public.finance_bank_receipts'))prior={id:p[0],materialHash:p[5],journalId:p[13],eventId:p[14],lotId:id(8)};
 return [];
 });
 const manager={connection:ds,query,transaction:jest.fn()} as unknown as EntityManager;
 Object.assign(manager,{queryRunner:{connection:ds,manager,isTransactionActive:true,isReleased:false,commitTransaction:jest.fn(),rollbackTransaction:jest.fn()}});
 const post=jest.fn(async(_m:any,e:any,_lines:any)=>({journalId:id(9),eventId:e.eventId,replay:false}));
 // Synthetic verification exists exclusively in this test file.
 const verify=jest.fn(async(ref:string,facts:any)=>({...facts,status:'verified' as const,verificationId:id(7),evidenceReference:ref,verifierReference:'synthetic:test-only'}));
 const verifier={verify,verifyWithManager:async(_m:EntityManager,e:string,f:any)=>verify(e,f),bindReceiptWithManager:jest.fn().mockResolvedValue(undefined)};
 const events={postEventWithManager:post} as unknown as FinanceEventsService;
 return {ds,manager,query,post,verify,events,service:new BankReceiptsService(ds,events,verifier)};
}
it('creates exact receipt-only double entry and restricted same-amount lot through one manager',async()=>{const h=setup();const x=await h.service.registerWithManager(h.manager,command);expect(x.replay).toBe(false);expect(h.post.mock.calls[0][0]).toBe(h.manager);expect(h.post.mock.calls[0][2]).toEqual([{accountId:id(3),side:'debit',amount:1000n},{accountId:id(4),side:'credit',amount:1000n}]);const lot=h.query.mock.calls.find(([s])=>s.startsWith('INSERT INTO public.finance_funding_lots'))!;const params=lot[1];expect(params).toBeDefined();if(!params)throw Error('Expected funding-lot query parameters');expect(params.slice(2)).toEqual(['GBP','1000','restricted','awaiting_classification']);expect(h.manager.transaction).not.toHaveBeenCalled();expect(h.manager.queryRunner!.commitTransaction).not.toHaveBeenCalled();});
it('same transaction identity and material replays without another ledger/outbox/receipt',async()=>{const h=setup();const a=await h.service.registerWithManager(h.manager,command);const b=await h.service.registerWithManager(h.manager,{...command,evidenceReference:id(6)});expect(b.replay).toBe(true);expect(b.receiptId).toBe(a.receiptId);expect(h.post).toHaveBeenCalledTimes(1);});
it('changed essential amount is a conflict',async()=>{const h=setup();await h.service.registerWithManager(h.manager,command);await expect(h.service.registerWithManager(h.manager,{...command,amountPence:1001n})).rejects.toThrow('conflict');expect(h.post).toHaveBeenCalledTimes(1);});
it.each([0n,-1n,1.5,9223372036854775808n])('rejects invalid receipt amount %s before verifier or SQL',async n=>{const h=setup();await expect(h.service.registerWithManager(h.manager,{...command,amountPence:n as bigint})).rejects.toThrow();expect(h.verify).not.toHaveBeenCalled();expect(h.query).not.toHaveBeenCalled();});
it('default production verifier rejects arbitrary evidence UUID without domain/ledger writes',async()=>{const h=setup();await expect(new BankReceiptsService(h.ds,h.events,new DisabledBankEvidenceVerifier()).registerWithManager(h.manager,command)).rejects.toThrow('not configured');expect(h.post).not.toHaveBeenCalled();expect(h.query.mock.calls.filter(([s])=>s.startsWith('INSERT'))).toHaveLength(0);});
it('absent verifier fails closed',async()=>{const h=setup();await expect(new BankReceiptsService(h.ds,h.events).registerWithManager(h.manager,command)).rejects.toThrow('not configured');expect(h.query).not.toHaveBeenCalled();});
it('proof must confirm exact facts, not merely an ID',async()=>{const h=setup();h.verify.mockImplementation(async(ref,f)=>({...f,amountPence:2n,status:'verified',verificationId:id(7),evidenceReference:ref,verifierReference:'synthetic:test-only'}));await expect(h.service.registerWithManager(h.manager,command)).rejects.toThrow('does not verify');expect(h.post).not.toHaveBeenCalled();});
it('requires an active manager belonging to this datasource',async()=>{const h=setup();Object.assign(h.manager.queryRunner!,{isTransactionActive:false});await expect(h.service.registerWithManager(h.manager,command)).rejects.toThrow('Active');expect(h.query).not.toHaveBeenCalled();});
it.each([{currency:'USD'},{receivedAt:'2026-02-30T00:00:00.000Z'},{sourceNamespace:'https://bank'},{transactionId:''},{extra:'data'}])('rejects malformed command %p',async patch=>{const h=setup();await expect(h.service.registerWithManager(h.manager,{...command,...patch} as RegisterBankReceiptCommand)).rejects.toThrow();expect(h.query).not.toHaveBeenCalled();});
it('ledger/outbox error propagates to external transaction without domain inserts',async()=>{const h=setup();h.post.mockRejectedValueOnce(new Error('Synthetic ledger failure'));await expect(h.service.registerWithManager(h.manager,command)).rejects.toThrow('ledger failure');expect(h.query.mock.calls.filter(([s])=>s.startsWith('INSERT'))).toHaveLength(0);});
it('migration adds receipt and immutable restricted lot guards without modifying legacy tables',async()=>{const query=jest.fn();await new AddBankReceipts1791892000000().up({query} as unknown as QueryRunner);const sql=query.mock.calls[0][0];expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');expect(sql).toContain('UNIQUE("sourceNamespace","accountScope","transactionId")');expect(sql).toContain("status='restricted'");expect(sql).not.toMatch(/bonus_transfers|public.users/);});
