import { createServer } from 'node:https';
import { isIP } from 'node:net';
import type { TLSSocket } from 'node:tls';
import { readFile, lstat } from 'node:fs/promises';
import { isAbsolute, join, resolve, relative } from 'node:path';
import { createHash, createPublicKey } from 'node:crypto';
import type { ApprovalTrustAnchor } from './docker-phone-approved-evidence';
import { RegistrationApprovalAuthority } from './docker-phone-infrastructure-authority';
import { RegistrationInfrastructureLedger } from './docker-phone-infrastructure-ledger';
import { REGISTRATION_PHONE_EXPECTED as E, registrationSecurityDigest as hash } from './docker-phone-registration-target';
import {validateHelperIdentity,taskExact,taskDeny,assertHelperAdmission,HelperTaskBlocked} from './docker-phone-helper-task';
import type {HelperIdentity,HelperTask} from './docker-phone-helper-task';

export interface RegistrationAuthorityDeployment {
  helperClients?:{certificateSha256:string;identity:HelperIdentity}[];
  helperProductionConfigurationFile?:string;
  status:'DRAFT'|'APPROVED';target:typeof E;anchor:ApprovalTrustAnchor;
  ownerPublicKeyFile:string;ownerPublicKeySha256:string;privateKeyFile:string;ledgerDirectory:string;payloadDirectory:string;
  tls:{certificateFile:string;privateKeyFile:string;clientCaFile:string;ownerCertificateSha256:string;consumerCertificateSha256:string};
  listen:{host:string;port:number};
}
export interface HelperTaskBoundary {check(task:HelperTask,signal:AbortSignal,leaseOnly?:boolean):Promise<void>}
export function authenticateHelperClient(authorized:boolean,raw:Buffer|undefined,clients:RegistrationAuthorityDeployment['helperClients']):HelperIdentity {
  if(!authorized||!raw)taskDeny('HELPER_MTLS_REQUIRED');
  const pin=createHash('sha256').update(raw).digest('hex'),peer=clients?.find(c=>c.certificateSha256===pin);
  if(!peer)taskDeny('HELPER_MTLS_PIN_MISMATCH');validateHelperIdentity(peer.identity);return peer.identity;
}
function deny(code:string):never {throw new Error('REGISTRATION_DEPLOYMENT:'+code);}
export function validateAuthorityDeployment(c:RegistrationAuthorityDeployment,repository:string):void {
  if(c.status!=='APPROVED'||hash(c.target)!==hash(E)||!['fingerprints','receipts','enrollment'].includes(c.anchor?.purpose)||
    !c.anchor.issuer||!c.anchor.keyId||c.anchor.audience!=='cashback-registration-migration')deny('OWNER_CONFIGURATION_REQUIRED');
  const endpoint=new URL(c.anchor.endpoint);
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/approvals')deny('INVALID_ENDPOINT');
  const ports={fingerprints:8443,receipts:8444,enrollment:8445};
  try{if(createPublicKey(c.anchor.publicKeyPem).asymmetricKeyType!=='ed25519')deny('INVALID_SIGNING_PIN');}catch{deny('INVALID_SIGNING_PIN');}
  if(Number(endpoint.port||443)!==ports[c.anchor.purpose as keyof typeof ports])deny('ENDPOINT_PORT_MISMATCH');
  if(!c.listen||!(c.listen.host==='127.0.0.1'||(isIP(c.listen.host)===4&&/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(c.listen.host)))||c.listen.port!==ports[c.anchor.purpose as keyof typeof ports])deny('INVALID_LISTENER');
  const files=[c.ownerPublicKeyFile,c.privateKeyFile,c.ledgerDirectory,c.payloadDirectory,c.tls?.certificateFile,c.tls?.privateKeyFile,c.tls?.clientCaFile];
  const protectedRoot=resolve('C:\\approved-registration-infrastructure');
  for(const f of files){
    if(typeof f!=='string'||!isAbsolute(f)||!relative(resolve(repository),resolve(f)).startsWith('..'))deny('PROTECTED_EXTERNAL_PATH_REQUIRED');
    const inside=relative(protectedRoot,resolve(f));if(!inside||inside.startsWith('..')||isAbsolute(inside))deny('DEDICATED_STORAGE_REQUIRED');
  }
  if(!/^[a-f0-9]{64}$/.test(c.ownerPublicKeySha256)||relative(join(protectedRoot,'public'),resolve(c.ownerPublicKeyFile)).startsWith('..'))deny('REVIEWER_PIN_REQUIRED');
  if(new Set(files).size!==files.length||!c.tls||![c.tls.ownerCertificateSha256,c.tls.consumerCertificateSha256].every(v=>/^[a-f0-9]{64}$/.test(v))||
    c.tls.ownerCertificateSha256===c.tls.consumerCertificateSha256)deny('SEPARATE_IDENTITIES_REQUIRED');
  if(c.helperClients){
    if(c.anchor.purpose!=='enrollment'||!Array.isArray(c.helperClients)||c.helperClients.length!==2||c.helperClients.map(v=>v.identity?.service).sort().join(',')!=='migration-executor,observer')deny('HELPER_CLIENT_IDENTITIES_REQUIRED');
    const pins=[c.tls.ownerCertificateSha256,c.tls.consumerCertificateSha256,...c.helperClients.map(v=>v.certificateSha256)];
    if(pins.some(p=>!/^[a-f0-9]{64}$/.test(p))||new Set(pins).size!==pins.length||new Set(c.helperClients.map(v=>v.identity.containerId)).size!==2)deny('SEPARATE_HELPER_IDENTITIES_REQUIRED');
    c.helperClients.forEach(p=>validateHelperIdentity(p.identity));
  }
  // Image/host OS ACL verification is an infrastructure prerequisite, not inferred from mode bits.
}
async function protectedFile(file:string):Promise<string>{
  const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>131072)deny('UNSAFE_FILE');return readFile(file,'utf8');
}
/** Explicit startup only; never called by application modules, imports, tests or static validation.
 * HTTPS mTLS + exact client certificate pins; the two review/signing authorities run separately.
 */
