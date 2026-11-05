'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),yaml=require('js-yaml');
const {validate,origin,secretDirectory,inputs}=require('./validate.cjs'),contract=require('./security-contract.cjs');
const config=yaml.load(fs.readFileSync(path.join(__dirname,'../compose.staging.yaml'),'utf8'));
const nginx=fs.readFileSync(path.join(__dirname,'nginx.conf'),'utf8'),headers=fs.readFileSync(path.join(__dirname,'security-headers.conf'),'utf8');
test('mTLS topology, proxy, headers and pinned source contract',()=>assert.equal(contract.files(),true));
for(const [name,mutate]of Object.entries({
 'public HTTPS':c=>c.services.frontend.ports=['0.0.0.0:33004:8443'],
 'published plaintext':c=>c.services.frontend.ports.push('127.0.0.1:33005:8080'),
 'health published':c=>c.services.frontend.ports.push('127.0.0.1:33006:8081'),
 'foreign backend network':c=>c.services.backend.networks.push('outside'),
 'frontend entrypoint bypass':c=>c.services.frontend.entrypoint=['nginx'],
 'resource removed':c=>delete c.services.backend.mem_limit,
 'resource enlarged':c=>c.services.backend.mem_limit='8g',
 'swap unbounded':c=>c.services.postgres.memswap_limit='-1',
 'CPU unbounded':c=>delete c.services.backend.cpus,
 'pids unbounded':c=>c.services.mail.pids_limit=-1,
 'tmpfs unbounded':c=>c.services.frontend.tmpfs=['/tmp'],
 'logs unbounded':c=>delete c.services.postgres.logging,
 'postgres command injection':c=>c.services.postgres.command=['sh','-c','migration-command'],
 'postgres query logging':c=>c.services.postgres.command[c.services.postgres.command.indexOf('log_statement=none')]='log_statement=all',
 'wrong image digest':c=>c.services.backend.build.args.NODE_IMAGE=c.services.backend.build.args.NODE_IMAGE.replace(/.$/,'1'),
 'foreign publisher':c=>c.services.mail.image=c.services.mail.image.replace('axllent/','untrusted/'),
 'missing client CA':c=>c.services.frontend.secrets=c.services.frontend.secrets.filter(x=>x!=='tester_ca'),
 'missing CRL':c=>c.services.frontend.secrets=c.services.frontend.secrets.filter(x=>x!=='tester_crl'),
 'secret from repo':c=>c.secrets.web_key.file='./docker/staging/secrets/web_key',
 'extra secret file':c=>c.secrets.owner_private_ca={file:'/etc/ca/private_key'},
 'historical mode':c=>c.services.backend.environment.HISTORICAL_LOCAL='true',
 'demo disabled':c=>c.services.backend.environment.CASHBACK_DEMO_ONLY='false',
 'financial override':c=>c.services.backend.environment.FINANCE_ENABLED='true',
 'root frontend':c=>c.services.frontend.user='0:0',
 'privileged pg capability':c=>c.services.postgres.cap_add.push('SYS_ADMIN')
}))test('rejects '+name,()=>{const c=structuredClone(config);mutate(c);assert.throws(()=>validate(c));});
for(const value of ['http://staging.example.test','https://localhost','https://127.0.0.1','https://a.local','https://a.internal','https://user:dummy@staging.example.test','https://staging.example.test/path','https://staging.example.test:443','https://staging.example.test;echo','https://staging.example.test\n'])test('refuses noncanonical origin '+JSON.stringify(value),()=>assert.throws(()=>origin(value)));
test('canonical owner-selected origin accepted for syntax only',()=>assert.equal(origin('https://staging.example.test:33004'),'https://staging.example.test:33004'));
for(const value of [undefined,'secrets','./secrets','/app/secrets','/etc/cashback-staging/secrets/../other','D:/secrets','/etc/cashback-staging/secrets/'])test('refuses secret path '+JSON.stringify(value),()=>assert.throws(()=>secretDirectory(value)));
test('required inputs reject absence and historical cluster',()=>{assert.throws(()=>inputs({}));assert.throws(()=>inputs({STAGING_SECRET_DIR:'/etc/cashback-staging/secrets',STAGING_FRONTEND_ORIGIN:'https://staging.example.test',STAGING_DB_SYSTEM_IDENTIFIER:'7698666936429441062'}));});
for(const [name,mutate]of Object.entries({off:s=>s.replace('ssl_verify_client on;','ssl_verify_client off;'),optional:s=>s.replace('ssl_verify_client on;','ssl_verify_client optional;'),noCRL:s=>s.replace('ssl_crl /run/secrets/tester_crl;',''),healthProxy:s=>s.replace("location = /healthz { return 200 'ok'; }","location = /healthz { proxy_pass http://backend:3001; }"),redirectHost:s=>s.replace('${STAGING_FRONTEND_ORIGIN}$request_uri','$host$request_uri'),missingHeaders:s=>s.replace('include /etc/nginx/staging-security-headers.conf;','')}))test('template tamper rejected '+name,()=>assert.throws(()=>contract.nginx(mutate(nginx),headers)));
test('CLI failure does not reflect a secret-like malformed URL',()=>{const value='https://user:NOT_A_REAL_CREDENTIAL@staging.example.test';const r=cp.spawnSync(process.execPath,[path.join(__dirname,'validate.cjs')],{encoding:'utf8',env:{...process.env,STAGING_FRONTEND_ORIGIN:value}});assert.notEqual(r.status,0);assert.ok(!r.stderr.includes('NOT_A_REAL_CREDENTIAL'));assert.match(r.stderr,/STAGING_CONFIGURATION_REFUSED/);});
test('shell syntax without execution or VM access',()=>{assert.ok(process.env.STAGING_TEST_SHELL,'explicit existing shell required');for(const name of ['frontend-entry.sh','read-only-preflight.sh','postgres-entry.sh']){const r=cp.spawnSync(process.env.STAGING_TEST_SHELL,['-n',path.join(__dirname,name)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}});
test('context rules retain COPY sources and exclude known secret/artifact paths',()=>{const mod=require('minimatch'),match=typeof mod==='function'?mod:mod.minimatch;function included(n,p){const rules=fs.readFileSync(path.join(__dirname,n+'.Dockerfile.dockerignore'),'utf8').split(/\r?\n/).filter(x=>x&&!x.startsWith('#'));let yes=true;for(const l of rules){const allow=l.startsWith('!'),pattern=allow?l.slice(1):l;const candidates=allow?[p]:[p,...p.split('/').slice(0,-1).map((_,i)=>p.split('/').slice(0,i+1).join('/'))];if(candidates.some(v=>match(v,pattern.replace(/\/$/,''),{dot:true})))yes=allow;}return yes;}
 for(const n of ['backend','frontend','postgres'])for(const file of ['.git/config','.env','private.pem','docker/staging/secrets/web_key','src/secrets/jwt_secret','cashback-frontend/public/.env.local','src/key.pem','src/node_modules/a/index.js'])assert.equal(included(n,file),false,n+': '+file);
 for(const [n,paths]of Object.entries({backend:['package.json','src/main.ts','docker/staging/backend-entry.cjs'],frontend:['cashback-frontend/src/App.tsx','cashback-frontend/public/index.html','docker/staging/frontend-entry.sh','docker/staging/security-headers.conf'],postgres:['docker/staging/postgres-entry.sh','docker/staging/pg_hba.conf']}))for(const file of paths)assert.equal(included(n,file),true,n+': '+file);
});
test('free space is not falsely reported as a hard ext4 quota',()=>{const p=require('./resource-policy.json');assert.equal(p.volumeQuotaEnforced,false);assert.match(p.volumeQuotaStatus,/BLOCKED/);const s=fs.readFileSync(path.join(__dirname,'read-only-preflight.sh'),'utf8');assert.match(s,/VOLUME_QUOTA_UNRESOLVED/);assert.match(s,/exit 2/);const calls=[...s.matchAll(/\bdocker\s+-H\s+unix:\/\/\/var\/run\/docker\.sock\s+([a-z-]+)/g)];assert.equal(calls.length,3);for(const call of calls)assert.ok(['info','ps'].includes(call[1]));});
