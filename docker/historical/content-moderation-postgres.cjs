'use strict';
// Explicit disposable PostgreSQL only: no host ports, network, disk volume or active DB.
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const docker=process.env.LOCALAPPDATA+'/Programs/DockerDesktop/resources/bin/docker.exe';
const image='postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df';
const label=crypto.randomUUID(),name='cashback-moderation-test-'+label,db='moderation_disposable_test';
const owner='moderation_test_owner',runtime='moderation_test_runtime';let container;let phase='preflight';const completed=[];let lastSqlState=null;
const d=(a,options={})=>cp.execFileSync(docker,['--context','desktop-linux',...a],{encoding:'utf8',windowsHide:true,timeout:30000,stdio:['pipe','pipe','pipe'],...options}).trim();
const inventory=()=>JSON.parse(d(['inspect',...d(['ps','-aq','--no-trunc']).split(/\r?\n/).filter(Boolean)])).map(x=>[x.Id,x.Image,x.State.Running,x.State.StartedAt]);
function verify(){const x=JSON.parse(d(['inspect',container]))[0];assert.equal(x.Id,container);assert.equal(x.Name,'/'+name);assert.equal(x.Config.Labels['com.cashback.moderation-test'],label);assert.equal(x.Config.Image,image);assert.equal(x.HostConfig.NetworkMode,'none');assert(!x.HostConfig.PublishAllPorts);assert.equal(Object.keys(x.HostConfig.PortBindings||{}).length,0);assert(x.Mounts.every(m=>m.Type==='tmpfs'));assert(x.HostConfig.Tmpfs['/var/lib/postgresql/data']);}
function ownerSql(sql,extra=[]){verify();return d(['exec','-i','--user','postgres',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U',owner,'-d',db,...extra],{input:sql});}
class Session {
  constructor(asOwner=false){verify();this.buffer='';this.lines=[];this.next=0;this.pending=null;
    this.child=cp.spawn(docker,['--context','desktop-linux','exec','-i','--user','postgres',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-U',asOwner?owner:runtime,'-d',db],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.stderr.on('data',chunk=>{const m=String(chunk).match(/ERROR:\s+([0-9A-Z]{5})\b/);if(m)lastSqlState=m[1];});this.child.stdin.on('error',()=>{if(this.pending){this.pending.reject(Error('PSQL_INPUT_CLOSED'));this.pending=null;}});
    this.child.stdout.on('data',chunk=>{this.buffer+=chunk;let pos;while((pos=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,pos).replace(/\r$/,'');this.buffer=this.buffer.slice(pos+1);if(this.pending&&line===this.pending.marker){const p=this.pending;this.pending=null;try{p.resolve(JSON.parse(this.lines.join('\n')));}catch{p.reject(Error('PSQL_JSON_PROTOCOL'));}this.lines=[];}else if(line)this.lines.push(line);}});
    this.child.on('error',()=>this.pending?.reject(Error('PSQL_PROCESS_ERROR')));
    this.child.on('exit',code=>{this.closed=true;if(this.pending){this.pending.reject(Error('PSQL_QUERY_FAILED_'+code));this.pending=null;}});
  }
  raw(sql){return new Promise((resolve,reject)=>{if(this.closed||!this.child.stdin.writable)return reject(Error('PSQL_CLOSED'));assert(!this.pending);const marker='__CB_END_'+(++this.next)+'__';this.pending={resolve,reject,marker};this.child.stdin.write(sql+'\n\\echo '+marker+'\n');});}
  query(sql,params=[]){
    const literal=v=>v===null?'NULL':typeof v==='number'?(assert(Number.isFinite(v)),String(v)):typeof v==='boolean'?(v?'true':'false'):"'"+String(v).replaceAll("'","''")+"'";
    const bound=sql.replace(/\$(\d+)\b/g,(_,n)=>literal(params[Number(n)-1]));
    const wrapped=/^\s*SELECT\b/i.test(sql)?'SELECT coalesce(json_agg(_r),\'[]\'::json) FROM ('+bound+') _r;':/\bRETURNING\b/i.test(sql)?'WITH _r AS ('+bound+') SELECT coalesce(json_agg(_r),\'[]\'::json) FROM _r;':bound+"; SELECT '[]'::json;";
    return this.raw(wrapped);
  }
  close(){if(this.child.stdin.writable)this.child.stdin.end('\\q\n');}
}
const dataSource={
  async query(sql,params){const s=new Session();try{return await s.query(sql,params);}finally{s.close();}},
  async transaction(work){const s=new Session();try{await s.raw("BEGIN;\n\\echo []");const value=await work({query:(sql,p)=>s.query(sql,p)});await s.raw("COMMIT;\n\\echo []");return value;}catch(e){try{await s.raw("ROLLBACK;\n\\echo []");}catch{}throw e;}finally{s.close();}}
};
async function main(){
  assert.equal(process.env.CASHBACK_MODERATION_DISPOSABLE_TEST,'1');assert.equal(d(['context','show']),'desktop-linux');
  const before=inventory(),volumes=d(['volume','ls','-q']),networks=d(['network','ls','-q','--no-trunc']);
  assert.equal(d(['ps','-aq','--filter','name=^/'+name+'$']),'');
  container=d(['run','-d','--pull','never','--name',name,'--label','com.cashback.moderation-test='+label,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,size=536870912','-e','POSTGRES_USER='+owner,'-e','POSTGRES_DB='+db,'-e','POSTGRES_PASSWORD',image],{env:{...process.env,POSTGRES_PASSWORD:crypto.randomBytes(32).toString('hex')}});
  verify();for(let n=0;;n++){try{ownerSql('SELECT 1');break;}catch{if(n>=50)throw Error('DISPOSABLE_POSTGRES_NOT_READY');await new Promise(r=>setTimeout(r,200));}}
  const cluster=ownerSql('SELECT system_identifier::text FROM pg_control_system()');assert(!['7698666936429441062','7695793866029359141'].includes(cluster));assert.equal(ownerSql('SELECT current_database()'),db);
  phase='real restore of existing verified D backup';
  const backup='D:/Cashback+ archive/database-backups/postgres-historical-20261021-145329-88043cd80f134b98a147ec5fa414dac2/cashback_historical_03573b7.dump';
  const bytes=fs.readFileSync(backup);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'37102ca644ba97d2888a83b5911e209becd3836ed7b5d4581eac4d07927afb5e');
  const restored='moderation_disposable_restore';ownerSql('CREATE DATABASE '+restored);
  phase='pg_restore existing dump into disposable target';verify();d(['exec','-i','--user','postgres',container,'pg_restore','--exit-on-error','--single-transaction','--no-owner','--no-privileges','-U',owner,'-d',restored],{input:bytes});
  const restoreSql=sql=>{verify();try{return d(['exec','-i','--user','postgres',container,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U',owner,'-d',restored],{input:sql});}catch(e){if(phase.startsWith('restored migration ')||phase==='restored sequence metadata')console.log('MIGRATION_DIAGNOSTIC '+String(e.stderr).slice(0,900));throw e;}};
  const shape=()=>restoreSql("SELECT json_build_object('users',(SELECT count(*) FROM users),'members',(SELECT count(*) FROM forum_users),'topics',(SELECT count(*) FROM forum_topics),'posts',(SELECT count(*) FROM forum_posts),'baseline',(SELECT count(*) FROM historical_schema_baseline))");
  phase='restored baseline/count metadata';const restoredCounts=shape();assert.equal(JSON.parse(restoredCounts).baseline,1);
  phase='restored foreign key integrity';assert.equal(restoreSql("SELECT count(*) FROM forum_posts p LEFT JOIN forum_topics t ON t.id=p.\"topicId\" LEFT JOIN users u ON u.id=p.\"authorId\" WHERE (p.\"topicId\" IS NOT NULL AND t.id IS NULL) OR (p.\"authorId\" IS NOT NULL AND u.id IS NULL)"),'0');
  assert.equal(restoreSql("SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated"),'0');
  assert.equal(restoreSql("SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace AND NOT i.indisvalid"),'0');
  phase='restored sequence metadata';restoreSql(`DO $$ DECLARE r record;s text;maximum bigint;last bigint;BEGIN FOR r IN SELECT table_schema,table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_default LIKE 'nextval%' LOOP s:=pg_get_serial_sequence(format('%I.%I',r.table_schema,r.table_name),r.column_name);IF s IS NULL THEN CONTINUE;END IF;EXECUTE format('SELECT coalesce(max(%I),0) FROM %I.%I',r.column_name,r.table_schema,r.table_name) INTO maximum;EXECUTE format('SELECT last_value FROM %s',s) INTO last;IF last<maximum THEN RAISE EXCEPTION 'RESTORE_SEQUENCE_INVALID';END IF;END LOOP;END $$`);
  ownerSql('CREATE ROLE moderation_restore_legacy LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION');
  restoreSql('GRANT SELECT,INSERT,UPDATE,DELETE ON forum_topics,forum_posts,forum_users TO moderation_restore_legacy;GRANT USAGE,SELECT ON SEQUENCE forum_topics_id_seq,forum_posts_id_seq TO moderation_restore_legacy');
  const freezeSql=fs.readFileSync('docker/historical/migrations/20261024-forum-write-freeze.sql','utf8').replaceAll(':"legacy_runtime_role"','"moderation_restore_legacy"');restoreSql(freezeSql);
  for(const statement of ["INSERT INTO forum_topics(title) VALUES('Forbidden legacy write')","UPDATE forum_users SET username='Forbidden'"]){let blocked=false;try{d(['exec','-i','--user','postgres',container,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U','moderation_restore_legacy','-d',restored],{input:statement});}catch{blocked=true;}assert(blocked);}
  completed.push('pre-migration DB freeze blocks old backend before any schema transition');
  for(const file of ['20261022-content-moderation.sql','20261023-moderation-privacy.sql','20261024-moderation-retention.sql']){phase='restored migration '+file;restoreSql(fs.readFileSync('docker/historical/migrations/'+file,'utf8'));}
  assert.equal(shape(),restoredCounts);assert.equal(restoreSql('SELECT version FROM forum_moderation_schema'),'3');
  completed.push('real D dump restore, FK/index/baseline integrity and migration on restored data');console.log('PASS real restore and migration of existing D backup');
  ownerSql(`CREATE TABLE users(id integer PRIMARY KEY,email_verified boolean NOT NULL,name text,email text,balance numeric DEFAULT 0);
    CREATE TABLE forum_users(id serial PRIMARY KEY,user_id integer UNIQUE REFERENCES users(id),username varchar(30) UNIQUE,ban_reason text,agreed_to_rules boolean NOT NULL,agreed_to_rules_at timestamptz,banned boolean NOT NULL DEFAULT false,avatar_url text,created_at timestamptz DEFAULT now());
    CREATE TABLE forum_topics(id serial PRIMARY KEY,title text NOT NULL,"authorId" integer REFERENCES users(id),created_at timestamptz DEFAULT now());
    CREATE TABLE forum_posts(id serial PRIMARY KEY,content text NOT NULL,"authorId" integer REFERENCES users(id),"topicId" integer REFERENCES forum_topics(id),created_at timestamptz DEFAULT now());
    INSERT INTO users SELECT n,true,'Fixture','fixture'||n||'@example.invalid',0 FROM generate_series(1,20) n;
    INSERT INTO forum_users(user_id,username,agreed_to_rules,agreed_to_rules_at) SELECT n,'Fixture'||n,true,now() FROM generate_series(1,20) n;
    INSERT INTO forum_topics(title,"authorId") VALUES('Existing legacy topic',1);
    INSERT INTO forum_posts(content,"authorId","topicId") VALUES('Existing legacy reply',1,1);`);
  ownerSql(fs.readFileSync('docker/historical/migrations/20261022-content-moderation.sql','utf8'));
  ownerSql(fs.readFileSync('docker/historical/migrations/20261023-moderation-privacy.sql','utf8'));
  ownerSql(`CREATE ROLE ${runtime} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;GRANT CONNECT ON DATABASE ${db} TO ${runtime};GRANT USAGE ON SCHEMA public TO ${runtime};GRANT SELECT ON users,forum_users,forum_topics,forum_posts TO ${runtime};GRANT INSERT ON forum_topics,forum_posts TO ${runtime};GRANT USAGE,SELECT ON SEQUENCE forum_topics_id_seq,forum_posts_id_seq TO ${runtime};INSERT INTO forum_moderators(user_id) VALUES(2),(3);UPDATE forum_users SET rules_version='2026-10-22-reviews-v1';UPDATE users SET email_verified=false WHERE id=19;UPDATE forum_users SET banned=true WHERE user_id=18;`);
  ownerSql(fs.readFileSync('docker/historical/migrations/20261022-content-moderation-grants.sql','utf8'),['-v','runtime_role='+runtime]);
  ownerSql(fs.readFileSync('docker/historical/migrations/20261023-moderation-privacy-grants.sql','utf8'),['-v','runtime_role='+runtime]);
  ownerSql(fs.readFileSync('docker/historical/migrations/20261024-moderation-retention.sql','utf8'));
  ownerSql('CREATE ROLE moderation_legacy_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;GRANT SELECT,INSERT,UPDATE,DELETE ON forum_topics,forum_posts,forum_users TO moderation_legacy_runtime');
  ownerSql(fs.readFileSync('docker/historical/migrations/20261024-moderation-role-fence.sql','utf8'),['-v','legacy_runtime_role=moderation_legacy_runtime','-v','new_runtime_role='+runtime]);
  ownerSql(fs.readFileSync('docker/historical/migrations/20261025-owner-bootstrap.sql','utf8').replaceAll('cashback_hist_moderated_runtime',runtime));
  // Synthetic appointment fixture only in this verified disposable database.
  ownerSql("UPDATE forum_owner_bootstrap SET consumed_at=now(),owner_user_id=2,privacy_acknowledged_at=now(),privacy_document_sha256=repeat('a',64)");
  process.env.CASHBACK_CONTENT_MODERATION='true';
  process.env.CASHBACK_PUBLIC_CONTENT='true';
  const {ContentModerationService}=require('../../dist/forum/content-moderation.service');const service=new ContentModerationService(dataSource);
  const checks=[];const test=async(name,fn)=>{phase=name;await fn();console.log('PASS '+name);checks.push(name);completed.push(name);};
  const reject=async f=>{await assert.rejects(f);};
  await test('migration preserves and queues all legacy material',async()=>{assert.equal(ownerSql('SELECT count(*) FROM forum_content_cases'), '2');assert.equal((await service.read('topics')).length,0);});
  await test('runtime has no elevated privileges or moderator provisioning ability',async()=>{const [r]=await dataSource.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user');assert(Object.values(r).every(x=>x===false));await reject(()=>dataSource.query('INSERT INTO forum_moderators(user_id) VALUES(1)'));});
  await test('current rules require explicit new acceptance with preserved history',async()=>{ownerSql('UPDATE forum_users SET rules_version=NULL WHERE user_id=7');await reject(()=>service.submit(7,'topic',{title:'Not accepted yet'}));await reject(()=>service.acceptRules(7,false));await service.acceptRules(7,true);await service.acceptRules(7,true);assert((await service.acceptance(7)).accepted);assert.equal(ownerSql("SELECT count(*) FROM forum_rule_acceptances WHERE user_id=7 AND version='2026-10-22-reviews-v1'"),'1');});
  await test('unverified and legacy-banned members cannot submit',async()=>{for(const user of [19,18])await reject(()=>service.submit(user,'topic',{title:'Forbidden fixture'}));});
  let positive,negative;
  await test('both positive and negative reviews require moderation and genuine declaration',async()=>{
    await reject(()=>service.submit(1,'review',{title:'Positive experience',body:'The service was helpful and clear.',rating:5}));
    positive=await service.submit(1,'review',{title:'Positive experience',body:'The service was helpful and clear.',rating:5,experienceConfirmed:true},'positive-request');
    negative=await service.submit(4,'review',{title:'A disappointing experience',body:'The interface was confusing and support was slow.',rating:1,experienceConfirmed:true},'negative-request');
    assert.equal((await service.read('reviews')).length,0);await service.decide(2,Number(positive.caseId),'publish','Reviewed genuine positive account');await service.decide(2,Number(negative.caseId),'publish','Lawful criticism is permitted');
    const rows=await service.read('reviews');assert.deepEqual(rows.map(x=>Number(x.rating)).sort(),[1,5]);assert(rows.every(x=>x.status==='published'&&x.demo===false&&!('email' in x.author)&&!('user_id' in x.author)));
    await reject(()=>service.submit(1,'review',{title:'Second review rejected',body:'Another experience on the same account.',rating:5,experienceConfirmed:true}));
  });
  await test('role spoofing, self moderation and duplicate decision cannot add strikes',async()=>{await reject(()=>service.decide(4,Number(negative.caseId),'confirm','Unprivileged decision'));const own=await service.submit(2,'topic',{title:'Moderator own content'});await reject(()=>service.decide(2,Number(own.caseId),'publish','Cannot self approve'));});
  await test('reports are deduplicated and cannot suppress negative reviews or create strikes',async()=>{await service.report(7,Number(negative.caseId),'Please check the published review');await service.report(7,Number(negative.caseId),'Repeated report');assert.equal(ownerSql('SELECT count(*) FROM forum_content_reports'),'1');assert.equal((await service.read('reviews')).length,2);assert.equal((await service.mine(4)).restriction.level,0);});
  await test('concurrent request replay creates exactly one target and case',async()=>{const rows=await Promise.all(Array.from({length:5},()=>service.submit(6,'topic',{title:'Concurrent material'},'concurrent-request')));assert.equal(new Set(rows.map(x=>x.id)).size,1);assert.equal(ownerSql('SELECT count(*) FROM forum_topics WHERE "authorId"=6'),'1');await reject(()=>service.submit(6,'topic',{title:'Changed replay material'},'concurrent-request'));});
  await test('replies to pending or hidden topics cannot bypass parent moderation',async()=>{await reject(()=>service.submit(5,'post',{topicId:1,body:'Reply before approval'}));await service.decide(2,Number(positive.caseId),'hold','Temporarily inspect this material');await reject(()=>service.submit(5,'post',{topicId:positive.id,body:'Hidden parent reply'}));await service.decide(2,Number(positive.caseId),'publish','Reinstated after examination');const p=await service.submit(5,'post',{topicId:positive.id,body:'Lawful reply'});assert.equal((await service.read('posts',positive.id)).length,0);await service.decide(2,Number(p.caseId),'publish','Reply reviewed');assert.equal((await service.read('posts',positive.id)).length,1);});
  const strikes=[];for(let n=0;n<4;n++)strikes.push(await service.submit(10,'topic',{title:'Sanction fixture '+n},'sanction-key-'+n));
  await test('only confirmation counts: warning then one/six calendar months then indefinite',async()=>{
    for(let i=0;i<4;i++){await service.decide(2,Number(strikes[i].caseId),'confirm','Confirmed fixture violation '+i);const s=(await service.mine(10)).restriction;assert.equal(s.level,i+1);assert.equal(s.blocked,i>0);if(i===3)assert.equal(s.until,null);}
    await reject(()=>service.submit(10,'topic',{title:'Blocked publication'}));await reject(()=>service.decide(2,Number(strikes[0].caseId),'confirm','Repeated confirmation'));assert.equal((await service.mine(10)).restriction.level,4);assert.equal((await service.read('reviews')).length,2);
  });
  await test('appeal ownership and independent reversal recalculate without changing legacy ban or bonus data',async()=>{await reject(()=>service.appeal(1,Number(strikes[3].caseId),'Wrong owner'));await service.appeal(10,Number(strikes[3].caseId),'Please review this decision');await reject(()=>service.resolveAppeal(2,Number(strikes[3].caseId),true,'Original reviewer cannot judge appeal'));await service.resolveAppeal(3,Number(strikes[3].caseId),true,'Independent correction');assert.equal((await service.mine(10)).restriction.level,3);await service.resolveAppeal(3,Number(strikes[2].caseId),true,'Manual correction',true);assert.equal((await service.mine(10)).restriction.level,2);assert.equal(ownerSql('SELECT banned FROM forum_users WHERE user_id=10'),'f');assert.equal(ownerSql('SELECT balance FROM users WHERE id=10'),'0');});
  await test('expiry is automatic and read access remains available',async()=>{ownerSql("UPDATE forum_content_cases SET confirmed_at=clock_timestamp()-interval '7 months' WHERE author_id=10 AND confirmed_at IS NOT NULL");assert.equal((await service.mine(10)).restriction.blocked,false);await service.submit(10,'topic',{title:'After expiry publication'});assert((await service.read('topics')).length>0);});
  await test('immutable audit rejects updates and deletion even by fixture owner',async()=>{for(const q of ['UPDATE forum_moderation_events SET action=\'changed\'','DELETE FROM forum_moderation_events']){let failed=false;try{ownerSql(q);}catch{failed=true;}assert(failed);}});
  await test('submission rolls back if audit insert fails',async()=>{ownerSql("CREATE FUNCTION fail_fixture_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.case_id IN(SELECT id FROM forum_content_cases WHERE author_id=11) THEN RAISE EXCEPTION 'FIXTURE'; END IF; RETURN NEW; END $$;CREATE TRIGGER fail_fixture BEFORE INSERT ON forum_moderation_events FOR EACH ROW EXECUTE FUNCTION fail_fixture_audit();");await reject(()=>service.submit(11,'topic',{title:'Atomic rollback fixture'}));assert.equal(ownerSql('SELECT count(*) FROM forum_topics WHERE "authorId"=11'),'0');ownerSql('DROP TRIGGER fail_fixture ON forum_moderation_events;DROP FUNCTION fail_fixture_audit()');});
  await test('switching flag off cannot publish pending content through legacy reads',async()=>{process.env.CASHBACK_CONTENT_MODERATION='false';assert.equal((await service.configuration()).enabled,false);assert((await service.read('reviews')).length===2);await reject(()=>service.submit(12,'topic',{title:'Disabled publishing'}));assert.equal((await service.read('topics')).some(x=>x.title==='Concurrent material'),false);process.env.CASHBACK_CONTENT_MODERATION='true';});
  await test('profile and sanctions share one lock through commit; reversal and publication preserve state',async()=>{
    ownerSql('GRANT UPDATE(username) ON forum_users TO '+runtime);
    const a=await service.submit(14,'topic',{title:'First fixture violation'}),b=await service.submit(14,'topic',{title:'Second fixture violation'});
    await service.decide(2,Number(a.caseId),'confirm','First reviewed decision');
    let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
    const profile=service.withCommunication(14,async m=>{await m.query('UPDATE forum_users SET username=$2 WHERE user_id=$1',[14,'UpdatedBeforeSanction']);entered();await gate;});
    await started;let finished=false;const sanction=service.decide(2,Number(b.caseId),'confirm','Second reviewed decision').then(x=>{finished=true;return x;});
    let waiting=false;try{for(let n=0;n<30;n++){if(ownerSql("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND classid=62022 AND objid=14 AND NOT granted")!=='0'){waiting=true;break;}await new Promise(r=>setTimeout(r,100));}assert.equal(finished,false);}finally{release();}await profile;await sanction;assert(waiting,'Sanction must actually wait on the shared advisory lock');
    await reject(()=>service.withCommunication(14,async m=>m.query('UPDATE forum_users SET username=$2 WHERE user_id=$1',[14,'Bypass'])));
    await reject(()=>service.submit(14,'topic',{title:'Bypass while restricted'}));
    assert.equal(ownerSql('SELECT username FROM forum_users WHERE user_id=14'),'UpdatedBeforeSanction');
    await service.resolveAppeal(3,Number(b.caseId),true,'Independently revoked erroneous decision',true);
    await Promise.all([service.withCommunication(14,async m=>m.query('UPDATE forum_users SET username=$2 WHERE user_id=$1',[14,'AfterReversal'])),service.submit(14,'topic',{title:'Allowed after reversal'})]);
    assert.equal((await service.mine(14)).restriction.level,1);assert.equal(ownerSql('SELECT balance FROM users WHERE id=14'),'0');
  });
  await test('personal-data erasure purges sensitive links without disabling audit protections',async()=>{
    const r=await service.submit(15,'review',{title:'Personal fixture title',body:'Personal actual experience fixture text',rating:2,experienceConfirmed:true});
    await service.decide(2,Number(r.caseId),'publish','Personal fixture reviewer explanation');
    await reject(()=>dataSource.query('SELECT forum_erase_personal_data(15)'));
    await reject(()=>dataSource.query("SET cashback.privacy_maintenance='on'; DELETE FROM forum_moderation_events"));
    ownerSql("UPDATE forum_users SET username='Removed_15' WHERE user_id=17;UPDATE forum_users SET ban_reason='Personal fixture reason' WHERE user_id=15");
    ownerSql('SELECT forum_erase_personal_data(15)');
    assert.equal(ownerSql('SELECT count(*) FROM forum_users WHERE user_id=15 AND ban_reason IS NOT NULL'),'0');assert.equal(ownerSql('SELECT username FROM forum_users WHERE user_id=17'),'Removed_15');
    assert.equal(ownerSql('SELECT count(*) FROM forum_event_identities WHERE subject_id=15 OR actor_id=15'),'0');
    assert.equal(ownerSql('SELECT count(*) FROM forum_rule_acceptances WHERE user_id=15'),'0');
    assert.equal(ownerSql('SELECT count(*) FROM forum_moderation_events WHERE case_id='+r.caseId),'0');
    assert.equal(ownerSql('SELECT count(*) FROM forum_content_cases WHERE author_id=15'),'0');
    assert.equal(ownerSql('SELECT count(*) FROM forum_topics WHERE \"authorId\"=15'),'0');
    assert.equal((await service.read('reviews')).some(x=>x.id===r.id),false);
    await reject(()=>service.submit(15,'topic',{title:'No consent after erasure'}));
    ownerSql('DELETE FROM users WHERE id=15');assert.equal(ownerSql('SELECT count(*) FROM users WHERE id=15'),'0');
    let failed=false;try{ownerSql("UPDATE forum_moderation_events SET action='tampered'");}catch{failed=true;}assert(failed);
  });
  await test('account deletion rollback preserves moderation data when another application dependency rejects deletion',async()=>{
    const a=await service.submit(16,'topic',{title:'Preserve fixture on failed account deletion'});
    ownerSql('CREATE TABLE unrelated_account_dependency(user_id integer REFERENCES users(id)); INSERT INTO unrelated_account_dependency VALUES(16)');
    let rejected=false;try{ownerSql('DELETE FROM users WHERE id=16');}catch{rejected=true;}assert(rejected);
    assert.equal(ownerSql('SELECT count(*) FROM forum_content_cases WHERE id='+a.caseId+' AND author_id=16'),'1');
    assert.equal(ownerSql('SELECT title FROM forum_topics WHERE id='+a.id),'Preserve fixture on failed account deletion');
    ownerSql('DROP TABLE unrelated_account_dependency');
  });
  await test('retention purge requires owner authorization and removes expired sensitive explanations',async()=>{
    await reject(()=>dataSource.query('SELECT forum_purge_expired_details(clock_timestamp())'));
    const beforeCount=Number(ownerSql('SELECT count(*) FROM forum_event_details'));ownerSql("SELECT forum_purge_expired_details(clock_timestamp())");assert.equal(Number(ownerSql('SELECT count(*) FROM forum_event_details')),beforeCount);
    assert(Number(ownerSql('SELECT count(*) FROM forum_moderation_events'))>0);
  });
  await test('privacy follow-up migration cannot be applied twice or partially change schema',async()=>{
    let refused=false;try{ownerSql(fs.readFileSync('docker/historical/migrations/20261023-moderation-privacy.sql','utf8'));}catch{refused=true;}assert(refused);assert.equal(ownerSql('SELECT version FROM forum_moderation_schema'),'3');
  });
  await test('legacy backend role cannot write topics, messages, reviews, sanctions or appeals after migration',async()=>{
    const legacy=sql=>d(['exec','-i','--user','postgres',container,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U','moderation_legacy_runtime','-d',db],{input:sql});
    for(const sql of ["INSERT INTO forum_topics(title,\"authorId\") VALUES('Bypass',1)","INSERT INTO forum_posts(content,\"authorId\",\"topicId\") VALUES('Bypass',1,1)","UPDATE forum_users SET username='Bypass' WHERE user_id=1","INSERT INTO forum_content_cases(kind,target_id,author_id,request_key,request_hash) VALUES('review',999,1,'bypass','bypass')","UPDATE forum_content_cases SET state='published' WHERE id=1","INSERT INTO forum_content_appeals(case_id,user_id,reason) VALUES(1,1,'Bypass')"]){let denied=false;try{legacy(sql);}catch{denied=true;}assert(denied);}
    let hiddenReadDenied=false;try{legacy('SELECT count(*) FROM forum_topics');}catch{hiddenReadDenied=true;}assert(hiddenReadDenied);assert.equal(legacy('SELECT count(*) FROM forum_users'),ownerSql('SELECT count(*) FROM forum_users'));
    legacy('BEGIN; SELECT id FROM forum_users WHERE user_id=1 FOR UPDATE; ROLLBACK;');
  });
  await test('cleanup protects open appeals and valid holds, preserves strikes and serializes concurrent appeals',async()=>{
    const a=await service.submit(12,'topic',{title:'Old reviewable material'});await service.decide(2,Number(a.caseId),'confirm','Old decision context');
    ownerSql("BEGIN;SET LOCAL cashback.privacy_maintenance='on';UPDATE forum_content_cases SET created_at=clock_timestamp()-interval '400 days',confirmed_at=clock_timestamp()-interval '400 days' WHERE id="+a.caseId+";UPDATE forum_moderation_events SET created_at=clock_timestamp()-interval '400 days' WHERE case_id="+a.caseId+";COMMIT;");
    await service.appeal(12,Number(a.caseId),'Appeal requires the old evidence');ownerSql('SELECT forum_purge_expired_details(clock_timestamp())');assert.equal(ownerSql('SELECT count(*) FROM forum_event_details d JOIN forum_moderation_events e ON e.id=d.event_id WHERE e.case_id='+a.caseId),'2');
    let refused=false;try{ownerSql('SELECT forum_erase_personal_data(12)');}catch{refused=true;}assert(refused);
    await service.resolveAppeal(3,Number(a.caseId),false,'Independent decision upheld');
    // Old event time alone cannot purge a newly resolved appeal.
    ownerSql('SELECT forum_purge_expired_details(clock_timestamp())');assert.equal(ownerSql('SELECT count(*) FROM forum_content_cases WHERE id='+a.caseId+' AND material_erased_at IS NOT NULL'),'0');
    ownerSql("BEGIN;SET LOCAL cashback.privacy_maintenance='on';UPDATE forum_moderation_events SET created_at=clock_timestamp()-interval '400 days' WHERE case_id="+a.caseId+";UPDATE forum_content_appeals SET resolved_at=clock_timestamp()-interval '400 days' WHERE case_id="+a.caseId+";INSERT INTO forum_retention_holds(case_id,basis,reference,approved_by,review_at,expires_at) VALUES("+a.caseId+",'legal_claim','case-reference-no-PII','Authorized operator',clock_timestamp()+interval '1 day',clock_timestamp()+interval '2 days');COMMIT;");
    ownerSql('SELECT forum_purge_expired_details(clock_timestamp())');assert.equal(ownerSql('SELECT count(*) FROM forum_content_cases WHERE id='+a.caseId+' AND material_erased_at IS NOT NULL'),'0');
    ownerSql('UPDATE forum_retention_holds SET review_at=clock_timestamp()-interval \'2 days\',expires_at=clock_timestamp()-interval \'1 day\' WHERE case_id='+a.caseId);
    const level=(await service.mine(12)).restriction.level;ownerSql('SELECT forum_purge_expired_details(clock_timestamp())');assert.equal((await service.mine(12)).restriction.level,level);assert.equal(ownerSql('SELECT count(*) FROM forum_content_cases WHERE id='+a.caseId+' AND material_erased_at IS NOT NULL'),'1');
    await reject(()=>service.decide(2,Number(a.caseId),'publish','Cannot restore erased material'));
    let lateHoldRefused=false;try{ownerSql("INSERT INTO forum_retention_holds(case_id,basis,reference,approved_by,review_at,expires_at) VALUES("+a.caseId+",'legal_claim','late-reference','Authorized operator',clock_timestamp()+interval '1 day',clock_timestamp()+interval '2 days')");}catch{lateHoldRefused=true;}assert(lateHoldRefused);
    const b=await service.submit(13,'topic',{title:'Concurrent appeal material'});await service.decide(2,Number(b.caseId),'confirm','Concurrent appeal decision');
    const session=new Session(true);await session.raw('BEGIN;\n\\echo []');await session.query('SELECT pg_advisory_xact_lock(62023,1)');
    let finished=false;const appeal=service.appeal(13,Number(b.caseId),'Do not lose my concurrent appeal').then(()=>finished=true);
    let waiting=false;try{for(let n=0;n<30;n++){if(ownerSql("SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND classid=62023 AND objid=1 AND NOT granted")!=='0'){waiting=true;break;}await new Promise(r=>setTimeout(r,100));}assert.equal(finished,false);await session.query('SELECT forum_purge_expired_details(clock_timestamp())');}finally{await session.raw('COMMIT;\n\\echo []');session.close();}
    await appeal;assert(waiting);assert.equal(ownerSql('SELECT count(*) FROM forum_content_appeals WHERE case_id='+b.caseId+' AND outcome IS NULL'),'1');

  });
  await test('holds cannot be indefinite and read-only rollback rejects service writes',async()=>{
    for(const values of ["'infinity','infinity'","clock_timestamp()+interval '2 years',clock_timestamp()+interval '3 years'"]){let refused=false;try{ownerSql("INSERT INTO forum_retention_holds(case_id,basis,reference,approved_by,review_at,expires_at) VALUES(1,'legal_claim','non-PII-ref','Authorized operator',"+values+")");}catch{refused=true;}assert(refused);}
    process.env.CASHBACK_FORUM_READ_ONLY='true';try{await reject(()=>service.submit(1,'topic',{title:'Read-only bypass'}));await reject(()=>service.acceptRules(1,true));assert((await service.read('reviews')).length===2);}finally{delete process.env.CASHBACK_FORUM_READ_ONLY;}
  });
  assert.deepEqual(inventory().filter(x=>x[0]!==container),before);assert.equal(d(['volume','ls','-q']),volumes);assert.equal(d(['network','ls','-q','--no-trunc']),networks);
  return {status:'ISOLATED_MODERATION_POSTGRES_PASS',cluster,database:db,restore:{performed:true,dumpSha256:'37102ca644ba97d2888a83b5911e209becd3836ed7b5d4581eac4d07927afb5e',counts:JSON.parse(restoredCounts)},checks:[...completed],existingResourcesUnchanged:true};
}
(async()=>{let result;try{result=await main();}catch(e){result={status:'ISOLATED_MODERATION_POSTGRES_FAILED',error:e.name,exitStatus:e.status,systemCode:e.code,phase,completed,lastSqlState,message:'See phase and SQLSTATE; raw database errors suppressed'};process.exitCode=1;}finally{if(container){try{verify();d(['rm','-f',container]);result.cleanup='Exact labelled temporary container removed; no volumes created';}catch{result.cleanup='PRESERVED_FOR_REVIEW';process.exitCode=1;}}}fs.writeFileSync(process.env.CASHBACK_MODERATION_TEST_RESULT||'work/content-moderation-postgres-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));})();
