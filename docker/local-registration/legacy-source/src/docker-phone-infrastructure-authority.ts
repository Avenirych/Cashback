import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { approvalSigningBytes } from './docker-phone-approved-evidence';
import type { ApprovalPurpose, ApprovalTrustAnchor } from './docker-phone-approved-evidence';
import { RegistrationInfrastructureLedger } from './docker-phone-infrastructure-ledger';
import { REGISTRATION_PHONE_EXPECTED as E, registrationSecurityDigest as hash } from './docker-phone-registration-target';
import { validateCreationPlan, validateCreationAttestation } from './docker-phone-creation-contract';
import type { CreationPlan, CreationAuthorizationEnvelope } from './docker-phone-creation-contract';
import {validateHelperTask,validateHelperSql,assertHelperAdmission,taskDeny} from './docker-phone-helper-task';
import type {HelperIdentity,HelperTaskEnvelope} from './docker-phone-helper-task';

export interface OwnerDecision {
  format:'registration-owner-decision/v1';action:'approve'|'revoke'|'reconcile'|'activate-key'|'revoke-key'|'advance-epoch'|'authorize-creation'|'attest-creation'|'authorize-helper-task'|'authorize-helper-sql';
  identity:typeof E;purpose:ApprovalPurpose;issuer:string;keyId:string;challenge:string;
  id:string;payloadHash:string;issuedAt:number;expiresAt:number;
}
export interface AuthorityKeySource {privateKey():Promise<string>}
function deny(code:string):never {throw new Error('REGISTRATION_AUTHORITY:'+code);}
/** Signing implementation for the EXISTING envelope/readers, not a migration admission system.
 * Instance per independent principal, protected directory, signing key and owner-review key.
 * No key generation, automatic review, observed-state approval or default authority on import.
 */
