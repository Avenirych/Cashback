import { createPublicKey, randomBytes, verify } from 'node:crypto';
import { approvalSigningBytes } from './docker-phone-approved-evidence';
import type { ApprovalTrustAnchor } from './docker-phone-approved-evidence';
import type { RegistrationInfrastructureLedger } from './docker-phone-infrastructure-ledger';
import { REGISTRATION_PHONE_EXPECTED as E, registrationSecurityDigest as hash } from './docker-phone-registration-target';

export type CreationService = 'migration-executor'|'observer';
export interface CreationHelper {
  service:CreationService; name:string; image:string; configurationSha256:string;
  mounts:readonly {type:'bind';source:string;target:string;readOnly:true}[];
  networks:readonly {name:string;id:string|null;configurationSha256:string}[];
  labels:Readonly<Record<string,string>>; capAdd:readonly [];capDrop:readonly ['ALL'];
  securityOpt:readonly ['no-new-privileges:true'];readOnly:true;user:string;
  entrypoint:readonly string[];command:readonly string[];ports:readonly [];
}
export interface CreationPlan {
  format:'registration-helper-creation/v1';
  identity:{context:string;daemonId:string;project:string;postgresContainerId:string};
  platform:'linux/amd64';phase:'baseline'|'phone';
  templateSha256:string;effectiveComposeSha256:string;postgresBaselineSha256:string;
  newNetwork:null|{name:string;driver:'bridge';internal:true;labels:Readonly<Record<string,string>>;ipam:Readonly<Record<string,never>>;options:Readonly<Record<string,never>>};
  helpers:readonly CreationHelper[];
  fencing:{provider:string;epoch:string;bindingSha256:string};expiresAt:number;
}
export interface CreatedHelperIdentity {service:CreationService;id:string}
export interface CreatedNetworkIdentity {name:string;id:string;configurationSha256:string}
export interface CreationPartialResult {identities?:readonly CreatedHelperIdentity[];network?:CreatedNetworkIdentity;returnedNetworkId?:string}
export interface CreationAuthorizationEnvelope {
  format:'registration-creation-authorization/v1';issuer:string;keyId:string;audience:'cashback-registration-creation';
  authorizationId:string;scopeSha256:string;identity:CreationPlan['identity'];challenge:string;nonce:string;
  issuedAt:number;expiresAt:number;signature:string;
}
export interface CreationAttestation {
  format:'registration-creation-attestation/v1';authorizationId:string;reservationId:string;scopeSha256:string;
  identities:readonly (CreatedHelperIdentity&{desiredConfigurationSha256:string;observedConfigurationSha256:string})[];
  network:null|CreatedNetworkIdentity;
  evidenceSha256:string;observedAt:number;expiresAt:number;readOnly:true;
}
function deny(code:string):never{throw new Error('REGISTRATION_CREATION:'+code);}
const hex=/^[a-f0-9]{64}$/;
const safeId=/^[a-zA-Z0-9:_.-]{1,256}$/;
const exact=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const copy=<T>(v:T):T=>JSON.parse(approvalSigningBytes(v).toString('utf8'));
/** The complete reviewed plan is immutable scope; no host discovery becomes an approval. */
export function validateCreationPlan(input:CreationPlan,now?:number):Readonly<CreationPlan>{
  let p:CreationPlan;try{p=copy(input);}catch{deny('INVALID_PLAN');}
  if(!exact(p!,['format','identity','platform','phase','templateSha256','effectiveComposeSha256','postgresBaselineSha256','newNetwork','helpers','fencing','expiresAt'])||
    p!.format!=='registration-helper-creation/v1'||!exact(p!.identity,['context','daemonId','project','postgresContainerId'])||
    p!.identity.context!==E.context||p!.identity.daemonId!==E.daemonId||p!.identity.project!==E.project||p!.identity.postgresContainerId!==E.containerId||
    p!.platform!=='linux/amd64'||!['baseline','phone'].includes(p!.phase))deny('IDENTITY_MISMATCH');
  if(![p!.templateSha256,p!.effectiveComposeSha256,p!.postgresBaselineSha256].every(v=>hex.test(v))||
    !Number.isSafeInteger(p!.expiresAt)||p!.expiresAt<=0||(now!==undefined&&(p!.expiresAt<=now||p!.expiresAt-now>60000)))deny('INVALID_OR_EXPIRED_PLAN');
  if(!exact(p!.fencing,['provider','epoch','bindingSha256'])||!safeId.test(p!.fencing.provider)||!(/^[1-9][0-9]*$/).test(p!.fencing.epoch)||!hex.test(p!.fencing.bindingSha256))deny('FENCING_BINDING_REQUIRED');
  if(p!.newNetwork!==null&&(!exact(p!.newNetwork,['name','driver','internal','labels','ipam','options'])||
    p!.newNetwork.name!==`${E.project}-authority`||p!.newNetwork.driver!=='bridge'||p!.newNetwork.internal!==true||
    !exact(p!.newNetwork.labels,['com.docker.compose.project','com.docker.compose.network'])||p!.newNetwork.labels['com.docker.compose.project']!==E.project||
    p!.newNetwork.labels['com.docker.compose.network']!=='authority'||!exact(p!.newNetwork.ipam,[])||!exact(p!.newNetwork.options,[])))deny('NEW_NETWORK_NOT_APPROVED');
  if(!Array.isArray(p!.helpers)||p!.helpers.length!==2||p!.helpers.some(h=>!h||typeof h!=='object')||p!.helpers.map(h=>h.service).sort().join(',')!=='migration-executor,observer')deny('HELPERS_REQUIRED');
  for(const h of p!.helpers){
    if(!exact(h,['service','name','image','configurationSha256','mounts','networks','labels','capAdd','capDrop','securityOpt','readOnly','user','entrypoint','command','ports'])||
      h.name!==`${E.project}-${h.service}-1`||!(/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/).test(h.image)||!hex.test(h.configurationSha256)||
      !Array.isArray(h.capAdd)||h.capAdd.length||hash(h.capDrop)!==hash(['ALL'])||hash(h.securityOpt)!==hash(['no-new-privileges:true'])||h.readOnly!==true||
      !(/^[1-9][0-9]{0,9}:[1-9][0-9]{0,9}$/).test(h.user)||!Array.isArray(h.ports)||h.ports.length||
      !Array.isArray(h.entrypoint)||h.entrypoint.length!==1||!Array.isArray(h.command)||[...h.entrypoint,...h.command].some(v=>typeof v!=='string'||!v||v.includes('\0')))deny('HELPER_CONFIGURATION_INVALID');
    if(!h.labels||h.labels['com.docker.compose.project']!==E.project||h.labels['com.docker.compose.service']!==h.service||
      Object.entries(h.labels).some(([k,v])=>!safeId.test(k)||typeof v!=='string'||/cashback-finance-security|cashback-docker-test/.test(v)))deny('HELPER_LABELS_INVALID');
    if(!Array.isArray(h.mounts)||h.mounts.length===0)deny('MOUNTS_REQUIRED');
    for(const m of h.mounts){
      const source=m.source?.replace(/\\/g,'/');
      if(!exact(m,['type','source','target','readOnly'])||m.type!=='bind'||m.readOnly!==true||
        !/^(C:\/approved-registration-infrastructure\/|\/run\/desktop\/mnt\/host\/c\/approved-registration-infrastructure\/)/.test(source)||
        source.includes('..')||/[,\r\n\0]/.test(source)||!/^\/run\/registration\/[a-zA-Z0-9_./-]+$/.test(m.target)||m.target.includes('..')||
        /docker\.sock|docker_engine|\.env$|cashback-finance-security|cashback-docker-test/.test(source))deny('MOUNT_NOT_APPROVED');
    }
    if(new Set(h.mounts.map((m:CreationHelper['mounts'][number])=>m.target)).size!==h.mounts.length||!Array.isArray(h.networks)||h.networks.length!==2||
      h.networks.map((n:CreationHelper['networks'][number])=>n.name).sort().join(',')!==[E.network,`${E.project}-authority`].sort().join(','))deny('NETWORK_NOT_APPROVED');
    for(const n of h.networks)if(!exact(n,['name','id','configurationSha256'])||!hex.test(n.configurationSha256)||
      (n.name===E.network?!hex.test(n.id as string):p!.newNetwork!==null?(n.id!==null||n.configurationSha256!==hash(p!.newNetwork)):!hex.test(n.id as string)))deny('NETWORK_NOT_APPROVED');
    if(h.configurationSha256!==creationHelperSpecDigest(h))deny('HELPER_SPEC_HASH_MISMATCH');
  }
  if(hash(p!.helpers[0].networks)!==hash(p!.helpers[1].networks))deny('NETWORK_BINDING_MISMATCH');
  if(p!.fencing.bindingSha256!==creationFencingBindingDigest(p!))deny('FENCING_SCOPE_MISMATCH');
  const freeze=(v:any):any=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  return freeze(p!);
}
export function validateCreatedIdentities(identities:readonly CreatedHelperIdentity[]):readonly CreatedHelperIdentity[]{
  if(!Array.isArray(identities)||identities.length!==2||identities.map(v=>v.service).sort().join(',')!=='migration-executor,observer'||
    identities.some(v=>!exact(v,['service','id'])||!hex.test(v.id)||v.id===E.containerId)||new Set(identities.map(v=>v.id)).size!==2)deny('CREATED_IDENTITY_INVALID');
  return [...copy(identities)].sort((a,b)=>a.service.localeCompare(b.service));
}
export function creationHelperSpecDigest(h:CreationHelper):string{const {configurationSha256,...spec}=h;return hash(spec);}
/** Independent provider signs this complete creation scope; omit only the binding itself. */
export function creationFencingBindingDigest(p:CreationPlan):string{
  const {fencing,...rest}=p;return hash({operation:'registration-helper-creation',...rest,fencing:{provider:fencing.provider,epoch:fencing.epoch}});
}
export function validateCreatedNetwork(n:CreatedNetworkIdentity|undefined,p:CreationPlan):void{
  if(p.newNetwork===null){if(n!==undefined)deny('UNEXPECTED_CREATED_NETWORK');return;}
  if(!n||!exact(n,['name','id','configurationSha256'])||n.name!==p.newNetwork.name||!hex.test(n.id)||!hex.test(n.configurationSha256)||
    p.helpers[0].networks.some(v=>v.id===n.id))deny('CREATED_NETWORK_IDENTITY_INVALID');
}
export function validateCreationAttestation(a:CreationAttestation,p:CreationPlan,ids:readonly CreatedHelperIdentity[],now?:number,network?:CreatedNetworkIdentity):void{
  if(!exact(a,['format','authorizationId','reservationId','scopeSha256','identities','network','evidenceSha256','observedAt','expiresAt','readOnly'])||
    a.format!=='registration-creation-attestation/v1'||a.readOnly!==true||a.scopeSha256!==hash(p)||!safeId.test(a.authorizationId)||!hex.test(a.reservationId)||!hex.test(a.evidenceSha256)||
    !Number.isSafeInteger(a.observedAt)||!Number.isSafeInteger(a.expiresAt)||a.observedAt<0||a.expiresAt<=a.observedAt||a.expiresAt-a.observedAt>30000||
    (now!==undefined&&(a.observedAt>now||a.expiresAt<=now))||!Array.isArray(a.identities)||a.identities.length!==2)deny('ATTESTATION_INVALID');
  const ordered=[...a.identities].sort((x,y)=>x.service.localeCompare(y.service));
  if(ordered.some(v=>!exact(v,['service','id','desiredConfigurationSha256','observedConfigurationSha256']))||hash(ordered.map(({service,id})=>({service,id})))!==hash(validateCreatedIdentities(ids))||
    ordered.some(v=>p.helpers.find(h=>h.service===v.service)?.configurationSha256!==v.desiredConfigurationSha256||!hex.test(v.observedConfigurationSha256))||
    hash(a.network)!==hash(network??null))deny('ATTESTATION_IDENTITY_MISMATCH');
}
export interface CreationFence {
  /** Independently enforced host boundary. A truthy config flag is not an implementation. */
  held(plan:Readonly<CreationPlan>):Promise<boolean>;
}
/** Existing ledger adapter: reservation consumes authorization before any Docker mutation.
 * PENDING and UNKNOWN survive restart; neither permits retry, even after expiry.
 */