export async function startRegistrationAuthority(c:RegistrationAuthorityDeployment,repository:string,helperBoundary?:HelperTaskBoundary){
  c=structuredClone(c);
  validateAuthorityDeployment(c,repository);
  const [owner,certificate,key,ca]=await Promise.all([c.ownerPublicKeyFile,c.tls.certificateFile,c.tls.privateKeyFile,c.tls.clientCaFile].map(protectedFile));
  if(createHash('sha256').update(createPublicKey(owner).export({type:'spki',format:'der'})).digest('hex')!==c.ownerPublicKeySha256)deny('REVIEWER_PIN_MISMATCH');
  const ledger=new RegistrationInfrastructureLedger(c.ledgerDirectory);
  await ledger.inspect(); // Missing/torn/corrupt journal blocks startup; never initialise automatically.
  const authority=new RegistrationApprovalAuthority(c.anchor,owner,{privateKey:()=>protectedFile(c.privateKeyFile)},ledger);
  const server=createServer({cert:certificate,key,ca,requestCert:true,rejectUnauthorized:true,minVersion:'TLSv1.3'},async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
    try {
      const socket=req.socket as TLSSocket,peer=socket.getPeerCertificate();
      if(!socket.authorized||!peer.raw)deny('MTLS_REQUIRED');
      const pin=createHash('sha256').update(peer.raw).digest('hex');
      const url=new URL(req.url??'/', 'https://registration.invalid');let result:unknown;
      const ownerRequest=pin===c.tls.ownerCertificateSha256,consumerRequest=pin===c.tls.consumerCertificateSha256;
      const helper=c.helperClients?.find(p=>p.certificateSha256===pin);
      if(helper)authenticateHelperClient(socket.authorized,peer.raw,c.helperClients);
      if(!ownerRequest&&!consumerRequest&&!helper)deny('CLIENT_PIN_MISMATCH');
      const body=async()=>{let text='';for await(const part of req){text+=part.toString();if(Buffer.byteLength(text)>65536)deny('BODY_LIMIT');}return JSON.parse(text);};
      if(req.method==='POST'&&url.pathname==='/helper-task'&&helper){
        if(!helperBoundary||url.search)deny('HELPER_BOUNDARY_NOT_PROVISIONED');
        result=await handleHelperTaskRequest(await body(),helper.identity,authority,ledger,helperBoundary);
      }
      else if(req.method==='GET'&&url.pathname==='/challenge'&&ownerRequest)result={challenge:await authority.challenge()};
      else if(req.method==='POST'&&url.pathname==='/decision'&&ownerRequest){const b=await body();await authority.decide(b.decision,b.signature,b.payload);result={status:'RECORDED'};}
      else if(req.method==='POST'&&url.pathname==='/consume'&&consumerRequest){const b=await body();await authority.consume(b.ids,b.lease);result={status:'CONSUMED'};}
      else if(req.method==='GET'&&url.pathname==='/creation-authorization'&&consumerRequest){
        // Existing independently provisioned enrollment principal only. No new authority, signer or fallback.
        const scope=url.searchParams.get('scope')??'',challenge=url.searchParams.get('challenge')??'';
        if(c.anchor.purpose!=='enrollment'||!/^[a-f0-9]{64}$/.test(scope)||!/^[a-f0-9]{64}$/.test(challenge)||
          [...url.searchParams.keys()].sort().join(',')!=='challenge,scope')deny('CREATION_REQUEST_BINDING');
        const stored=JSON.parse(await protectedFile(join(c.payloadDirectory,scope+'.json')));
        if(hash(stored.payload)!==scope)deny('CREATION_PAYLOAD_BINDING');
        res.end(await authority.creationEnvelope(stored.id,stored.payload,challenge));return;
      }
      else if(req.method==='GET'&&url.pathname==='/approvals'&&consumerRequest){
        const review=url.searchParams.get('review')??'',challenge=url.searchParams.get('challenge')??'';
        if(url.searchParams.get('purpose')!==c.anchor.purpose||!/^[a-f0-9]{64}$/.test(review))deny('REQUEST_BINDING');
        const stored=JSON.parse(await protectedFile(join(c.payloadDirectory,review+'.json')));
        if((Array.isArray(stored.payload)?stored.payload:[stored.payload]).some((r:any)=>r.reviewSha256!==review))deny('PAYLOAD_BINDING');
        res.end(await authority.envelope(stored.id,stored.payload,challenge));return;
      } else deny('ROUTE_NOT_ALLOWED');
      res.end(JSON.stringify(result));
    }catch{res.statusCode=403;res.end('{"status":"BLOCKED"}');} // Never log raw errors, private material, SQL or request bodies.
  });
  server.requestTimeout=3000;server.headersTimeout=3000;server.maxHeadersCount=32;
  await new Promise<void>((ok,reject)=>{server.once('error',reject);server.listen(c.listen.port,c.listen.host,ok);});
  return server;
}