export class RegistrationApprovalAuthority {
  readonly #anchor:ApprovalTrustAnchor;readonly #ownerKey:string;
  constructor(anchor:ApprovalTrustAnchor,ownerPublicKey:string,private readonly keys:AuthorityKeySource,
    private readonly ledger:RegistrationInfrastructureLedger){
    this.#anchor=Object.freeze({...anchor});this.#ownerKey=ownerPublicKey;
    if(createPublicKey(ownerPublicKey).asymmetricKeyType!=='ed25519'||createPublicKey(anchor.publicKeyPem).asymmetricKeyType!=='ed25519')deny('ED25519_REQUIRED');
    if(createPublicKey(ownerPublicKey).export({type:'spki',format:'der'}).equals(createPublicKey(anchor.publicKeyPem).export({type:'spki',format:'der'})))deny('REVIEWER_AND_ISSUER_MUST_DIFFER');
  }
  async challenge():Promise<string>{
    const id=randomBytes(32).toString('hex');
    await this.ledger.transaction((_s,emit)=>emit({kind:'nonce-issued',id,purpose:'owner-'+this.#anchor.purpose}));return id;
  }
  private verifyDecision(d:OwnerDecision,signature:string,payload:unknown):void {
    const now=Date.now(),a=this.#anchor;
    if(d.format!=='registration-owner-decision/v1'||hash(d.identity)!==hash(E)||d.issuer!==a.issuer||d.purpose!==a.purpose||
      !/^[a-zA-Z0-9:_.-]{1,256}$/.test(d.id)||!/^[a-f0-9]{64}$/.test(d.challenge)||d.payloadHash!==hash(payload)||
      !Number.isSafeInteger(d.issuedAt)||!Number.isSafeInteger(d.expiresAt)||d.issuedAt>now||now-d.issuedAt>60000||d.expiresAt<=now||d.expiresAt-d.issuedAt>60000||
      !verify(null,approvalSigningBytes(d),createPublicKey(this.#ownerKey),Buffer.from(signature,'base64')))deny('OWNER_DECISION_INVALID');
  }
  async decide(d:OwnerDecision,signature:string,payload:any):Promise<void>{
    d=JSON.parse(approvalSigningBytes(d).toString('utf8'));payload=JSON.parse(approvalSigningBytes(payload).toString('utf8'));
    this.verifyDecision(d,signature,payload);
    await this.ledger.transaction((state,emit)=>{
      emit({kind:'nonce-used',id:d.challenge,purpose:'owner-'+this.#anchor.purpose});
      if(d.action==='approve'){
        if(d.keyId!==this.#anchor.keyId||state.keys[d.keyId]?.state!=='ACTIVE'||state.keys[d.keyId]?.publicKeyHash!==hash(this.#anchor.publicKeyPem))deny('SIGNING_KEY_NOT_ACTIVE');
        this.validatePayload(payload,Date.now());
        const rows=Array.isArray(payload)?payload:[payload];
        if(d.purpose==='enrollment')emit({kind:'enroll',id:payload.enrollmentId,session:payload.sessionSha256,review:payload.migrationReviewSha256,security:payload.securitySha256,epoch:payload.fencingEpoch,expires:payload.expiresAt});
        if(d.purpose==='receipts')for(const row of rows){const enrolled=state.sessions[row.enrollmentId];if(!enrolled||state.revoked[row.enrollmentId]||enrolled.expires<=Date.now()||enrolled.session!==row.sessionSha256||enrolled.review!==row.reviewSha256||enrolled.security!==row.securitySha256||enrolled.epoch!==row.fencingEpoch||row.fencingEpoch!==state.epoch)deny('ENROLLMENT_MISSING_OR_CHANGED');}
        for(const row of rows)emit({kind:'approval',id:row.approvalId??d.id,purpose:d.purpose,review:row.reviewSha256,payloadHash:hash(row),expires:Math.min(d.expiresAt,row.expiresAt),
          ...(d.purpose==='receipts'?{enrollmentId:row.enrollmentId,epoch:row.fencingEpoch,session:row.sessionSha256,security:row.securitySha256}:{})});
      } else if(d.action==='authorize-helper-task'||d.action==='authorize-helper-sql'){
        const purpose=d.action==='authorize-helper-task'?'enrollment':'receipts';
        if(d.purpose!==purpose||d.keyId!==this.#anchor.keyId||state.keys[d.keyId]?.state!=='ACTIVE'||state.keys[d.keyId]?.publicKeyHash!==hash(this.#anchor.publicKeyPem))deny('HELPER_AUTHORITY_REQUIRED');
        if(d.action==='authorize-helper-task'){
          validateHelperTask(payload,Date.now());if(d.id!==payload.id||payload.expiresAt>d.expiresAt)deny('HELPER_TASK_BINDING');assertHelperAdmission(state,payload,Date.now());
          emit({kind:'helper-task-approved',task:payload,keyId:d.keyId,publicKeyHash:hash(this.#anchor.publicKeyPem)});
        }else{
          validateHelperSql(payload,Date.now());if(d.id!==payload.id||payload.expiresAt>d.expiresAt)deny('HELPER_SQL_BINDING');
          emit({kind:'helper-sql-approved',approval:payload,keyId:d.keyId,publicKeyHash:hash(this.#anchor.publicKeyPem)});
        }
      } else if(d.action==='authorize-creation'){
        // A separate signed action, never inferred from generic migration approval or Docker IDs.
        if(d.purpose!=='enrollment'||d.keyId!==this.#anchor.keyId||state.keys[d.keyId]?.state!=='ACTIVE'||state.keys[d.keyId]?.publicKeyHash!==hash(this.#anchor.publicKeyPem))deny('CREATION_AUTHORITY_REQUIRED');
        const plan=validateCreationPlan(payload,Date.now());
        emit({kind:'creation-authorized',id:d.id,scope:hash(plan),plan:payload,expires:Math.min(d.expiresAt,plan.expiresAt),keyId:d.keyId,publicKeyHash:hash(this.#anchor.publicKeyPem)});
      } else if(d.action==='attest-creation'){
        if(d.purpose!=='enrollment'||d.keyId!==this.#anchor.keyId||state.keys[d.keyId]?.state!=='ACTIVE'||state.keys[d.keyId]?.publicKeyHash!==hash(this.#anchor.publicKeyPem))deny('CREATION_AUTHORITY_REQUIRED');
        const c=state.creations[d.id];if(!c||!c.identities||payload.authorizationId!==d.id||payload.reservationId!==c.reservation)deny('CREATION_ATTESTATION_BINDING_MISMATCH');
        validateCreationAttestation(payload,c.plan,c.identities,Date.now(),c.network);
        emit({kind:'creation-attested',id:d.id,attestation:payload});
      } else if(d.action==='advance-epoch'){
        if(d.purpose!=='enrollment')deny('EPOCH_AUTHORITY_REQUIRED');
        emit({kind:'epoch',epoch:payload.epoch});
      } else if(d.action==='revoke')emit({kind:'revoke',id:d.id,reason:'OWNER_REVOKED'});
      else if(d.action==='activate-key'||d.action==='revoke-key'){
        if(d.keyId!==d.id||payload.publicKeyHash!==hash(this.#anchor.publicKeyPem)||d.keyId!==this.#anchor.keyId)deny('KEY_PIN_MISMATCH');
        emit({kind:'key-state',id:d.id,publicKeyHash:payload.publicKeyHash,state:d.action==='activate-key'?'ACTIVE':'REVOKED'});
      } else if(d.action==='reconcile'){
        if(payload.readOnly!==true||hash(payload.identity)!==hash(E)||!['COMMITTED','ABORTED_BEFORE_COMMIT'].includes(payload.outcome))deny('RECONCILIATION_NOT_READ_ONLY');
        emit({kind:'reconciliation',review:payload.reviewSha256,evidenceHash:payload.evidenceHash,outcome:payload.outcome,readOnly:true});
      } else deny('UNKNOWN_ACTION');
    });
  }
  private validatePayload(payload:any,now:number):void {
    const a=this.#anchor,rows=Array.isArray(payload)?payload:[payload];
    if(!rows.length||rows.length>2||rows.some(r=>!r||!/^[a-f0-9]{64}$/.test(r.reviewSha256)||!Number.isSafeInteger(r.expiresAt)||r.expiresAt<=now))deny('INVALID_PAYLOAD');
    if(a.purpose==='fingerprints'){
      if(rows.length!==1||!['phone-baseline-six-only','phone-seventh-only'].includes(payload.operation)||
        ![payload.beforeSchemaSha256,payload.afterSchemaSha256,payload.securitySha256].every(v=>/^[a-f0-9]{64}$/.test(v))||payload.beforeSchemaSha256===payload.afterSchemaSha256)deny('INVALID_FINGERPRINTS');
    } else if(a.purpose==='receipts'){
      if(!Array.isArray(payload)||rows.some(r=>!['phone-baseline-six-only','phone-seventh-only'].includes(r.operation)||hash(r.identity)!==hash(E)||r.executor!=='registration_migrator'||
        ![r.enrollmentId,r.sessionSha256,r.securitySha256,r.beforeSchemaSha256,r.afterSchemaSha256].every(v=>/^[a-f0-9]{64}$/.test(v))||
        r.phase!==(r.operation==='phone-seventh-only'?'phone':'baseline')||!/^[1-9][0-9]*$/.test(r.fencingEpoch))||
        rows.map(r=>r.permission).sort().join(',')!==(rows[0].operation==='phone-seventh-only'?'B,C':'BASELINE')||
        rows.some(r=>['operation','sessionSha256','reviewSha256','enrollmentId','fencingEpoch','securitySha256','beforeSchemaSha256','afterSchemaSha256','phase','executor']
          .some(k=>r[k]!==rows[0][k])||r.beforeSchemaSha256===r.afterSchemaSha256))deny('INVALID_RECEIPTS');
    } else if(a.purpose==='enrollment'){
      if(Array.isArray(payload)||hash(payload.identity)!==hash(E)||payload.executor!=='registration_migrator'||
        ![payload.enrollmentId,payload.sessionSha256,payload.migrationReviewSha256,payload.securitySha256].every(v=>/^[a-f0-9]{64}$/.test(v))||
        payload.reviewSha256!==payload.sessionSha256||hash([payload.backendPid,payload.backendStart,payload.transaction])!==payload.sessionSha256||
        !['phone-baseline-six-only','phone-seventh-only'].includes(payload.operation)||payload.phase!==(payload.operation==='phone-seventh-only'?'phone':'baseline')||!/^[1-9][0-9]*$/.test(payload.fencingEpoch))deny('INVALID_ENROLLMENT');
    } else deny('UNSUPPORTED_PURPOSE');
  }
  async envelope(id:string,payload:any,challenge:string):Promise<string>{
    payload=JSON.parse(approvalSigningBytes(payload).toString('utf8'));
    const now=Date.now(),a=this.#anchor;if(!/^[a-f0-9]{64}$/.test(challenge))deny('INVALID_CHALLENGE');
    this.validatePayload(payload,now);
    const rows=Array.isArray(payload)?payload:[payload],nonce=randomBytes(32).toString('hex');
    let expiresAt=Math.min(now+4000,...rows.map(r=>r.expiresAt));
    // Authenticate key material BEFORE irreversible issuance. Never print raw key-provider errors.
    let privateKey:ReturnType<typeof createPrivateKey>;
    try{privateKey=createPrivateKey(await this.keys.privateKey());if(privateKey.asymmetricKeyType!=='ed25519'||
      createPublicKey(privateKey).export({type:'spki',format:'der'}).compare(createPublicKey(a.publicKeyPem).export({type:'spki',format:'der'})))deny('KEY_MISMATCH');}
    catch{deny('KEY_SOURCE_UNAVAILABLE_OR_MISMATCH');}
    await this.ledger.transaction((state,emit)=>{
      if(state.keys[a.keyId]?.state!=='ACTIVE'||state.keys[a.keyId]?.publicKeyHash!==hash(a.publicKeyPem))deny('KEY_REVOKED');
      for(const row of rows){const key=row.approvalId??id,approval=state.approvals[key];
        if(!approval||state.revoked[key]||approval.purpose!==a.purpose||approval.payloadHash!==hash(row)||approval.expires<=now)deny('APPROVAL_MISSING_OR_REVOKED');
        expiresAt=Math.min(expiresAt,approval.expires);
        if(row.fencingEpoch&&row.fencingEpoch!==state.epoch)deny('EPOCH_CHANGED');
        if(row.enrollmentId&&state.revoked[row.enrollmentId])deny('SESSION_REVOKED');
        if(a.purpose==='receipts'){
          const session=state.sessions[row.enrollmentId];
          if(!session||session.expires<=now||session.session!==row.sessionSha256||session.review!==row.reviewSha256||
            session.security!==row.securitySha256||session.epoch!==row.fencingEpoch)deny('ENROLLMENT_MISSING_OR_CHANGED');
          expiresAt=Math.min(expiresAt,session.expires);
        }
      }
      emit({kind:'nonce-issued',id:nonce,purpose:a.purpose});emit({kind:'nonce-used',id:nonce,purpose:a.purpose});
      // The requester challenge is durable too: cached/repeated requests cannot mint a fresh response.
      emit({kind:'nonce-issued',id:challenge,purpose:'request-'+a.purpose});emit({kind:'nonce-used',id:challenge,purpose:'request-'+a.purpose});
    });
    const content=rows.map(r=>({...r,observedAt:now,expiresAt}));
    const body={format:'cashback-registration-approval/v1',revision:1,issuer:a.issuer,keyId:a.keyId,purpose:a.purpose,audience:a.audience,
      reviewSha256:rows[0].reviewSha256,identity:E,challenge,nonce,issuedAt:now,expiresAt,payload:Array.isArray(payload)?content:content[0]};
    return JSON.stringify({...body,signature:sign(null,approvalSigningBytes(body),privateKey!).toString('base64')});
  }
  async consume(ids:readonly string[],lease:string):Promise<void>{
    ids=[...ids];
    if(this.#anchor.purpose!=='receipts'||ids.length<1||ids.length>2||new Set(ids).size!==ids.length)deny('INVALID_CONSUMPTION');
    await this.ledger.transaction((s,emit)=>{for(const id of ids){
      const a=s.approvals[id],session=a?.enrollmentId?s.sessions[a.enrollmentId]:undefined;
      if(!a||a.purpose!=='receipts'||a.expires<=Date.now()||s.revoked[id]||!session||s.revoked[a.enrollmentId!]||
        session.expires<=Date.now()||a.epoch!==s.epoch||session.epoch!==a.epoch||session.session!==a.session||session.review!==a.review||session.security!==a.security)deny('RECEIPT_EXPIRED_OR_REVOKED');
      if(s.spent[id]===lease)continue;emit({kind:'receipt-used',id,lease});
    }});
  }
  /** Existing enrollment signer, distinct audience; task approval is never inferred from creation. */
  async helperTaskEnvelope(identity:HelperIdentity,challenge:string):Promise<string>{
    if(this.#anchor.purpose!=='enrollment'||!/^[a-f0-9]{64}$/.test(challenge))deny('HELPER_AUTHORITY_REQUIRED');
    const a=this.#anchor,now=Date.now(),key=createPrivateKey(await this.keys.privateKey());
    if(key.asymmetricKeyType!=='ed25519'||!createPublicKey(key).export({type:'spki',format:'der'}).equals(createPublicKey(a.publicKeyPem).export({type:'spki',format:'der'})))deny('KEY_MISMATCH');
    const task=await this.ledger.transaction((s,emit)=>{
      if(s.keys[a.keyId]?.state!=='ACTIVE'||s.keys[a.keyId]?.publicKeyHash!==hash(a.publicKeyPem))deny('KEY_REVOKED');
      // A restarted helper must not skip an interrupted task and start later work.
      const pending=Object.values(s.helperTasks).find(t=>hash(t.task.identity)===hash(identity)&&['RUNNING','UNKNOWN'].includes(t.status));
      if(pending){
        if(pending.status==='RUNNING')emit({kind:'helper-task-finished',id:pending.task.id,runId:pending.runId!,outcome:'UNKNOWN',resultSha256:hash({reason:'RESTART_OR_DUPLICATE_FETCH'}),at:now});
        return null;
      }
      const row=Object.values(s.helperTasks).find(t=>t.status==='APPROVED'&&!s.revoked[t.task.id]&&t.task.expiresAt>now&&hash(t.task.identity)===hash(identity));
      if(!row)taskDeny('NO_APPROVED_TASK');assertHelperAdmission(s,row.task,now);
      emit({kind:'nonce-issued',id:challenge,purpose:'helper-task-request'});return row.task;
    });
    if(task===null)taskDeny('UNKNOWN_OUTCOME_RECONCILIATION_REQUIRED');
    const body:Omit<HelperTaskEnvelope,'signature'>={format:'registration-helper-task-envelope/v1',issuer:a.issuer,keyId:a.keyId,audience:'cashback-registration-helper',challenge,issuedAt:now,expiresAt:Math.min(now+4000,task.expiresAt),task};
    return JSON.stringify({...body,signature:sign(null,approvalSigningBytes(body),key).toString('base64')});
  }
  /** Dedicated creation envelope served by the existing enrollment authority/mTLS identity.
   * The owner must have independently signed authorize-creation for this exact immutable plan.
   * Generic migration approvals cannot be used here, and issuance is not Docker admission.
   */
  async creationEnvelope(id:string,input:CreationPlan,challenge:string):Promise<string>{
    const plan=validateCreationPlan(input,Date.now()),a=this.#anchor,now=Date.now();
    if(a.purpose!=='enrollment'||!/^[a-f0-9]{64}$/.test(challenge))deny('CREATION_AUTHORITY_REQUIRED');
    let privateKey:ReturnType<typeof createPrivateKey>;
    try{privateKey=createPrivateKey(await this.keys.privateKey());if(privateKey.asymmetricKeyType!=='ed25519'||
      !createPublicKey(privateKey).export({type:'spki',format:'der'}).equals(createPublicKey(a.publicKeyPem).export({type:'spki',format:'der'})))deny('KEY_MISMATCH');}
    catch{deny('KEY_SOURCE_UNAVAILABLE_OR_MISMATCH');}
    const nonce=randomBytes(32).toString('hex');let expiresAt=Math.min(now+4000,plan.expiresAt);
    await this.ledger.transaction((state,emit)=>{
      const c=state.creations[id];
      if(state.keys[a.keyId]?.state!=='ACTIVE'||state.keys[a.keyId]?.publicKeyHash!==hash(a.publicKeyPem)||!c||c.stage!=='CREATION_AUTHORIZED'||c.reservation||
        c.scope!==hash(plan)||c.expires<=now||state.revoked[id]||c.plan.fencing.epoch!==state.epoch)deny('CREATION_APPROVAL_MISSING_OR_REVOKED');
      expiresAt=Math.min(expiresAt,c.expires);
      emit({kind:'nonce-issued',id:nonce,purpose:'creation'});emit({kind:'nonce-used',id:nonce,purpose:'creation'});
      // The control-plane consumes this durable requester challenge in creation-reserved.
      emit({kind:'nonce-issued',id:challenge,purpose:'request-creation'});
    });
    const body:Omit<CreationAuthorizationEnvelope,'signature'>={format:'registration-creation-authorization/v1',issuer:a.issuer,keyId:a.keyId,audience:'cashback-registration-creation',
      authorizationId:id,scopeSha256:hash(plan),identity:plan.identity,challenge,nonce,issuedAt:now,expiresAt};
    return JSON.stringify({...body,signature:sign(null,approvalSigningBytes(body),privateKey!).toString('base64')});
  }
}
