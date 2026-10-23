const {bootstrap}=require('../../scripts/bootstrap-first-owner.cjs');
describe('offline first-owner bootstrap',()=>{
 const options={accountId:42,database:'cashback_historical_03573b7',clusterId:'7698666936429441062',privacyDocumentSha256:'a'.repeat(64),confirmation:'APPOINT OWNER 42 AND ACCEPT PRIVACY DUTIES'};
 function fixture(change:Record<string,unknown>={}) {
  const query=jest.fn(async(sql:string)=>{
   if(sql.includes('pg_control_system'))return {rows:[{database:options.database,cluster:options.clusterId,...change.identity as object}]};
   if(sql.includes('SELECT consumed_at'))return {rows:[{consumed_at:change.consumed??null}]};
   if(sql.includes('SELECT version'))return {rows:[{version:3}]};
   if(sql.includes('pg_get_userbyid'))return {rows:[{permitted:change.owner!==false}]};
   if(sql.includes('SELECT user_id FROM forum_moderators'))return {rows:change.existing?[{user_id:1}]:[]};
   if(sql.includes('SELECT u.id'))return {rows:change.missing?[]:[{id:42,email_verified:true,banned:false,agreed_to_rules:true,rules_version:'2026-10-22-reviews-v1',...change.user as object}]};
   if(sql.includes('RETURNING singleton'))return {rows:[{singleton:true}]};
   return {rows:[]};
  });return {query};
 }
 test('dry run locks and validates but never writes or commits',async()=>{const c=fixture();await expect(bootstrap(c,options)).resolves.toMatchObject({status:'DRY_RUN_ELIGIBLE',publicActivation:false});expect(c.query.mock.calls.map(x=>x[0]).join('\n')).not.toMatch(/INSERT|UPDATE forum_owner/);expect(c.query).toHaveBeenLastCalledWith('ROLLBACK');});
 test('explicit apply consumes marker and grants only moderator in one transaction',async()=>{const c=fixture();await expect(bootstrap(c,{...options,apply:true})).resolves.toMatchObject({status:'OWNER_APPOINTED'});expect(c.query).toHaveBeenCalledWith('INSERT INTO forum_moderators(user_id,active) VALUES($1,true)',[42]);expect(c.query).toHaveBeenLastCalledWith('COMMIT');expect(c.query.mock.calls.map(x=>x[0]).join('\n')).not.toMatch(/INSERT INTO users|UPDATE users|CREATE ROLE/);});
 test.each([{consumed:'now'},{existing:true},{owner:false},{missing:true},{identity:{cluster:'different'}},{user:{email_verified:false}},{user:{banned:true}},{user:{rules_version:'legacy'}}])('unsafe prerequisite fails closed: %j',async change=>{const c=fixture(change);await expect(bootstrap(c,{...options,apply:true})).rejects.toThrow();expect(c.query.mock.calls.some(x=>x[0].startsWith('INSERT'))).toBe(false);expect(c.query).toHaveBeenLastCalledWith('ROLLBACK');});
 test('approval is required even for dry run',async()=>{const c=fixture();await expect(bootstrap(c,{...options,confirmation:''})).rejects.toThrow('INVALID_OWNER_APPROVAL');expect(c.query).not.toHaveBeenCalled();});
 test('write failure rolls back appointment and one-time marker',async()=>{const c=fixture();const original=c.query.getMockImplementation()!;c.query.mockImplementation(async(sql:string)=>{if(sql.startsWith('UPDATE forum_owner_bootstrap'))throw Error('fixture failure');return original(sql);});await expect(bootstrap(c,{...options,apply:true})).rejects.toThrow();expect(c.query).toHaveBeenLastCalledWith('ROLLBACK');});
});
