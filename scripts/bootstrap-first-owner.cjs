'use strict';
// Offline operator tool. No HTTP route, secret argument, account creation or startup hook.
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const RULES='2026-10-22-reviews-v1';
async function bootstrap(client, options) {
  const {accountId,database,clusterId,privacyDocumentSha256,confirmation,apply=false}=options;
  if(!Number.isSafeInteger(accountId)||accountId<=0||database!=='cashback_historical_03573b7'||
    !/^[0-9]{19}$/.test(clusterId)||!/^[a-f0-9]{64}$/.test(privacyDocumentSha256)||
    confirmation!==`APPOINT OWNER ${accountId} AND ACCEPT PRIVACY DUTIES`)
    throw Error('INVALID_OWNER_APPROVAL');
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query('SET LOCAL search_path=pg_catalog,public,pg_temp');
    await client.query('SELECT pg_advisory_xact_lock(62023,1)');
    const {rows:[identity]}=await client.query(`SELECT current_database() AS database,
      system_identifier::text AS cluster FROM pg_control_system()`);
    if(identity?.database!==database||identity?.cluster!==clusterId)throw Error('TARGET_MISMATCH');
    const {rows:[marker]}=await client.query('SELECT consumed_at FROM forum_owner_bootstrap WHERE singleton=true FOR UPDATE');
    if(!marker||marker.consumed_at)throw Error('BOOTSTRAP_UNAVAILABLE_OR_ALREADY_USED');
    const {rows:versions}=await client.query('SELECT version FROM forum_moderation_schema');
    if(versions.length!==1||Number(versions[0].version)!==3)throw Error('SCHEMA_MISMATCH');
    // Runtime role cannot use this path: require actual table ownership, not an env flag.
    const {rows:[owner]}=await client.query(`SELECT pg_get_userbyid(relowner)=current_user AS permitted
      FROM pg_class WHERE oid='public.forum_moderators'::regclass`);
    if(!owner?.permitted)throw Error('DATABASE_OWNER_REQUIRED');
    if((await client.query('SELECT user_id FROM forum_moderators LIMIT 1')).rows.length)throw Error('MODERATOR_REGISTRY_NOT_EMPTY');
    const {rows:[user]}=await client.query(`SELECT u.id,u.email_verified,f.banned,f.agreed_to_rules,f.rules_version
      FROM users u JOIN forum_users f ON f.user_id=u.id WHERE u.id=$1 FOR UPDATE OF u,f`,[accountId]);
    if(!user?.email_verified||user.banned!==false||user.agreed_to_rules!==true||user.rules_version!==RULES)
      throw Error('VERIFIED_CURRENT_RULES_MEMBERSHIP_REQUIRED');
    if(apply){
      await client.query('INSERT INTO forum_moderators(user_id,active) VALUES($1,true)',[accountId]);
      const result=await client.query(`UPDATE forum_owner_bootstrap SET consumed_at=clock_timestamp(),
        privacy_acknowledged_at=clock_timestamp(),privacy_document_sha256=$1,owner_user_id=$2
        WHERE singleton=true AND consumed_at IS NULL RETURNING singleton`,[privacyDocumentSha256,accountId]);
      if(result.rows.length!==1)throw Error('BOOTSTRAP_ALREADY_USED');
    }
    await client.query(apply?'COMMIT':'ROLLBACK');
    return {status:apply?'OWNER_APPOINTED':'DRY_RUN_ELIGIBLE',accountId,publicActivation:false};
  } catch(error) {await client.query('ROLLBACK');throw error;}
}
module.exports={bootstrap};
if(require.main===module){
  (async()=>{
    const args=process.argv.slice(2);
    if(args.length<2||args.length>3||args[2]&&args[2]!=='--apply')throw Error('INVALID_ARGUMENTS');
    // Both files contain non-secret operator approval/document. PG credentials via protected environment.
    const approval=JSON.parse(fs.readFileSync(args[0],'utf8'));
    const hash=createHash('sha256').update(fs.readFileSync(args[1])).digest('hex');
    if(hash!==approval.privacyDocumentSha256)throw Error('PRIVACY_DOCUMENT_MISMATCH');
    const {Client}=require('pg');const client=new Client({application_name:'cashback-first-owner-offline',connectionTimeoutMillis:5000});
    await client.connect();try{console.log(JSON.stringify(await bootstrap(client,{...approval,apply:args[2]==='--apply'})));}finally{await client.end();}
  })().catch(()=>{console.error('OWNER_BOOTSTRAP_BLOCKED: no secret diagnostics emitted');process.exitCode=1;});
}
