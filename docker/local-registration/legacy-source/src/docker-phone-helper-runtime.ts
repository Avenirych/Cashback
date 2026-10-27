import {randomBytes,createPrivateKey,X509Certificate,createPublicKey} from 'node:crypto';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {posix as path} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {Client} from 'pg';
import {approvalSigningBytes,mtlsApprovalTransport,SignedApprovalReader} from './docker-phone-approved-evidence';
import type {ApprovalTrustAnchor,ApprovalTransport} from './docker-phone-approved-evidence';
import type {ProductionApprovalEndpoint,LoadedProductionMigrationConfiguration} from './docker-phone-production-configuration';
import {productionMigrationComponents,readApprovedRegistrationOwnerPolicy} from './docker-phone-production-configuration';
import {createProductionMigrationSources} from './docker-phone-access-adapters';
import {phoneBaselineMigrations,PHONE_APPLY_CONCURRENCY_VERIFIED} from './docker-phone-migration-runner';
import {PHONE_MIGRATION} from './docker-phone-migration-preflight';
import {REGISTRATION_PHONE_EXPECTED as E,registrationSecurityDigest as hash} from './docker-phone-registration-target';
import {taskDeny,taskExact,validateHelperIdentity,verifyHelperTaskEnvelope,helperTaskQuery,OBSERVER_IDENTITY_SQL,validateHelperTaskResult} from './docker-phone-helper-task';
import type {HelperTask,HelperIdentity} from './docker-phone-helper-task';
import type {HelperTaskBoundary} from './docker-phone-infrastructure-service';

export interface HelperTaskFence {check(task:HelperTask,signal:AbortSignal):Promise<void>}
/** Reader contract only: the independent actuator must actually fence ALL Docker mutation
 * entrypoints and PostgreSQL administrative sessions/DDL/ACL/role entrypoints. No local
 * flag, advisory lock, label, receipt or ledger row implements this enforcement. */
export function externalHelperFence(reader:SignedApprovalReader|null):HelperTaskFence {
  return {check:async(task,signal)=>{
    if(!reader)taskDeny('EXTERNAL_FENCING_NOT_PROVISIONED');
    const p=await reader.readPayload(hash(task),signal),now=Date.now();
    if(!p||Array.isArray(p)||typeof p.leaseId!=='string'||!/^[a-zA-Z0-9_.:-]{1,256}$/.test(p.leaseId)||p.scope!=='cluster-ddl-acl-roles-and-admin-entrypoints'||p.mechanism!=='independently-enforced-maintenance-boundary'||
      p.taskSha256!==hash(task)||hash(p.helperIdentity)!==hash(task.identity)||p.fencingEpoch!==task.fencingEpoch||
      hash(p.identity)!==hash(E)||p.continuousEnforcement!==true||p.competingRunners!==0||p.uncontrolledPrivilegedSessions!==0||p.uncontrolledEntryPoints!==0||
      p.dockerMutationEntrypointsFenced!==true||p.postgresAdministrativeEntrypointsFenced!==true||
      !Number.isSafeInteger(p.observedAt)||!Number.isSafeInteger(p.expiresAt)||p.observedAt>now||now-p.observedAt>4000||p.expiresAt<=now||p.expiresAt-p.observedAt>4000)taskDeny('EXTERNAL_FENCING_NOT_HELD');
  }};
}
/** Existing host control-plane composition. Docker inspection is read-only; SQL adapters
 * are NOT invoked here. Missing provider remains blocked, not a synthesized lease. */
