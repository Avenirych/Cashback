import { createPublicKey, verify, randomBytes } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { checkServerIdentity } from 'node:tls';
import { createHash } from 'node:crypto';
import { ProductionSource, adapterDeny } from './docker-phone-adapter-common';
import { REGISTRATION_PHONE_EXPECTED as E, registrationSecurityDigest as digest } from './docker-phone-registration-target';
import type { EnrolledMigrationSession, TrustedSessionDirectory } from './docker-phone-access-adapters';
import type { ApprovedMigrationFingerprints, IndependentlyApprovedReceipt } from './docker-phone-access-sources';
export type ApprovalPurpose='fingerprints'|'receipts'|'enrollment'|'fencing';
export interface ApprovalTrustAnchor {
  readonly issuer:string;readonly keyId:string;readonly publicKeyPem:string;
  readonly endpoint:string;readonly audience:'cashback-registration-migration';readonly purpose:ApprovalPurpose;
}
export interface ApprovalTransport {
  get(url:string,signal:AbortSignal):Promise<string>;
  /** Distinct creation action; cannot mint a migration approval or consume a receipt. */
  creation?(scope:string,challenge:string,signal:AbortSignal):Promise<string>;
  task?(body:unknown,signal:AbortSignal):Promise<string>;
  /** Independently authenticated durable consumption, idempotent only for the SAME lease. */
  claim?(ids:readonly string[],lease:string,signal:AbortSignal):Promise<void>;
}
export interface ApprovalMtlsCredentials {certificate:string;privateKey:string;ca:string;serverCertificateSha256:string}
/** Explicit protected deployment composition only. No credentials, hosts or IO on import.
 * Existing readers still verify the signed Ed25519 envelope independently of TLS.
 */
