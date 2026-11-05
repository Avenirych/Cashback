import { SessionRevocationService, assertCurrentSession, lockCurrentSession } from './session-revocation.service';

describe('session revocation source contract', () => {
  it('rejects legacy/mismatch and fails unavailable authority closed', () => {
    expect(() => assertCurrentSession(undefined,0)).toThrow('Sign in again');
    expect(() => assertCurrentSession(0,1)).toThrow('Sign in again');
    expect(() => assertCurrentSession(0,undefined)).toThrow('Session authority unavailable');
    expect(() => assertCurrentSession(0,0)).not.toThrow();
  });
  const fixture = (affected: number, value: number, failCommit=false) => {
    const execute=jest.fn().mockResolvedValue({affected,raw:affected?[{session_version:value}]:[]});
    const qb:any={update:jest.fn().mockReturnThis(),set:jest.fn().mockReturnThis(),where:jest.fn().mockReturnThis(),returning:jest.fn().mockReturnThis(),execute};
    const m:any={query:jest.fn().mockResolvedValue([]),createQueryBuilder:()=>qb};
    const db:any={transaction:async(work:any)=>{await work(m);if(failCommit)throw Error('PRIVATE_COMMIT_DETAIL');}};
    return {service:new SessionRevocationService(db),qb,execute};
  };
  it('confirms only one expected-version atomic increment',async()=>{
    const f=fixture(1,1);await expect(f.service.logoutAll(7,0)).resolves.toBeUndefined();
    expect(f.qb.where).toHaveBeenCalledWith(expect.stringContaining('session_version = :sv'),{id:7,sv:0});
    expect(f.execute).toHaveBeenCalledTimes(1);
  });
  it('does not report success for zero rows',async()=>{
    await expect(fixture(0,0).service.logoutAll(7,0)).rejects.toMatchObject({status:401});
  });
  it('does not report success for unexpected result or commit failure',async()=>{
    await expect(fixture(1,3).service.logoutAll(7,0)).rejects.toMatchObject({status:503});
    await expect(fixture(1,1,true).service.logoutAll(7,0)).rejects.toMatchObject({status:503,message:'Session revocation unavailable'});
  });
  it('refuses overflow before SQL',async()=>{
    const f=fixture(1,0);await expect(f.service.logoutAll(7,2147483647)).rejects.toMatchObject({status:503});
    expect(f.execute).not.toHaveBeenCalled();
  });
  it('locks and rechecks before a privileged operation',async()=>{
    const m:any={query:jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{session_version:1}])};
    await expect(lockCurrentSession(m,7,0)).rejects.toMatchObject({status:401});
    expect(m.query).toHaveBeenLastCalledWith(expect.stringContaining('FOR SHARE'),[7]);
  });
});


// Stateful CAS model: checks service behavior, not PostgreSQL lock scheduling or atomicity.
describe('repeated and competing logout requests (mock model)',()=>{
  function stateful(){
    let version=0,executions=0;
    const m:any={query:jest.fn().mockResolvedValue([]),createQueryBuilder:()=>{
      let expected:unknown,id:unknown;
      const qb:any={update:()=>qb,set:()=>qb,where:(_sql:string,p:any)=>{expected=p.sv;id=p.id;return qb;},returning:()=>qb,
        execute:async()=>{executions++;if(id!==7||expected!==version)return{affected:0,raw:[]};version++;return{affected:1,raw:[{session_version:version}]};}};
      return qb;
    }};
    return{service:new SessionRevocationService({transaction:async(work:any)=>work(m)} as any),state:()=>({version,executions})};
  }
  it('second logout with the same version fails without a second increment',async()=>{
    const f=stateful();await expect(f.service.logoutAll(7,0)).resolves.toBeUndefined();
    await expect(f.service.logoutAll(7,0)).rejects.toMatchObject({status:401});expect(f.state()).toEqual({version:1,executions:2});
  });
  it('only one competing same-version request succeeds under a CAS result model',async()=>{
    const f=stateful();const outcomes=await Promise.allSettled([f.service.logoutAll(7,0),f.service.logoutAll(7,0)]);
    expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
    const failure=outcomes.find(x=>x.status==='rejected') as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({status:401});expect(f.state()).toEqual({version:1,executions:2});
  });
  it('primary authority connection failure does not become a valid finance session',async()=>{
    const service=new SessionRevocationService({transaction:async()=>{throw Error('PRIVATE_DB_DETAIL')}} as any);
    await expect(service.verifyFinance(7,'01234567-89ab-4cde-8fab-0123456789ab',0))
      .rejects.toMatchObject({status:503,message:'Session authority unavailable'});
  });
});