export function productionHelperTaskBoundary(cap:LoadedProductionMigrationConfiguration):HelperTaskBoundary {
  const c=productionMigrationComponents(cap),sources=createProductionMigrationSources(cap);
  if(!c.externalFencing)taskDeny('EXTERNAL_FENCING_NOT_PROVISIONED');
  const fence=externalHelperFence(new SignedApprovalReader('fencing',c.externalFencing.anchor,c.transport('fencing')));
  return {check:async(task,signal,leaseOnly=false)=>{
    await c.assertUnchanged();const peer=c.topology.peers.find(p=>p.service===task.identity.service);
    const policy:any=await readApprovedRegistrationOwnerPolicy();
    if(policy.context!==E.context||policy.daemonId!==E.daemonId||policy.platform!==E.platform||policy.postgresImage!==E.image||
      !policy.servicePhase||hash(policy.servicePhase.peers)!==hash(c.topology.peers)||hash(policy.servicePhase.controlNetwork)!==hash(c.topology.controlNetwork)||policy.servicePhase.phase!==c.topology.phase)taskDeny('LIVE_ADMISSION_POLICY_REQUIRED');
    if(!peer||peer.id!==task.identity.containerId||peer.image!==task.identity.image||peer.configurationSha256!==task.identity.configurationSha256)taskDeny('HELPER_IDENTITY_MISMATCH');
    // Full collection at fetch/start/finish. During work the ACTUAL external actuator
    // excludes Docker changes; renew its identity-bound lease instead of concurrent CLI scans.
    if(!leaseOnly)await sources.docker.inspect(signal);await fence.check(task,signal);
    if(hash(await readApprovedRegistrationOwnerPolicy())!==hash(policy))taskDeny('LIVE_ADMISSION_POLICY_CHANGED');
  }};
}
export interface HelperTaskClient {
  call(body:unknown,signal:AbortSignal):Promise<any>;
}
export interface HelperTaskExecution {
  identity:HelperIdentity;anchor:ApprovalTrustAnchor;client:HelperTaskClient;fence:HelperTaskFence;
  execute(task:HelperTask,signal:AbortSignal):Promise<unknown>;
}
/** Durable host begin ACK precedes execution; watcher remains held until result ACK.
 * Cancellation/timeout/disconnect always records UNKNOWN best-effort, never retries work.
 * A crash before reporting leaves durable RUNNING, which blocks fetch after restart. */
export async function executeOneHelperTask(c:HelperTaskExecution,signal:AbortSignal){
  const challenge=randomBytes(32).toString('hex'),envelope=await c.client.call({operation:'fetch',challenge},signal);
  if(envelope?.status==='IDLE')return {status:'IDLE'};
  const task=verifyHelperTaskEnvelope(envelope,c.anchor,c.identity,challenge),runId=randomBytes(32).toString('hex');
  await c.fence.check(task,signal);
  const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,Math.min(task.maxRuntimeMs,task.expiresAt-Date.now()));
  let watcher:Promise<void>|undefined;
  const checked=async()=>{
    if(signal.aborted||controller.signal.aborted||Date.now()>=task.expiresAt)taskDeny('TASK_CANCELLED_OR_TIMED_OUT');
    await c.fence.check(task,controller.signal);
    const r=await c.client.call({operation:'check',taskId:task.id,runId},controller.signal);
    if(r.status!=='HELD'||r.taskSha256!==hash(task))taskDeny('TASK_AUTHORIZATION_LOST');
  };
  try{
    if(signal.aborted)taskDeny('TASK_CANCELLED');
    const begin=await c.client.call({operation:'begin',taskId:task.id,runId,challenge},controller.signal);
    if(begin.status!=='STARTED'||begin.taskSha256!==hash(task)||begin.runId!==runId||(task.querySha256!==null&&begin.sqlApproved!==true))taskDeny('DURABLE_START_OR_SQL_APPROVAL_MISSING');
    await checked();
    watcher=(async()=>{while(!controller.signal.aborted){await sleep(200,undefined,{signal:controller.signal});await checked();}})();
    // Attach rejection immediately: a lost lease aborts the active SQL connection.
    watcher.catch(()=>controller.abort());
    const interrupted=new Promise<never>((_,reject)=>{
      if(controller.signal.aborted)reject(new Error('ABORTED'));
      else controller.signal.addEventListener('abort',()=>reject(new Error('ABORTED')),{once:true});
    });
    const result=await Promise.race([c.execute(task,controller.signal),interrupted]);
    await checked();
    validateHelperTaskResult(task,result);
    const resultSha256=hash(result),ack=await c.client.call({operation:'finish',taskId:task.id,runId,outcome:'SUCCEEDED',resultSha256,result},controller.signal);
    if(ack.status!=='RECORDED'||ack.outcome!=='SUCCEEDED')taskDeny('RESULT_ACK_UNKNOWN');
    return {status:'SUCCEEDED',taskId:task.id,resultSha256};
  }catch{
    controller.abort();
    try{await c.client.call({operation:'finish',taskId:task.id,runId,outcome:'UNKNOWN',resultSha256:hash({outcome:'UNKNOWN'})},AbortSignal.timeout(1500));}catch{/* Preserve durable pending/unknown, do not repair or rerun. */}
    taskDeny('UNKNOWN_OUTCOME_RECONCILIATION_REQUIRED');
  }finally{
    clearTimeout(timer);signal.removeEventListener('abort',abort);controller.abort();await watcher?.catch(()=>{});
  }
}