export class LedgerDockerCreation {
  private readonly anchor:ApprovalTrustAnchor|null;
  constructor(private readonly ledger:RegistrationInfrastructureLedger,anchor:ApprovalTrustAnchor|null,
    private readonly fence:CreationFence|null,private readonly now:()=>number=Date.now){this.anchor=anchor?Object.freeze({...anchor}):null;}
  async reserve(envelope:CreationAuthorizationEnvelope,plan:CreationPlan,challenge:string):Promise<string>{
    const p=validateCreationPlan(plan,this.now()),e=copy(envelope),a=this.anchor;
    if(!a||a.purpose!=='enrollment')deny('CREATION_AUTHORITY_NOT_PROVISIONED');
    if(!this.fence)deny('EXTERNAL_FENCING_PROVIDER_MISSING');
    const {signature,...body}=e;
    try{
      if(!exact(e,['format','issuer','keyId','audience','authorizationId','scopeSha256','identity','challenge','nonce','issuedAt','expiresAt','signature'])||
        e.format!=='registration-creation-authorization/v1'||e.issuer!==a.issuer||e.keyId!==a.keyId||e.audience!=='cashback-registration-creation'||
        e.scopeSha256!==hash(p)||hash(e.identity)!==hash(p.identity)||!hex.test(challenge)||e.challenge!==challenge||!hex.test(e.nonce)||!safeId.test(e.authorizationId)||
        !Number.isSafeInteger(e.issuedAt)||!Number.isSafeInteger(e.expiresAt)||e.issuedAt>this.now()||e.expiresAt<=this.now()||e.expiresAt-e.issuedAt>4000||
        e.expiresAt>p.expiresAt||createPublicKey(a.publicKeyPem).asymmetricKeyType!=='ed25519'||
        !verify(null,approvalSigningBytes(body),createPublicKey(a.publicKeyPem),Buffer.from(signature,'base64')))deny('CREATION_APPROVAL_INVALID');
    }catch{deny('CREATION_APPROVAL_INVALID');}
    if(!await this.fence.held(p))deny('EXTERNAL_FENCING_NOT_HELD');
    const reservation=randomBytes(32).toString('hex');
    await this.ledger.transaction((s,emit)=>{
      const authorized=s.creations[e.authorizationId];
      if(!authorized||authorized.scope!==hash(p)||authorized.expires<=this.now()||s.revoked[e.authorizationId]||
        authorized.keyId!==a.keyId||authorized.publicKeyHash!==hash(a.publicKeyPem)||
        s.keys[a.keyId]?.state!=='ACTIVE'||s.keys[a.keyId]?.publicKeyHash!==hash(a.publicKeyPem))deny('CREATION_APPROVAL_MISSING_OR_REVOKED');
      emit({kind:'creation-reserved',id:e.authorizationId,reservation,scope:hash(p),epoch:p.fencing.epoch,challenge:e.challenge,at:this.now()});
    });
    // Failure here leaves a durable pending operation: STOP and reconcile; never auto retry.
    if(!await this.fence.held(p))deny('FENCING_LOST_RECONCILIATION_REQUIRED');
    return reservation;
  }
  async record(reservation:string,plan:CreationPlan,identities:readonly CreatedHelperIdentity[],network?:CreatedNetworkIdentity):Promise<void>{
    const p=validateCreationPlan(plan),ids=validateCreatedIdentities(identities);
    validateCreatedNetwork(network,p);
    await this.ledger.transaction((s,emit)=>{
      const row=Object.values(s.creations).find(c=>c.reservation===reservation);
      if(!row||row.scope!==hash(p))deny('RESERVATION_BINDING_MISMATCH');
      emit({kind:'creation-created',id:row.id,reservation,scope:hash(p),identities:ids,...(network?{network}:{} )});
    });
    if(!this.fence||!await this.fence.held(p))deny('FENCING_LOST_RECONCILIATION_REQUIRED');
  }
  /** Read-only revocation/key/epoch/expiry check immediately before each bounded mutation. */
  async assertReserved(reservation:string,plan:CreationPlan):Promise<void>{
    const p=validateCreationPlan(plan,this.now()),s=await this.ledger.inspect(),a=this.anchor;
    const c=Object.values(s.creations).find(v=>v.reservation===reservation);
    if(!a||!c||c.stage!=='CREATION_AUTHORIZED'||c.scope!==hash(p)||c.expires<=this.now()||s.revoked[c.id]||
      c.plan.fencing.epoch!==s.epoch||c.keyId!==a.keyId||c.publicKeyHash!==hash(a.publicKeyPem)||
      s.keys[c.keyId]?.state!=='ACTIVE'||s.keys[c.keyId]?.publicKeyHash!==c.publicKeyHash)deny('RESERVATION_REVOKED_OR_CHANGED');
  }
  /** fsynced grow-only evidence after each known returned resource, before the next create. */
  async progress(reservation:string,plan:CreationPlan,partial:CreationPartialResult):Promise<void>{
    const p=validateCreationPlan(plan),result=copy(partial);
    await this.ledger.transaction((s,emit)=>{
      const row=Object.values(s.creations).find(c=>c.reservation===reservation);
      if(!row||row.scope!==hash(p))deny('RESERVATION_BINDING_MISMATCH');
      emit({kind:'creation-progress',id:row.id,reservation,scope:hash(p),partial:result});
    });
  }
  async unknown(reservation:string,plan:CreationPlan,partial?:CreationPartialResult):Promise<void>{
    const p=validateCreationPlan(plan);
    await this.ledger.transaction((s,emit)=>{
      const row=Object.values(s.creations).find(c=>c.reservation===reservation);
      if(!row||row.scope!==hash(p))deny('RESERVATION_BINDING_MISMATCH');
      emit({kind:'creation-unknown',id:row.id,reservation,scope:hash(p),...(partial?{partial:copy(partial)}:{})});
    });
  }
}