export function mtlsApprovalTransport(endpoint:string,credentials:()=>Promise<ApprovalMtlsCredentials>):ApprovalTransport {
  const base=new URL(endpoint);
  if(base.protocol!=='https:'||base.pathname!=='/approvals'||base.username||base.password||base.search||base.hash)adapterDeny('INVALID_TRUST_ANCHOR');
  async function call(url:URL,method:'GET'|'POST',body:string|undefined,signal:AbortSignal,timeoutMs=1500):Promise<string>{
    try {
      const c={...await credentials()};if(signal.aborted||!/^[a-f0-9]{64}$/.test(c.serverCertificateSha256))adapterDeny('MTLS_CREDENTIALS_UNAVAILABLE');
      return await new Promise<string>((resolve,reject)=>{
        const request=httpsRequest(url,{method,signal,cert:c.certificate,key:c.privateKey,ca:c.ca,rejectUnauthorized:true,minVersion:'TLSv1.3',
          checkServerIdentity:(host,cert)=>checkServerIdentity(host,cert)??
            (createHash('sha256').update(cert.raw).digest('hex')===c.serverCertificateSha256?undefined:new Error('TLS_PIN_MISMATCH')),
          headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{})}},response=>{
          let text='';response.on('data',part=>{text+=part.toString();if(Buffer.byteLength(text)>131072)request.destroy(new Error('SIZE_LIMIT'));});
          response.on('error',reject);response.on('end',()=>response.statusCode===200?resolve(text):reject(new Error('AUTHORITY_REFUSED')));
        });
        request.setTimeout(timeoutMs,()=>request.destroy(new Error('TIMEOUT')));request.on('error',reject);request.end(body);
      });
    }catch{adapterDeny('AUTHORITY_MTLS_REQUEST_FAILED');}
  }
  return {
    get:async(raw,signal)=>{const url=new URL(raw);if(url.origin!==base.origin||url.pathname!==base.pathname||url.username||url.password||url.hash)adapterDeny('AUTHORITY_ENDPOINT_MISMATCH');return call(url,'GET',undefined,signal);},
    creation:async(scope,challenge,signal)=>{
      if(!/^[a-f0-9]{64}$/.test(scope)||!/^[a-f0-9]{64}$/.test(challenge))adapterDeny('INVALID_CREATION_BINDING');
      const url=new URL('/creation-authorization',base);url.searchParams.set('scope',scope);url.searchParams.set('challenge',challenge);
      return call(url,'GET',undefined,signal);
    },
    task:async(body,signal)=>{
      const raw=approvalSigningBytes(body).toString();if(Buffer.byteLength(raw)>16384)adapterDeny('HELPER_TASK_REQUEST_LIMIT');
      return call(new URL('/helper-task',base),'POST',raw,signal,10000);
    },
    claim:async(ids,lease,signal)=>{
      if(!Array.isArray(ids)||ids.length<1||ids.length>2||new Set(ids).size!==ids.length||
        [...ids,lease].some(v=>typeof v!=='string'||!/^[a-zA-Z0-9:_.-]{1,256}$/.test(v)))adapterDeny('INVALID_RECEIPT_CONSUMPTION');
      const url=new URL('/consume',base);const response=JSON.parse(await call(url,'POST',JSON.stringify({ids,lease}),signal));
      if(response.status!=='CONSUMED')adapterDeny('DURABLE_RECEIPT_CONSUMPTION_FAILED');
    },
  };
}
export function approvalSigningBytes(v:unknown):Buffer {
  function canonical(x:unknown):string {
    if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
    if(typeof x==='number'&&Number.isSafeInteger(x))return JSON.stringify(x);
    if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
    if(x&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype)return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical((x as any)[k])).join(',')+'}';
    return adapterDeny('INVALID_SIGNED_EVIDENCE');
  }
  return Buffer.from(canonical(v),'utf8');
}
export const productionApprovalTransport:ApprovalTransport={get:async(url,signal)=>{
  const response=await fetch(url,{signal,redirect:'error',headers:{Accept:'application/json'}});
  if(!response.ok||!response.body)adapterDeny('APPROVAL_SOURCE_UNAVAILABLE');
  const reader=response.body.getReader(),parts:Buffer[]=[];let size=0;
  try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>131072)adapterDeny('APPROVAL_RESPONSE_TOO_LARGE');parts.push(Buffer.from(p.value));}}
  finally{await reader.cancel();}
  return Buffer.concat(parts).toString('utf8');
}};
export class SignedApprovalReader extends ProductionSource {
  #seen=new Set<string>();readonly #anchor:ApprovalTrustAnchor|null;
  constructor(readonly purpose:ApprovalPurpose,anchor:ApprovalTrustAnchor|null,private readonly transport:ApprovalTransport=productionApprovalTransport){
    super('registration-approved-'+purpose);this.#anchor=anchor?Object.freeze({...anchor}):null;
  }
  assertReady(){
    const a=this.#anchor;if(!a)adapterDeny('APPROVAL_AUTHORITY_MISSING');
    const u=new URL(a.endpoint);
    if(a.purpose!==this.purpose||!a.issuer||!a.keyId||a.audience!=='cashback-registration-migration'||u.protocol!=='https:'||u.username||u.password||u.hash||u.search)adapterDeny('INVALID_TRUST_ANCHOR');
    if(createPublicKey(a.publicKeyPem).asymmetricKeyType!=='ed25519')adapterDeny('INVALID_TRUST_ANCHOR');
  }
  readPayload(reviewSha256:string,signal:AbortSignal):Promise<any>{return this.guarded(signal,async s=>{
    this.assertReady();if(!/^[a-f0-9]{64}$/.test(reviewSha256))adapterDeny('INVALID_REVIEW_BINDING');
    const a=this.#anchor!,url=new URL(a.endpoint);url.searchParams.set('purpose',this.purpose);url.searchParams.set('review',reviewSha256);
    const challenge=randomBytes(32).toString('hex');url.searchParams.set('challenge',challenge);
    const raw=await this.transport.get(url.href,s);if(raw.length>131072)adapterDeny('APPROVAL_RESPONSE_TOO_LARGE');
    const e=JSON.parse(raw),now=Date.now();
    if(!e||e.format!=='cashback-registration-approval/v1'||e.revision!==1||e.issuer!==a.issuer||e.keyId!==a.keyId||
      e.purpose!==this.purpose||e.audience!==a.audience||e.reviewSha256!==reviewSha256||e.challenge!==challenge||digest(e.identity)!==digest(E)||
      typeof e.nonce!=='string'||!/^[a-f0-9]{32,128}$/.test(e.nonce)||!Number.isFinite(e.issuedAt)||!Number.isFinite(e.expiresAt)||
      e.issuedAt>now||now-e.issuedAt>5000||e.expiresAt<=now||e.expiresAt-e.issuedAt>5000||
      typeof e.signature!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(e.signature))adapterDeny('INVALID_SIGNED_EVIDENCE');
    const {signature,...body}=e;
    if(Buffer.from(signature,'base64').toString('base64')!==signature||
      !verify(null,approvalSigningBytes(body),createPublicKey(a.publicKeyPem),Buffer.from(signature,'base64')))adapterDeny('SIGNATURE_INVALID');
    if(this.#seen.has(e.nonce))adapterDeny('SIGNED_EVIDENCE_REPLAYED');
    if(this.#seen.size>=4096)adapterDeny('REPLAY_LEDGER_FULL');
    this.#seen.add(e.nonce); // No eviction that would allow a nonce to become valid again.
    const records=Array.isArray(e.payload)?e.payload:[e.payload];
    if(!records.length||records.some((r:any)=>!r||typeof r!=='object'||r.observedAt!==e.issuedAt||!Number.isFinite(r.expiresAt)||r.expiresAt>e.expiresAt||r.expiresAt<=now||r.reviewSha256!==reviewSha256))adapterDeny('INVALID_SIGNED_PAYLOAD');
    return structuredClone(e.payload);
  });}
}
export class ApprovedFingerprintsAdapter extends SignedApprovalReader {
  constructor(anchor:ApprovalTrustAnchor|null,transport?:ApprovalTransport){super('fingerprints',anchor,transport);}
  async read(review:string,s:AbortSignal):Promise<ApprovedMigrationFingerprints>{
    try{
      const p=await this.readPayload(review,s);
      if(Array.isArray(p)||!['phone-seventh-only','phone-baseline-six-only'].includes(p.operation)||
        ![p.beforeSchemaSha256,p.afterSchemaSha256,p.securitySha256].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v))||p.beforeSchemaSha256===p.afterSchemaSha256)adapterDeny('INVALID_FINGERPRINT_APPROVAL');
      this.remember({review:p.reviewSha256,operation:p.operation,before:p.beforeSchemaSha256,after:p.afterSchemaSha256,security:p.securitySha256});return p;
    }catch(e){this.invalidate();throw e;}
  }
}
export class ApprovedReceiptsAdapter extends SignedApprovalReader {
  constructor(anchor:ApprovalTrustAnchor|null,private readonly receiptTransport?:ApprovalTransport){super('receipts',anchor,receiptTransport);}
  async claim(ids:readonly string[],lease:string,s:AbortSignal):Promise<void>{
    if(!this.receiptTransport?.claim)adapterDeny('DURABLE_RECEIPT_CONSUMPTION_UNCONFIGURED');
    try {await this.receiptTransport.claim(ids,lease,s);}catch{this.invalidate();adapterDeny('DURABLE_RECEIPT_CONSUMPTION_FAILED');}
  }
  async read(review:string,s:AbortSignal):Promise<readonly IndependentlyApprovedReceipt[]>{
    try{
      const rows=await this.readPayload(review,s);
      if(!Array.isArray(rows)||!rows.length||rows.length>2||rows.some(r=>typeof r.approvalId!=='string'||!/^[a-zA-Z0-9:_.-]{1,256}$/.test(r.approvalId)||!['B','C','BASELINE'].includes(r.permission)||
        !['phone-seventh-only','phone-baseline-six-only'].includes(r.operation)||digest(r.identity)!==digest(E)||
        !r.enrollmentId||r.executor!=='registration_migrator'||r.phase!==(r.operation==='phone-seventh-only'?'phone':'baseline')||
        !/^[1-9][0-9]*$/.test(r.fencingEpoch)||!/^[a-f0-9]{64}$/.test(r.securitySha256)||
        ![r.beforeSchemaSha256,r.afterSchemaSha256,r.sessionSha256].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)))||
        new Set(rows.map(r=>r.approvalId)).size!==rows.length||new Set(rows.map(r=>r.permission)).size!==rows.length)adapterDeny('INVALID_RECEIPT_APPROVAL');
      const permissions=rows.map(r=>r.permission).sort().join(',');
      if(rows.some(r=>r.operation!==rows[0].operation)||permissions!==(rows[0].operation==='phone-seventh-only'?'B,C':'BASELINE'))adapterDeny('INVALID_RECEIPT_APPROVAL');
      this.remember(rows.map(({observedAt,expiresAt,...r})=>r));return rows;
    }catch(e){this.invalidate();throw e;}
  }
}