export interface HelperRuntimeConfiguration {
  format:'registration-helper-runtime/v1';status:'APPROVED';identity:HelperIdentity;
  enrollment:ProductionApprovalEndpoint;externalFencing:ProductionApprovalEndpoint;
  databasePasswordFile:string;
}
async function privateText(file:string):Promise<string>{
  if(!/^\/run\/registration\/(private|public)\/[a-zA-Z0-9_./-]+$/.test(file)||file.includes('..'))taskDeny('PROTECTED_HELPER_FILE_REQUIRED');
  let parent=path.dirname(file);
  for(;;){const s=await lstat(parent);if(!s.isDirectory()||s.isSymbolicLink())taskDeny('UNSAFE_HELPER_PATH');if(parent==='/run')break;parent=path.dirname(parent);}
  const s=await lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>131072||await realpath(file)!==file)taskDeny('UNSAFE_HELPER_FILE');
  return readFile(file,'utf8');
}
/** Only fixed catalog/identity reads. No shell, user SQL, migration CLI or DDL. */
async function executeProductionTask(task:HelperTask,password:()=>Promise<string>,signal:AbortSignal):Promise<unknown>{
  if(task.operation==='helper.describe')return {service:task.identity.service,node:process.versions.node,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED};
  if(task.operation==='migration.plan')return {baseline:phoneBaselineMigrations().map(m=>m.constructor.name),seventh:PHONE_MIGRATION,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED};
  const query=helperTaskQuery(task.operation);if(!query||!task.sqlApprovalId)taskDeny('SQL_APPROVAL_REQUIRED');
  const role=task.identity.service==='observer'?'registration_observer':'registration_migrator';
  const client=new Client({host:E.container,port:5432,database:E.database,user:role,password:await password(),
    connectionTimeoutMillis:1000,statement_timeout:1000,query_timeout:1500,options:'-c default_transaction_read_only=on -c search_path=pg_catalog'});
  const abort=()=>{void client.end().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
  try{
    if(signal.aborted)taskDeny('TASK_CANCELLED');await client.connect();await client.query('BEGIN READ ONLY');
    const facts=(await client.query(OBSERVER_IDENTITY_SQL)).rows;
    if(facts.length!==1||facts[0].database!==E.database||facts[0].oid!==E.oid||facts[0].role!==role||facts[0].version!==E.serverVersionNum||facts[0].system_identifier!==E.systemIdentifier)taskDeny('POSTGRES_IDENTITY_MISMATCH');
    const rows=query===OBSERVER_IDENTITY_SQL?facts:(await client.query(query)).rows;
    if(signal.aborted)taskDeny('TASK_CANCELLED');await client.query('ROLLBACK');return {rowCount:rows.length,sha256:hash(rows)};
  }finally{signal.removeEventListener('abort',abort);await client.end().catch(()=>{});}
}
/** Loads ONLY separately provisioned read-only bind files. No credential generation,
 * Docker socket, host ledger mount, writable helper state, or automatic SQL on startup. */
export async function loadHelperExecution(service:HelperIdentity['service']):Promise<HelperTaskExecution>{
  try{
    const file='/run/registration/private/helper.production.json',original=await privateText(file),c=JSON.parse(original) as HelperRuntimeConfiguration;
    if(!taskExact(c,['format','status','identity','enrollment','externalFencing','databasePasswordFile'])||c.format!=='registration-helper-runtime/v1'||c.status!=='APPROVED'||c.identity.service!==service)taskDeny('INVALID_HELPER_CONFIGURATION');
    validateHelperIdentity(c.identity);
    const endpoints=[c.enrollment,c.externalFencing];
    for(const [i,v]of endpoints.entries()){
      if(!v||!taskExact(v,['anchor','mtls'])||!taskExact(v.mtls,['certificateFile','privateKeyFile','caFile','serverCertificateSha256'])||
        v.anchor?.purpose!==(i===0?'enrollment':'fencing')||!v.anchor.issuer||!v.anchor.keyId||v.anchor.audience!=='cashback-registration-migration'||createPublicKey(v.anchor.publicKeyPem).asymmetricKeyType!=='ed25519'||
        !/^[a-f0-9]{64}$/.test(v.mtls.serverCertificateSha256))taskDeny('TRUST_ANCHOR_OR_MTLS_MISSING');
    }
    if(!c.externalFencing||c.enrollment.anchor.issuer===c.externalFencing.anchor.issuer||new URL(c.enrollment.anchor.endpoint).origin===new URL(c.externalFencing.anchor.endpoint).origin||
      createPublicKey(c.enrollment.anchor.publicKeyPem).export({type:'spki',format:'der'}).equals(createPublicKey(c.externalFencing.anchor.publicKeyPem).export({type:'spki',format:'der'})))taskDeny('EXTERNAL_FENCING_NOT_PROVISIONED');
    const originalFiles=new Map<string,string>([[file,hash(original)]]);
    const read=async(f:string)=>{const v=await privateText(f);if(originalFiles.has(f)&&originalFiles.get(f)!==hash(v))taskDeny('HELPER_CONFIGURATION_CHANGED');originalFiles.set(f,hash(v));return v;};
    const password=async()=>{await read(file);const p=await read(c.databasePasswordFile);if(!p||p.length>4096||/[\r\n\0]/.test(p))taskDeny('DATABASE_CREDENTIAL_MISSING');return p;};
    const credentials=async(v:ProductionApprovalEndpoint)=>{
      if(!v.mtls.privateKeyFile.startsWith('/run/registration/private/'))taskDeny('PRIVATE_KEY_PATH_REQUIRED');
      await read(file);const [certificate,privateKey,ca]=await Promise.all([v.mtls.certificateFile,v.mtls.privateKeyFile,v.mtls.caFile].map(read));
      const cert=new X509Certificate(certificate),key=createPrivateKey(privateKey),issuer=new X509Certificate(ca);
      if(!cert.checkPrivateKey(key)||!issuer.ca||Date.parse(cert.validFrom)>Date.now()||Date.parse(cert.validTo)<=Date.now())taskDeny('MTLS_CREDENTIALS_INVALID');
      return {certificate,privateKey,ca,serverCertificateSha256:v.mtls.serverCertificateSha256};
    };
    const transport=(v:ProductionApprovalEndpoint)=>mtlsApprovalTransport(v.anchor.endpoint,()=>credentials(v));
    const enrollment=transport(c.enrollment),fencing=transport(c.externalFencing);
    // Validate every credential before waiting/connecting; no placeholder password or PEM.
    if(!c.databasePasswordFile.startsWith('/run/registration/private/'))taskDeny('DATABASE_CREDENTIAL_PATH_REQUIRED');
    await password();for(const v of endpoints)await credentials(v);
    const client:HelperTaskClient={call:async(body,signal)=>JSON.parse(await enrollment.task!(body,signal))};
    const fence=externalHelperFence(new SignedApprovalReader('fencing',c.externalFencing.anchor,fencing));
    return {identity:JSON.parse(approvalSigningBytes(c.identity).toString()),anchor:c.enrollment.anchor,client,fence,execute:(t,s)=>executeProductionTask(t,password,s)};
  }catch{taskDeny('HELPER_CONFIGURATION_CREDENTIALS_OR_TRUST_UNAVAILABLE');}
}
export async function runHelperProcess(service:HelperIdentity['service'],signal:AbortSignal):Promise<void>{
  const c=await loadHelperExecution(service);
  while(!signal.aborted){
    const status=await c.client.call({operation:'status'},signal);
    if(status.status==='WAITING_ADMISSION'){await sleep(500,undefined,{signal});continue;}
    if(status.status!=='ADMITTED')taskDeny('SERVICE_NOT_ADMITTED');
    const result=await executeOneHelperTask(c,signal);
    if(result.status==='IDLE')await sleep(500,undefined,{signal});
  }
}