/** Only invoked after TLS CA validation AND exact helper leaf-certificate pin selection. */
export async function handleHelperTaskRequest(body:any,identity:HelperIdentity,authority:RegistrationApprovalAuthority,
  ledger:RegistrationInfrastructureLedger,boundary:HelperTaskBoundary){
  validateHelperIdentity(identity);
  if(body?.operation==='status'){
    if(!taskExact(body,['operation']))taskDeny('TASK_REQUEST_INVALID');
    const s=await ledger.inspect(),c=Object.values(s.creations).find(c=>c.identities?.some(p=>p.id===identity.containerId&&p.service===identity.service));
    if(!c||s.revoked[c.id]||c.plan.fencing.epoch!==s.epoch||s.keys[c.keyId]?.state!=='ACTIVE'||!c.attestation||c.plan.helpers.find(p=>p.service===identity.service)?.image!==identity.image||
      c.attestation.identities.find(p=>p.service===identity.service)?.observedConfigurationSha256!==identity.configurationSha256)taskDeny('SERVICE_NOT_ATTESTED');
    return {status:c.stage==='SERVICE_ADMITTED'?'ADMITTED':'WAITING_ADMISSION'};
  }
  if(body?.operation==='fetch'){
    if(!taskExact(body,['operation','challenge']))taskDeny('TASK_REQUEST_INVALID');
    const pending=Object.values((await ledger.inspect()).helperTasks).find(r=>r.status==='APPROVED'&&hash(r.task.identity)===hash(identity)&&r.task.expiresAt>Date.now());
    if(pending)await boundary.check(pending.task,AbortSignal.timeout(8000));
    // Sign AFTER fresh Docker/policy/fencing collection, preserving the 4s envelope TTL.
    let raw:string;try{raw=await authority.helperTaskEnvelope(identity,body.challenge);}catch(e){if(e instanceof HelperTaskBlocked&&e.code==='NO_APPROVED_TASK')return {status:'IDLE'};throw e;}
    const envelope=JSON.parse(raw);
    return envelope;
  }
  const expected=body?.operation==='begin'?['operation','taskId','runId','challenge']:body?.operation==='check'?['operation','taskId','runId']:['operation','taskId','runId','outcome','resultSha256',...(body?.outcome==='SUCCEEDED'?['result']:[])];
  if(!['begin','check','finish'].includes(body?.operation)||!taskExact(body,expected))taskDeny('TASK_REQUEST_INVALID');
  const row=(await ledger.inspect()).helperTasks[body.taskId];
  if(!row||hash(row.task.identity)!==hash(identity))taskDeny('TASK_IDENTITY_MISMATCH');
  if(body.operation!=='finish'||body.outcome!=='UNKNOWN')await boundary.check(row.task,AbortSignal.timeout(8000),body.operation==='check');
  if(body.operation==='check'){
    const state=await ledger.inspect(),current=state.helperTasks[body.taskId];
    if(current.status!=='RUNNING'||current.runId!==body.runId||state.revoked[body.taskId]||state.keys[current.keyId]?.state!=='ACTIVE')taskDeny('TASK_CANCELLED');
    assertHelperAdmission(state,row.task,Date.now());
    return {status:'HELD',taskSha256:hash(row.task)};
  }
  await ledger.transaction((_s,emit)=>{
    if(body.operation==='begin')emit({kind:'helper-task-started',id:body.taskId,runId:body.runId,challenge:body.challenge,at:Date.now()});
    else emit({kind:'helper-task-finished',id:body.taskId,runId:body.runId,outcome:body.outcome,resultSha256:body.resultSha256,...(body.outcome==='SUCCEEDED'?{result:body.result}:{}),at:Date.now()});
  });
  return body.operation==='begin'?{status:'STARTED',runId:body.runId,taskSha256:hash(row.task),sqlApproved:row.task.sqlApprovalId!==null}:{status:'RECORDED',outcome:body.outcome};
}
