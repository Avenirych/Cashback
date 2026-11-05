// Operator-only, one consumed file permit; NEVER imported by application routing.
'use strict';
const fs=require('fs'),crypto=require('crypto');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function admitted(p,r,now=Date.now(),helper=digest(fs.readFileSync('/tmp/account-password.cjs'))){
 if(p.operation!=='rotate-existing-synthetic-moderator-once'||p.database!=='cashback_staging_app'||p.cluster!=='7703264865117007916'||p.userId!==r.id||p.previousVerifier!==digest(r.password)||p.bootstrap!==digest(r.bootstrap)||p.identity!==digest(r.email)||p.expires<=now||p.expires>now+300000||p.helper!==helper)throw Error('RESET_PERMIT_REFUSED');
 if(!/^[A-Za-z0-9._+%-]+@example[.]invalid$/i.test(r.email)||r.email_verified!==true)throw Error('RESET_TARGET_REFUSED');
 return true;
}
async function main(){
 if(process.env.CASHBACK_BACKEND_PROFILE!=='staging'||process.env.CASHBACK_STAGING_WORKFLOWS!=='synthetic-v1')throw Error('RESET_PROFILE_REFUSED');
 for(const k of ['CASHBACK_FINANCIAL_WRITES','CASHBACK_FINANCIAL_API','CASHBACK_FINANCIAL_ADMISSION'])if(process.env[k]!=='false')throw Error('RESET_FINANCIAL_REFUSED');
 const {DataSource}=require('typeorm'),{User}=require('/app/dist/users/user.entity'),{UsersService}=require('/app/dist/users/users.service');
 const ds=new DataSource({type:'postgres',host:'postgres',port:5432,username:'cashback_staging_runtime',password:fs.readFileSync('/run/secrets/db_password','utf8').trimEnd(),database:'cashback_staging_app',ssl:{ca:fs.readFileSync('/run/secrets/staging_ca'),rejectUnauthorized:true},entities:[User],synchronize:false,migrationsRun:false,installExtensions:false,logging:false,extra:{max:1,connectionTimeoutMillis:5000}});
 const permit='/tmp/moderator-reset-permit.json',receipt='/tmp/moderator-reset-receipt.json';
 await ds.initialize();
 try{
 const [i]=await ds.query("SELECT current_database() AS database,current_user AS username,system_identifier::text AS cluster,current_setting('server_version_num')::int AS version FROM pg_control_system()");
 if(i.database!=='cashback_staging_app'||i.username!=='cashback_staging_runtime'||i.cluster!=='7703264865117007916'||i.version!==170011)throw Error('RESET_DATABASE_REFUSED');
 const target=async m=>{const rows=await m.query(`SELECT u.id,u.email,u.email_verified,u.password,(to_jsonb(u)-'password')::text AS rest,to_jsonb(b)::text AS bootstrap FROM forum_owner_bootstrap b JOIN users u ON u.id=b.owner_user_id JOIN forum_moderators fm ON fm.user_id=u.id JOIN forum_users f ON f.user_id=u.id WHERE b.singleton=true AND b.consumed_at IS NOT NULL AND b.privacy_acknowledged_at IS NOT NULL AND fm.active=true AND f.banned=false AND f.agreed_to_rules=true AND f.rules_version='2026-10-22-reviews-v1'`);if(rows.length!==1)throw Error('RESET_UNIQUE_BOOTSTRAP_REFUSED');return rows[0]};
 const others=async(m,id)=>{const [a]=await m.query("SELECT md5(coalesce(string_agg(to_jsonb(u)::text,'' ORDER BY id),'')) AS digest FROM users u WHERE id<>$1",[id]);return a.digest};
 if(process.argv[2]==='prepare'){
 if(fs.existsSync(receipt)||fs.existsSync(permit+'.consumed'))throw Error('RESET_ALREADY_CONSUMED');
 const r=await ds.transaction(async m=>{await m.query('SET TRANSACTION READ ONLY');return target(m)});
 if(!/^[A-Za-z0-9._+%-]+@example[.]invalid$/i.test(r.email)||!r.email_verified||!/^\$2[ab]\$10\$/.test(r.password))throw Error('RESET_TARGET_REFUSED');
 fs.writeFileSync(permit,JSON.stringify({operation:'rotate-existing-synthetic-moderator-once',database:i.database,cluster:i.cluster,userId:r.id,identity:digest(r.email),previousVerifier:digest(r.password),bootstrap:digest(r.bootstrap),helper:digest(fs.readFileSync('/tmp/account-password.cjs')),expires:Date.now()+300000}),{mode:0o600,flag:'wx'});
 console.log('RESET_SCOPED_PERMIT_READY');return;
 }
 if(process.argv[2]!=='apply'||fs.existsSync(receipt))throw Error('RESET_ACTION_REFUSED');
 const st=fs.lstatSync(permit);if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o777)!==0o600||st.uid!==process.getuid())throw Error('RESET_PERMIT_MODE_REFUSED');
 const p=JSON.parse(fs.readFileSync(permit));
 const helper=require('/tmp/account-password.cjs');
 let credential;
 await ds.transaction('SERIALIZABLE',async m=>{
 await m.query("SET LOCAL lock_timeout='5s'");await m.query("SET LOCAL statement_timeout='20s'");await m.query('SELECT pg_advisory_xact_lock(62023,1)');
 const r=await target(m);admitted(p,r);await m.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[r.id]);
 const beforeOthers=await others(m,r.id);
 fs.renameSync(permit,permit+'.consumed'); // One-use authorization consumed before mutation; no automatic retry.
 const password='Staging!1'+crypto.randomBytes(32).toString('base64url');
 const hash=await helper.hashAccountPassword(password);
 if(await helper.verifyAccountPassword(password,r.password))throw Error('RESET_NEW_EQUALS_OLD_REFUSED');
 credential={userId:r.id,email:r.email,password};
 fs.writeFileSync('/tmp/moderator-credential.pending',JSON.stringify(credential),{mode:0o600,flag:'wx'});
 await new UsersService(m.getRepository(User)).update(r.id,{password:hash});
 const after=await target(m);
 if(after.rest!==r.rest||after.bootstrap!==r.bootstrap||after.password===r.password||!await helper.verifyAccountPassword(password,after.password)||beforeOthers!==await others(m,r.id))throw Error('RESET_SCOPE_INTEGRITY_REFUSED');
 });
 fs.renameSync('/tmp/moderator-credential.pending','/tmp/moderator-credential.json');
 fs.writeFileSync(receipt,JSON.stringify({operation:p.operation,userId:p.userId,committed:true,previousVerifierRemoved:true,onlyPasswordChanged:true,at:new Date().toISOString()}),{mode:0o600,flag:'wx'});
 console.log('STAGING_MODERATOR_RESET_COMMITTED_PASSWORD_ONLY');
 }finally{await ds.destroy()}
}
module.exports={admitted};
if(require.main===module)main().catch(()=>{console.error('STAGING_MODERATOR_RESET_REFUSED_OR_FAILED_CHECK_STATE_NO_RETRY');process.exitCode=2});