/** Independently signed directory; no default anchor, credential or enrollment writer. */
export class ApprovedSessionDirectory extends SignedApprovalReader implements TrustedSessionDirectory {
  constructor(anchor:ApprovalTrustAnchor|null,transport?:ApprovalTransport){super('enrollment',anchor,transport);}
  async resolve(session:string,s:AbortSignal):Promise<EnrolledMigrationSession>{
    try {
      const p=await this.readPayload(session,s);
      if(Array.isArray(p)||p.sessionSha256!==session||digest(p.identity)!==digest(E)||
        !/^[a-f0-9]{64}$/.test(p.enrollmentId)||p.executor!=='registration_migrator'||
        !['phone-baseline-six-only','phone-seventh-only'].includes(p.operation)||
        p.phase!==(p.operation==='phone-seventh-only'?'phone':'baseline')||
        !/^[1-9][0-9]*$/.test(p.fencingEpoch)||!/^[a-f0-9]{64}$/.test(p.securitySha256)||
        !/^[1-9][0-9]*$/.test(p.backendPid)||!p.backendStart||!p.transaction||
        digest([p.backendPid,p.backendStart,p.transaction])!==session||!/^[a-f0-9]{64}$/.test(p.migrationReviewSha256))adapterDeny('INVALID_SESSION_ENROLLMENT');
      // Envelope lookup binds the session; a separate signed hash binds the exact migration review.
      const result={...p,reviewSha256:p.migrationReviewSha256};
      this.remember({...result,observedAt:0,expiresAt:0});return result;
    }catch(e){this.invalidate();throw e;}
  }
}
