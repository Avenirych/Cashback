'use strict';
// Offline validation. No daemon, database, secret contents or network requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),yaml=require('js-yaml');
const root=path.resolve(__dirname,'../..');
const pins=require('./image-pins.json').images,policy=require('./resource-policy.json');
const secrets=['pg_owner_password','db_password','jwt_secret','smtp_password','pg_cert','pg_key','mail_cert','mail_key','mail_auth','staging_ca','web_cert','web_key','tester_ca','tester_crl'];
const mounts={postgres:['pg_owner_password','pg_cert','pg_key'],backend:['db_password','jwt_secret','smtp_password','staging_ca'],mail:['mail_cert','mail_key','mail_auth'],frontend:['web_cert','web_key','tester_ca','tester_crl']};
const tmpfs={postgres:['/run/staging-tls:size=1m,mode=0700','/var/run/postgresql:size=16m','/tmp:size=64m'],backend:['/tmp:size=64m,uid=1000,gid=1000,mode=0700'],mail:['/tmp:size=32m,uid=1000,gid=1000,mode=0700'],frontend:['/tmp:size=32m,uid=101,gid=101,mode=0700']};
function images(env){for(const [key,expected] of Object.entries({STAGING_NODE_IMAGE:pins.node,STAGING_POSTGRES_IMAGE:pins.postgres,STAGING_NGINX_IMAGE:pins.nginx,STAGING_MAILPIT_IMAGE:pins.mailpit}))assert.equal(env[key],expected,'IMAGE_PIN_REFUSED');return true;}
function origin(value){let u;try{u=new URL(value);}catch{throw Error('STAGING_ORIGIN_REFUSED');}assert.ok(u.protocol==='https:'&&u.origin===value&&u.pathname==='/'&&!u.username&&!u.password&&!u.search&&!u.hash,'STAGING_ORIGIN_REFUSED');const h=u.hostname;assert.match(h,/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);assert.ok(!/^[0-9.]+$/.test(h)&&!/(^|\.)(localhost|local|internal)$/.test(h),'STAGING_ORIGIN_REFUSED');return value;}
function secretDirectory(value){assert.equal(value,'/etc/cashback-staging/secrets','STAGING_SECRET_PATH_REFUSED');assert.equal(path.posix.normalize(value),value);return value;}
function inputs(env){origin(env.STAGING_FRONTEND_ORIGIN);secretDirectory(env.STAGING_SECRET_DIR);assert.match(env.STAGING_DB_SYSTEM_IDENTIFIER||'',/^\d{19,20}$/);assert.notEqual(env.STAGING_DB_SYSTEM_IDENTIFIER,'7698666936429441062');return true;}
function validate(c){
 assert.equal(c.name,'cashback-staging-b02');assert.deepEqual(Object.keys(c.services).sort(),['backend','frontend','mail','postgres']);assert.deepEqual(Object.keys(c.volumes).sort(),['staging-avatars','staging-pg-data']);assert.deepEqual(Object.keys(c.networks).sort(),['application','database','mail']);
 for(const n of Object.values(c.networks))assert.deepEqual(n,{internal:true});for(const v of Object.values(c.volumes))assert.ok(v===null||Object.keys(v).length===0);
 const networks={postgres:['database'],mail:['mail'],backend:['application','database','mail'],frontend:['application']};
 for(const [name,s] of Object.entries(c.services)){
  for(const k of ['container_name','network_mode','env_file','privileged','entrypoint','extra_hosts','links','external_links','devices','volumes_from','configs','group_add','post_start','pre_start','pre_stop','use_api_socket','oom_kill_disable'])assert.equal(s[k],undefined,name+': forbidden setting');
  assert.equal(s.platform,'linux/amd64');assert.equal(s.restart,'no');assert.deepEqual(s.security_opt,['no-new-privileges:true']);assert.deepEqual(s.networks,networks[name]);assert.deepEqual(s.secrets,mounts[name]);assert.deepEqual(s.tmpfs,tmpfs[name]);assert.ok(s.healthcheck?.test);
  for(const [k,value]of Object.entries(policy.services[name]))assert.equal(s[k],value,'RESOURCE_LIMIT_REFUSED');
  assert.deepEqual(s.logging,{driver:'local',options:{'max-size':'5m','max-file':'2'}});
  if(name!=='postgres'){assert.equal(s.read_only,true);assert.deepEqual(s.cap_drop,['ALL']);assert.equal(s.cap_add,undefined);assert.equal(s.command,undefined);}else{assert.equal(s.read_only,undefined);assert.deepEqual(s.cap_drop,['ALL']);assert.deepEqual(s.cap_add,['CHOWN','DAC_OVERRIDE','FOWNER','SETGID','SETUID']);assert.equal(s.shm_size,'128m');}
  if(name!=='frontend')assert.equal(s.ports,undefined);else assert.deepEqual(s.ports,['127.0.0.1:33004:8443']);
 }
 assert.deepEqual(c.services.postgres.volumes,['staging-pg-data:/var/lib/postgresql/data']);assert.deepEqual(c.services.backend.volumes,['staging-avatars:/app/public/avatars']);assert.equal(c.services.frontend.volumes,undefined);assert.equal(c.services.mail.volumes,undefined);
 assert.equal(c.services.backend.user,undefined);assert.equal(c.services.postgres.user,undefined);assert.equal(c.services.frontend.user,'101:101');assert.equal(c.services.mail.user,'1000:1000');
 images({STAGING_NODE_IMAGE:c.services.backend.build.args.NODE_IMAGE,STAGING_POSTGRES_IMAGE:c.services.postgres.build.args.POSTGRES_IMAGE,STAGING_NGINX_IMAGE:c.services.frontend.build.args.NGINX_IMAGE,STAGING_MAILPIT_IMAGE:c.services.mail.image});assert.equal(c.services.frontend.build.args.NODE_IMAGE,pins.node);
 for(const n of ['backend','frontend','postgres']){assert.equal(c.services[n].build.context,'..');assert.equal(c.services[n].build.dockerfile,'docker/staging/'+n+'.Dockerfile');assert.equal(c.services[n].build.secrets,undefined);}
 assert.deepEqual(c.services.postgres.command,['postgres',...Object.entries(policy.postgresSettings).flatMap(([k,v])=>['-c',k+'='+v])],'POSTGRES_STARTUP_REFUSED');
 assert.deepEqual(Object.keys(c.services.frontend.environment),['STAGING_FRONTEND_ORIGIN']);
 const e=c.services.backend.environment;
 const ui=c.services.frontend.build.args.STAGING_WORKFLOWS;
 assert.ok(ui===undefined||ui==='disabled'||ui==='synthetic-v1','FRONTEND_FUNCTIONAL_PROFILE_REFUSED');
 if(ui==='synthetic-v1')assert.equal(e.CASHBACK_STAGING_WORKFLOWS,'synthetic-v1','FRONTEND_BACKEND_CAPABILITY_MISMATCH');
 assert.ok(e.CASHBACK_STAGING_WORKFLOWS===undefined||e.CASHBACK_STAGING_WORKFLOWS==='disabled'||e.CASHBACK_STAGING_WORKFLOWS==='synthetic-v1','FUNCTIONAL_PROFILE_REFUSED');
 for(const key of ['CASHBACK_FINANCIAL_ADMISSION','CASHBACK_FINANCIAL_API','CASHBACK_FINANCIAL_WRITES','DB_MIGRATIONS_RUN','TYPEORM_SYNCHRONIZE','HISTORICAL_LOCAL','HISTORICAL_CONTAINER','USE_ETHEREAL','CASHBACK_PUBLIC_CONTENT','CASHBACK_CONTENT_MODERATION','CASHBACK_LOCAL_DEMO_REVIEWS'])assert.equal(e[key],'false');
 for(const key of ['CASHBACK_DEMO_ONLY','CASHBACK_ACTIVITY_LIMITS','CASHBACK_FORUM_READ_ONLY'])assert.equal(e[key],'true');
 for(const [k,v]of Object.entries(e))if(/^(CASHBACK_)?FINANC(?:E|IAL)_/.test(k))assert.equal(v,'false');
 assert.equal(e.CASHBACK_BACKEND_PROFILE,'staging');assert.equal(e.DB_SSL,'true');assert.equal(e.DB_HOST,'postgres');assert.equal(e.DB_NAME,'cashback_staging_app');assert.equal(e.DB_USER,'cashback_staging_runtime');assert.equal(e.NODE_OPTIONS,'--max-old-space-size=384');
 for(const key of ['DB_PASSWORD','JWT_SECRET','SMTP_PASSWORD','NODE_TLS_REJECT_UNAUTHORIZED','DATABASE_URL'])assert.equal(e[key],undefined,'INLINE_SECRET_OR_OVERRIDE_REFUSED');
 assert.deepEqual(c.services.frontend.healthcheck.test,['CMD','wget','-q','-O','/dev/null','http://127.0.0.1:8081/healthz']);assert.equal(c.services.frontend.environment.STAGING_FRONTEND_ORIGIN,e.FRONTEND_URL.replace('Supply approved HTTPS staging origin','Supply owner-approved HTTPS origin'));
 const m=c.services.mail.environment;assert.equal(m.MP_UI_BIND_ADDR,'127.0.0.1:8025');assert.equal(m.MP_SMTP_REQUIRE_STARTTLS,'true');for(const k of ['MP_SMTP_AUTH_ACCEPT_ANY','MP_SMTP_AUTH_ALLOW_INSECURE','MP_SMTP_RELAY_ALL'])assert.equal(m[k],'false');assert.equal(m.MP_SMTP_ALLOWED_RECIPIENTS,'^[A-Za-z0-9._+-]+@example[.]invalid$$');
 assert.deepEqual(Object.keys(c.secrets).sort(),secrets.slice().sort());for(const [n,v]of Object.entries(c.secrets)){assert.deepEqual(Object.keys(v),['file']);assert.ok(v.file.startsWith('$'+'{STAGING_SECRET_DIR:?')&&v.file.endsWith('}/'+n),'SECRET_MOUNT_REFUSED');}
 assert.equal(policy.volumeQuotaEnforced,false);return true;
}
module.exports={validate,images,origin,secretDirectory,inputs};
if(require.main===module){try{validate(yaml.load(fs.readFileSync(path.join(root,'docker/compose.staging.yaml'),'utf8')));require('./security-contract.cjs').files();if(!process.argv.includes('--static'))inputs(process.env);console.log('STAGING_CONFIG_PASS_NOT_RUNTIME_ADMISSION');}catch{console.error('STAGING_CONFIGURATION_REFUSED');process.exitCode=1;}}
