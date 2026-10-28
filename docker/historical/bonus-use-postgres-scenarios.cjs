'use strict';
// Explicit integration hook. Caller must prove a new disposable cluster identity.
// No production connection, authority, controller, migration registration or payout dispatcher.
module.exports=async function(h){
 const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID:id,createHash}=require('node:crypto');
 const {DataSource}=require('typeorm');
 const {AddBonusUseTerms1793200000000:Migration}=require('../../src/finance/migrations/1793200000000-AddBonusUseTerms');
 const {PolicyContext}=require('../../src/finance/policy-context');
 const {POLICY_21}=require('../../src/finance/policy-2026-10-21');
 const {ApprovedBonusOperations}=require('../../src/finance/approved-bonus-operations');
 const {LotOperations}=require('../../src/finance/lot-operations');
 const {ReceiptSettlement}=require('../../src/finance/receipt-settlement');
 const {PolicyDebtRefund}=require('../../src/finance/policy-debt-refund');
 const {FinanceAccount,FinanceJournal,FinancePosting}=require('../../src/finance/finance.entities');
 const {owner,runtime,test,events,ledger}=h,checks=[],base=owner.options;
 const tx=fn=>runtime.transaction(fn),query=(s,p)=>owner.query(s,p);
 assert.equal(process.env.CASHBACK_FINANCE_ISOLATED_TEST,'1','Explicit isolated opt-in required');
 assert.equal(base.host,'127.0.0.1');assert.equal(base.database,'bonus_use_isolated');assert.equal(base.username,'bonus_test_owner');
 assert.equal(runtime.options.username,'finance_app');assert.equal(require('node:path').win32.parse(h.out).root.toUpperCase(),'D:'+require('node:path').win32.sep);
 const path=require('node:path'),marker=JSON.parse(fs.readFileSync(h.out+'/cluster-marker.json')),identity=JSON.parse(fs.readFileSync(h.out+'/cluster-identity.json'));
 assert.equal(base.port,marker.port);
 const [actual]=await query("SELECT current_setting('data_directory') directory,(SELECT system_identifier::text FROM pg_control_system()) identity");
 assert.equal(actual.identity,identity.cluster);assert.equal(path.resolve(actual.directory),path.resolve(h.out+'/pg-data'));assert.equal(path.resolve(marker.data),path.resolve(actual.directory));

 const testNew=async(name,fn)=>{await test('bonus-use: '+name,fn);checks.push(name);fs.writeFileSync(h.out+'/integration-progress.json',JSON.stringify(checks,null,2));};
 const fingerprint=async()=>createHash('sha256').update(JSON.stringify(await query('SELECT * FROM finance_bonus_lots ORDER BY id'))).update(JSON.stringify(await query('SELECT * FROM finance_accounts ORDER BY id'))).update(JSON.stringify(await query('SELECT * FROM finance_postings ORDER BY id'))).digest('hex');
 const migrator=await new DataSource({...base,migrations:[Migration],entities:[FinanceAccount,FinanceJournal,FinancePosting],synchronize:false,migrationsRun:false}).initialize();
 try{
 await testNew('TypeORM migration applies once and preserves all existing financial rows',async()=>{
  const before=await fingerprint();assert.equal((await migrator.runMigrations({transaction:'all'})).length,1);assert.equal(await fingerprint(),before);
  assert.equal((await query("SELECT count(*)::int n FROM information_schema.columns WHERE table_name='finance_bonus_use_terms'"))[0].n,6);
  assert.equal((await query("SELECT count(*)::int n FROM pg_indexes WHERE tablename='finance_bonus_use_terms' AND indexdef LIKE '%UNIQUE%'"))[0].n,1);
  assert((await query("SELECT count(*)::int n FROM pg_constraint WHERE conrelid='finance_bonus_use_terms'::regclass"))[0].n>=5);
  assert.equal((await migrator.getRepository(FinanceAccount).count()),(await query('SELECT count(*)::int n FROM finance_accounts'))[0].n);
 });
 await testNew('TypeORM repeat is no-op; raw repeat rejects atomically',async()=>{
  assert.equal((await migrator.runMigrations()).length,0);const before=await fingerprint();
  await assert.rejects(owner.transaction(m=>new Migration().up({query:s=>m.query(s)})),/already exists/);
  assert.equal(await fingerprint(),before);
 });
 await testNew('empty-history down/up works; injected migration error rolls back DDL',async()=>{
  const before=await fingerprint();await migrator.undoLastMigration({transaction:'all'});assert.equal((await query("SELECT to_regclass('finance_bonus_use_terms') t"))[0].t,null);
  await assert.rejects(owner.transaction(async m=>{await new Migration().up({query:s=>m.query(s)});throw Error('injected migration failure')}),/injected/);
  assert.equal((await query("SELECT to_regclass('finance_bonus_use_terms') t"))[0].t,null);assert.equal(await fingerprint(),before);
  assert.equal((await migrator.runMigrations({transaction:'all'})).length,1);
 });
 await query('GRANT SELECT,INSERT ON finance_bonus_use_terms TO finance_app; GRANT SELECT ON finance_bonus_use_activation TO finance_app');
 const proofs=new Map(),context=new PolicyContext(runtime,events,{verify:async(_m,actor,action,ref)=>{
  const v=proofs.get(ref);assert(v&&v.actor===actor&&v.action===action,'Isolated authority rejected');return{actor,proof:'synthetic:'+ref,facts:v.facts};
 }},POLICY_21);
 const proof=(actor,action,facts)=>{const ref=id();proofs.set(ref,{actor,action,facts});return ref};
 const invoke=(service,method,actor,action,facts,key='bonus-test:'+id())=>tx(m=>service[method](m,actor,key,proof(actor,action,facts)));
 const receipts=new Map();
 const receiptService=new ReceiptSettlement(runtime,events,{verify:async(_m,actor,ref)=>{const v=receipts.get(ref);assert(v&&v.actor===actor,'Synthetic receipt required');return v}});
 const lots=new LotOperations(runtime,ledger,{authorize:async(_m,actor,c)=>{assert(c.action==='transfer'&&typeof actor==='string');return{actor,proof:'synthetic:transfer'}}});
 const approved=new ApprovedBonusOperations(context,receiptService,lots),debts=new PolicyDebtRefund(context);
 const terms=lot=>query(`SELECT lot,version,basis,reference,to_char(started AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "startedAt",to_char(until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS until FROM finance_bonus_use_terms WHERE lot=$1`,[lot]);
 async function funded(actor,receivedAt){
  const x=await require('./bonus-use-postgres-fixtures.cjs')(h,actor,receivedAt||'2026-10-01T00:00:00.000Z');if(actor)x.v.actor=actor;
  const ref=id();receipts.set(ref,x.v);const r=await tx(m=>approved.settle(m,x.v.actor,ref));
  assert.equal(r.status,'completed');const l=(await query('SELECT * FROM finance_bonus_lots WHERE id=$1',[r.lotId]))[0];return{...l,result:r,fixture:x,ref};
 }
 const env={...h,id,assert,query,tx,context,approved,debts,proof,invoke,terms,funded,receipts,testNew};
 await require('./bonus-use-postgres-cases.cjs')(env);
 await testNew('populated history refuses down without losing terms or money',async()=>{
  const before=await fingerprint();await assert.rejects(migrator.undoLastMigration({transaction:'all'}),/destructive rollback refused/);assert.equal(await fingerprint(),before);assert((await query('SELECT count(*)::int n FROM finance_bonus_use_terms'))[0].n>0);
 });
 await testNew('global cached balances equal immutable postings; no unsealed journals or negative protected accounts',async()=>{
  assert.equal((await query('SELECT count(*)::int n FROM finance_accounts a WHERE a."balancePence"<>(SELECT COALESCE(sum(CASE WHEN p.side=a."normalSide" THEN p."amountPence" ELSE -p."amountPence" END),0) FROM finance_postings p WHERE p."accountId"=a.id)'))[0].n,0);
  assert.equal((await query('SELECT count(*)::int n FROM finance_accounts WHERE nonnegative AND "balancePence"<0'))[0].n,0);
  assert.equal((await query('SELECT count(*)::int n FROM finance_journals WHERE NOT sealed'))[0].n,0);
 });
 fs.writeFileSync(h.out+'/INTEGRATION.json',JSON.stringify({passed:checks.length,checks,actualPostgres:true,syntheticOnly:true,version:(await query('SHOW server_version'))[0].server_version},null,2));
 }finally{await migrator.destroy();}
};
