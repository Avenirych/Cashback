'use strict';
// Exact disposable identities from this task only. No real account or balance changes.
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const dir='D:/Cashback+ archive/releases/activity-20261023',r=JSON.parse(fs.readFileSync(dir+'/functional-browser/results.json'));
const docker=process.env.LOCALAPPDATA+'/Programs/DockerDesktop/resources/bin/docker.exe';
const d=a=>cp.execFileSync(docker,['--context','desktop-linux',...a],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const {ownerSql,fingerprintQuery}=require('./backup-activity-release.cjs');
async function main(){assert(r.status==='FUNCTIONAL_BROWSER_PASS'||(process.argv.includes('--failed-run')&&r.status==='FUNCTIONAL_BROWSER_FAILED'));assert.equal(r.accounts.length,2);const ids=r.accounts.map(a=>a.id);assert(ids.every(id=>Number.isSafeInteger(id)&&id>0&&id<=2147483647));assert.equal(new Set(ids).size,2);for(const a of r.accounts)assert(/^qa-activity-[a-f0-9]{16}@example\.invalid$/.test(a.email));
 const release=JSON.parse(fs.readFileSync(dir+'/release.json')),backend=release.result.replacements.backend;
 const networks=JSON.parse(d(['network','inspect',...d(['network','ls','-q']).split(/\r?\n/)]));const sources=['127.0.0.1','::1',...networks.flatMap(n=>(n.IPAM.Config||[]).map(c=>c.Gateway).filter(Boolean))];sources.push(...sources.filter(s=>s.includes('.')).map(s=>'::ffff:'+s));
 const identity={emails:r.accounts.map(a=>a.email),sources};
 const code=`const c=require('node:crypto'),v=${JSON.stringify(identity)},h=(d,s)=>c.createHmac('sha256',process.env.JWT_SECRET).update('activity-v1:'+d+':'+s).digest('hex');const subjects=v.emails.flatMap(e=>['a:'+h('account',e),...v.sources.map(s=>'s:'+h('pair',e+String.fromCharCode(0)+s))]);console.log(JSON.stringify({subjects,events:subjects.map(s=>h('event',s))}));`;
 const opaque=JSON.parse(d(['exec',backend,'node','-e',code]));const lit=s=>"'"+s.replaceAll("'","''")+"'";const subjects=[...ids.map(id=>'u:'+id),...opaque.subjects];
 const ownHashes=JSON.parse(d(['exec',backend,'node','-e',`const c=require('node:crypto');console.log(JSON.stringify(${JSON.stringify(ids)}.map(id=>c.createHmac('sha256',process.env.JWT_SECRET).update('activity-v1:event:u:'+id).digest('hex'))));`]));
 const predicates=r.accounts.map((a,i)=>`(id=${a.id} AND email=${lit(a.email)} AND name=${lit('Demo '+['Alpha','Beta'][i])})`).join(' OR ');
 if(process.argv.includes('--failed-run')){
  assert.equal(ownerSql(`SELECT count(*) FROM users WHERE (${predicates}) AND balance=0 AND email_verified=true`),'2');
  const removed=JSON.parse(d(['exec',backend,'node','-e',`const {DemoReviewStore}=require('./dist/forum/demo-review-store');(async()=>{const s=new DemoReviewStore('/app/demo-reviews');const out=[];for(const id of ${JSON.stringify(ids)})out.push(await s.removeOwn(id));console.log(JSON.stringify(out));})().catch(()=>process.exit(1));`]));assert(removed.every(x=>x.removed>=0&&x.removed<=3));
  const remaining=[];for(let page=1;;page++){const q=await(await fetch('http://127.0.0.1:3006/demo-reviews?page='+page)).json();remaining.push(...q.items.map(x=>x.id));if(page*10>=q.total)break;}assert.deepEqual(remaining.sort(),r.originalReviewIds.sort());
 }
 const sql=`BEGIN; DO $qa$ DECLARE n integer; dep record; BEGIN
 IF current_database()<>'cashback_historical_03573b7' THEN RAISE EXCEPTION 'WRONG_DATABASE'; END IF;
 PERFORM id FROM users WHERE id=ANY(ARRAY[${ids}]) FOR UPDATE;
 SELECT count(*) INTO n FROM users WHERE (${predicates}) AND balance=0 AND email_verified=true AND created_at::date=CURRENT_DATE;
 IF n<>2 THEN RAISE EXCEPTION 'DISPOSABLE_IDENTITY_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM activity_limit_operations WHERE user_id=ANY(ARRAY[${ids}]) AND mode='real') THEN RAISE EXCEPTION 'REAL_OPERATION_PRESENT'; END IF;
 FOR dep IN SELECT conrelid::regclass::text tbl,a.attname col FROM pg_constraint x JOIN pg_attribute a ON a.attrelid=x.conrelid AND a.attnum=x.conkey[1] WHERE contype='f' AND confrelid='users'::regclass LOOP
 IF dep.tbl NOT IN ('forum_users','activity_limit_operations','activity_limit_appeals','activity_user_plans') THEN EXECUTE format('SELECT count(*) FROM %I WHERE %I=ANY($1)',dep.tbl,dep.col) INTO n USING ARRAY[${ids}]; IF n<>0 THEN RAISE EXCEPTION 'UNEXPECTED_DEPENDENCY'; END IF; END IF; END LOOP;
 DELETE FROM activity_limit_operations WHERE subject=ANY(ARRAY[${subjects.map(lit)}]::text[]);
 DELETE FROM activity_limit_usage WHERE subject=ANY(ARRAY[${subjects.map(lit)}]::text[]);
 DELETE FROM activity_security_events WHERE subject_hash=ANY(ARRAY[${[...opaque.events,...ownHashes].map(lit)}]::text[]);
 DELETE FROM forum_users WHERE user_id=ANY(ARRAY[${ids}]);
 DELETE FROM users WHERE id=ANY(ARRAY[${ids}]);GET DIAGNOSTICS n=ROW_COUNT;IF n<>2 THEN RAISE EXCEPTION 'USER_COUNT'; END IF;
 END $qa$; COMMIT;`;
 for(let i=0;i<r.messageIds.length;i++){const m=await(await fetch('http://127.0.0.1:8036/api/v1/message/'+r.messageIds[i])).json();assert(m.To.some(t=>r.accounts.some(a=>a.email===t.Address)));}
 ownerSql(sql);const backup=JSON.parse(fs.readFileSync('D:/Cashback+ archive/backups/activity-pre-migration-20261023/verification.json'));for(const [table,value]of Object.entries(backup.tables))assert.equal(ownerSql(fingerprintQuery(table)),value,'BASELINE_CHANGED_'+table);
 const response=await fetch('http://127.0.0.1:8036/api/v1/messages',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({IDs:r.messageIds})});assert(response.ok);for(const id of r.messageIds)assert.equal((await fetch('http://127.0.0.1:8036/api/v1/message/'+id)).status,404);
 const mailbox=await(await fetch('http://127.0.0.1:8036/api/v1/messages')).json();for(const id of r.baselineMessageIds)assert(mailbox.messages.some(m=>m.ID===id));
 const result={originalMessagesPreserved:r.baselineMessageIds.length,status:'EXACT_TEST_CLEANUP_PASS',users:ids,messages:r.messageIds.length,baseTablesUnchanged:11,globalCapacityAuditRetained:true};fs.writeFileSync(dir+'/functional-browser/cleanup.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error('EXACT_TEST_CLEANUP_STOP: '+String(e.message).slice(0,180));process.exitCode=1;});
