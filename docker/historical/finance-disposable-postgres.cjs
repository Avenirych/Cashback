'use strict';
// Explicit integration runner. Never targets an existing database/container.
// No host ports, mounts or persistent volume; the test cluster lives in tmpfs.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const docker='C:/Users/serge/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const image='postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df';
const label=crypto.randomUUID(), name='cashback-finance-reconcile-'+label;
const database='finance_reconciliation_test';let container;
function dockerCall(args,options={}){return cp.execFileSync(docker,['--context','desktop-linux',...args],{encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,stdio:['pipe','pipe','pipe'],...options}).trim();}
function inventory(){return dockerCall(['ps','-aq','--no-trunc']).split(/\s+/).filter(Boolean).filter(id=>id!==container).sort();}
function assert(ok,message){if(!ok)throw Error(message);}
function verify(){const x=JSON.parse(dockerCall(['inspect',container]))[0];assert(x.Id===container&&x.Name==='/'+name&&x.Config.Image===image&&x.Config.Labels['com.cashback.finance-disposable']===label,'Container identity mismatch');assert(x.HostConfig.NetworkMode==='none'&&!x.HostConfig.PublishAllPorts&&Object.keys(x.HostConfig.PortBindings||{}).length===0,'Isolation mismatch');assert(Object.keys(x.HostConfig.Tmpfs||{}).includes('/var/lib/postgresql/data')&&x.Mounts.every(m=>m.Type==='tmpfs'),'Unexpected data mount');}
function sql(statement,role='finance_test_owner'){return dockerCall(['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',role,'-d',database],{input:statement});}
async function parallelSql(statement){return new Promise(resolve=>cp.execFile(docker,['--context','desktop-linux','exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','finance_test_owner','-d',database],{timeout:20000},(error,stdout)=>resolve({ok:!error,stdout:stdout.trim()})).stdin.end(statement));}
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
function journal(n,amount,reverse=false){return `BEGIN; SELECT id FROM finance_accounts ORDER BY id FOR UPDATE; INSERT INTO finance_journals(id,"eventKey","requestHash") VALUES('${id(n)}','integration:${n}','${'a'.repeat(64)}'); INSERT INTO finance_postings(id,"journalId","accountId",side,"amountPence") VALUES('${id(n+1000)}','${id(n)}','${id(1)}','${reverse?'credit':'debit'}',${amount}),('${id(n+2000)}','${id(n)}','${id(2)}','${reverse?'debit':'credit'}',${amount}); UPDATE finance_journals SET sealed=true WHERE id='${id(n)}'; COMMIT;`;}
async function main(){
 assert(process.env.CASHBACK_FINANCE_DISPOSABLE_TEST==='1','Explicit disposable test opt-in required');
 assert(dockerCall(['info','--format','{{.ID}}'])==='ec3d6303-4d66-4410-8317-b739cebc046c','Unexpected Docker daemon');
 const before=inventory();const networksBefore=dockerCall(['network','ls','-q','--no-trunc']);const volumesBefore=dockerCall(['volume','ls','-q']);
 assert(dockerCall(['ps','-aq','--filter','name=^/'+name+'$'])==='','Container name conflict');
 // Password is generated only for the disposable cluster; never printed or written.
 container=dockerCall(['run','-d','--pull','never','--name',name,'--label','com.cashback.finance-disposable='+label,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,size=268435456','-e','POSTGRES_USER=finance_test_owner','-e','POSTGRES_DB='+database,'-e','POSTGRES_PASSWORD',image],{env:{...process.env,POSTGRES_PASSWORD:crypto.randomBytes(32).toString('hex')}});
 assert(/^[a-f0-9]{64}$/.test(container),'Invalid new container identity');verify();
 // pg_isready may see the temporary init server. Require the final PID 1 server.
 let ready=false;for(let i=0;i<60;i++){try{assert(dockerCall(['exec',container,'cat','/proc/1/comm'])==='postgres','Initialization still running');dockerCall(['exec',container,'pg_isready','-U','finance_test_owner','-d',database]);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
 assert(ready,'Disposable PostgreSQL startup timed out');
 const cluster=sql('SELECT system_identifier FROM pg_control_system()');
 assert(!['7698666936429441062','7698128168850814668'].includes(cluster),'Protected cluster identity rejected');
 assert(sql('SELECT current_database()')===database&&sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'")==='0','Expected new empty test database');
 require('ts-node/register/transpile-only');
 let migrationSql='';const {CreateFinanceCore1791890000000}=require('../../src/finance/migrations/1791890000000-CreateFinanceCore');
 await new CreateFinanceCore1791890000000().up({query:async text=>{migrationSql+=text;}});
 const {AddPurchaseLinkage1792500000000}=require('../../src/finance/migrations/1792500000000-AddPurchaseLinkage');
 await new AddPurchaseLinkage1792500000000().up({query:async text=>{migrationSql+=text;}});verify();sql(migrationSql);
 const checks=[];function test(title,work){work();checks.push(title);}function rejects(statement){let rejected=false;try{sql(statement);}catch{rejected=true;}assert(rejected,'Expected database rejection');}
 sql(`INSERT INTO finance_accounts(id,"accountKey",kind,"normalSide",nonnegative) VALUES('${id(1)}','test:clearing','clearing','debit',false),('${id(2)}','test:customer','bonus_liability','credit',true);`);
 test('balanced posting and cached balance',()=>{sql(journal(10,100));assert(sql(`SELECT "balancePence" FROM finance_accounts WHERE id='${id(2)}'`)==='100','Wrong customer liability');});
 test('immutable journal and postings',()=>{rejects(`UPDATE finance_postings SET "amountPence"=1`);rejects('DELETE FROM finance_journals');});
 test('cached balance cannot be overwritten',()=>rejects('UPDATE finance_accounts SET "balancePence"=0'));
 test('repeated event identity cannot credit twice',()=>{rejects(journal(10,100));assert(sql('SELECT count(*) FROM finance_journals')==='1','Duplicate journal persisted');});
 test('unbalanced transaction rolls back completely',()=>{rejects(`BEGIN;INSERT INTO finance_journals(id,"eventKey","requestHash") VALUES('${id(20)}','integration:20','${'b'.repeat(64)}');INSERT INTO finance_postings(id,"journalId","accountId",side,"amountPence") VALUES('${id(1020)}','${id(20)}','${id(1)}','debit',1);UPDATE finance_journals SET sealed=true WHERE id='${id(20)}';COMMIT;`);assert(sql('SELECT count(*) FROM finance_journals')==='1','Failed transaction leaked');});
 test('negative available funds rejected atomically',()=>rejects(journal(30,101,true)));
 test('explicit rollback leaves no financial movement',()=>{sql(journal(31,5).replace('COMMIT;','ROLLBACK;'));assert(sql('SELECT count(*) FROM finance_journals')==='1','Rollback leaked');});
 const races=await Promise.all([parallelSql(journal(40,80,true)),parallelSql(journal(41,80,true))]);assert(races.filter(r=>r.ok).length===1,'Double-spend race was not serialized');checks.push('concurrent competing debits: exactly one commit');
 test('read-only ledger reconciliation after contention',()=>assert(sql(`SELECT count(*) FROM finance_accounts a WHERE a."balancePence"<>(SELECT COALESCE(sum(CASE WHEN p.side=a."normalSide" THEN p."amountPence" ELSE -p."amountPence" END),0) FROM finance_postings p WHERE p."accountId"=a.id)`)==='0','Cache/journal mismatch'));
 test('one trusted click can link multiple pending-review orders',()=>{sql(`INSERT INTO finance_purchase_clicks(id,"buyerReference","partnerReference","offerReference","materialHash") VALUES('click:test','buyer:test','partner:test','offer:test','${'a'.repeat(64)}'); INSERT INTO finance_purchase_orders("sourceNamespace","orderId","clickId",state) VALUES('synthetic:test','order:1','click:test','pending_review'),('synthetic:test','order:2','click:test','pending_review');`);assert(sql('SELECT count(*) FROM finance_purchase_orders')==='2','Missing linked orders');});
 test('repeated order identity cannot duplicate linkage',()=>{sql(`INSERT INTO finance_purchase_orders("sourceNamespace","orderId","clickId",state) VALUES('synthetic:test','order:1','click:test','pending_review') ON CONFLICT DO NOTHING;`);assert(sql('SELECT count(*) FROM finance_purchase_orders')==='2','Duplicate linked order');});
 test('missing click and unreviewed financial state cannot be inserted',()=>{rejects(`INSERT INTO finance_purchase_orders("sourceNamespace","orderId","clickId",state) VALUES('synthetic:test','order:3','missing','pending_review');`);rejects(`INSERT INTO finance_purchase_orders("sourceNamespace","orderId","clickId",state) VALUES('synthetic:test','order:3','click:test','available');`);});
 test('purchase evidence is immutable and rollback leaves no new click',()=>{rejects(`UPDATE finance_purchase_orders SET "clickId"='click:test'`);sql(`BEGIN;INSERT INTO finance_purchase_clicks(id,"buyerReference","partnerReference","offerReference","materialHash") VALUES('click:rollback','buyer:test','partner:test','offer:test','${'b'.repeat(64)}');ROLLBACK;`);assert(sql('SELECT count(*) FROM finance_purchase_clicks')==='1','Click rollback leaked');});
 test('unprivileged role cannot mutate financial history',()=>{sql('CREATE ROLE finance_test_reader; GRANT USAGE ON SCHEMA public TO finance_test_reader; GRANT SELECT ON ALL TABLES IN SCHEMA public TO finance_test_reader;');rejects('SET ROLE finance_test_reader; DELETE FROM finance_postings;');});
 assert(JSON.stringify(before)===JSON.stringify(inventory()),'Existing container inventory changed');assert(networksBefore===dockerCall(['network','ls','-q','--no-trunc'])&&volumesBefore===dockerCall(['volume','ls','-q']),'Existing network/volume inventory changed');
 return {status:'DISPOSABLE_POSTGRES_CORE_PASS',container,cluster,database,checks,scope:'core SQL invariants and pending-review linkage constraints; no completed purchase/refund or runtime-role certification',existingIdentitiesPreserved:true};
}
(async()=>{let result;try{result=await main();}catch(e){result={status:'BLOCKED',reason:e.message};process.exitCode=1;}finally{if(container){try{verify();dockerCall(['rm','-f',container]);result.cleanup='exact labelled disposable container removed; no volumes created';}catch{result.cleanup='BLOCKED_MANUAL_REVIEW';process.exitCode=1;}}}fs.writeFileSync('work/business-reconciliation-2abd7aa84ab24428968b82d004e9050d/postgres-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));})();
