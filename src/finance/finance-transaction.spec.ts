import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { FinanceService } from './finance.service';
const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002';
const lines=[{accountId:a,side:'debit' as const,amount:1n},{accountId:b,side:'credit' as const,amount:1n}];
function harness() {
 const ds={} as DataSource;
 const query=jest.fn(async(sql:string)=>sql.startsWith('SELECT *')?[{id:a,currency:'GBP',normalSide:'debit',nonnegative:false,balancePence:'0'},{id:b,currency:'GBP',normalSide:'credit',nonnegative:true,balancePence:'0'}]:[]);
 const manager={connection:ds,query} as unknown as EntityManager;
 const runner={connection:ds,manager,isReleased:false,isTransactionActive:true,startTransaction:jest.fn(),commitTransaction:jest.fn(),rollbackTransaction:jest.fn(),release:jest.fn()};
 Object.assign(manager,{queryRunner:runner});const transaction=jest.fn(async (work:(m:EntityManager)=>Promise<unknown>)=>work(manager));Object.assign(ds,{transaction});
 return {ds,manager,runner,query,transaction,service:new FinanceService(ds)};
}
it('external manager performs writes without nested transaction or lifecycle calls',async()=>{const h=harness();const result=await h.service.postWithManager(h.manager,'external:event:1',lines);expect(result.replay).toBe(false);expect(h.transaction).not.toHaveBeenCalled();expect(h.query.mock.calls.filter(([sql])=>sql.startsWith('INSERT INTO finance_postings'))).toHaveLength(2);for(const call of [h.runner.startTransaction,h.runner.commitTransaction,h.runner.rollbackTransaction,h.runner.release])expect(call).not.toHaveBeenCalled();});
it('post opens exactly one transaction and delegates to manager method',async()=>{const h=harness();const delegate=jest.spyOn(h.service,'postWithManager');await h.service.post('external:event:2',lines);expect(h.transaction).toHaveBeenCalledTimes(1);expect(delegate).toHaveBeenCalledWith(h.manager,'external:event:2',lines);});
it.each(['missing','inactive','released','foreign','foreignRunner','detached'])('rejects %s manager before SQL',async kind=>{const h=harness();if(kind==='missing')Object.assign(h.manager,{queryRunner:undefined});if(kind==='inactive')h.runner.isTransactionActive=false;if(kind==='released')h.runner.isReleased=true;if(kind==='foreign')Object.assign(h.manager,{connection:{}});if(kind==='foreignRunner')Object.assign(h.runner,{connection:{}});if(kind==='detached')Object.assign(h.runner,{manager:{}});await expect(h.service.postWithManager(h.manager,'external:event:3',lines)).rejects.toThrow('active transaction');expect(h.query).not.toHaveBeenCalled();expect(h.transaction).not.toHaveBeenCalled();});
it('external writer propagates database error and leaves rollback to caller',async()=>{const h=harness();const failure=new Error('Synthetic SQL error');h.query.mockRejectedValueOnce(failure);await expect(h.service.postWithManager(h.manager,'external:event:4',lines)).rejects.toBe(failure);expect(h.runner.rollbackTransaction).not.toHaveBeenCalled();expect(h.runner.commitTransaction).not.toHaveBeenCalled();});
it('external writer retains financial validation',async()=>{const h=harness();await expect(h.service.postWithManager(h.manager,'external:event:5',[lines[0],{...lines[1],amount:2n}])).rejects.toThrow('Unbalanced');expect(h.query).not.toHaveBeenCalled();});
