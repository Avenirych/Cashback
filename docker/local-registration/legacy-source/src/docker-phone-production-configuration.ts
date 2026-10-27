import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { win32 as path } from 'node:path';
import { createHash, createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto';
import { adapterDeny, AccessAdapterBlocked } from './docker-phone-adapter-common';
import { REGISTRATION_PHONE_EXPECTED as E, registrationSecurityDigest as digest } from './docker-phone-registration-target';
import type { RegistrationNetworkApproval } from './docker-phone-registration-target';
import { mtlsApprovalTransport, SignedApprovalReader } from './docker-phone-approved-evidence';
import type { ApprovalPurpose, ApprovalTrustAnchor, ApprovalTransport } from './docker-phone-approved-evidence';

const ROOT='C:\\approved-registration-infrastructure';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
function freeze<T>(value:T):T {if(value&&typeof value==='object'){for(const part of Object.values(value))freeze(part);Object.freeze(value);}return value;}
export interface ProductionApprovalEndpoint {
  anchor:ApprovalTrustAnchor;
  mtls:{certificateFile:string;privateKeyFile:string;caFile:string;serverCertificateSha256:string};
}
/** This is deployment configuration, not an approval writer or evidence payload. */
export interface ProductionMigrationDeployment {
  format:'registration-migration-production/v1';status:'APPROVED';target:typeof E;
  readerSid:string;dockerCli:string;topology:RegistrationNetworkApproval;
  observerPasswordFile:string;
  authorities:{fingerprints:ProductionApprovalEndpoint;receipts:ProductionApprovalEndpoint;enrollment:ProductionApprovalEndpoint};
  /** Provider must ACTUALLY enforce the boundary. This endpoint only verifies its independent evidence. */
  externalFencing:ProductionApprovalEndpoint|null;
}
export interface LoadedProductionMigrationConfiguration {readonly kind:'protected-registration-migration-configuration'}
interface Components {
  topology:RegistrationNetworkApproval;dockerCli:string;
  authorities:ProductionMigrationDeployment['authorities'];externalFencing:ProductionApprovalEndpoint|null;
  transport(purpose:ApprovalPurpose):ApprovalTransport;
  observerPassword(signal:AbortSignal):Promise<string>;assertUnchanged():Promise<void>;
}
const configurations=new WeakMap<object,Components>();
function inside(file:string,root=ROOT):boolean {
  if(typeof file!=='string'||!path.isAbsolute(file)||file.includes('\0'))return false;
  const relative=path.relative(root,path.resolve(file));return !!relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);
}
function exactKeys(o:any,keys:string[]):boolean{return !!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===keys.sort().join(',');}
export function validateProductionMigrationDeployment(c:ProductionMigrationDeployment,repository:string):void {
  if(!exactKeys(c,['format','status','target','readerSid','dockerCli','topology','observerPasswordFile','authorities','externalFencing'])||
    c.format!=='registration-migration-production/v1'||c.status!=='APPROVED'||digest(c.target)!==digest(E))adapterDeny('PRODUCTION_CONFIGURATION_NOT_APPROVED');
  if(!/^S-1-5-(21-(\d+-){2}\d+-\d+|80-(\d+-){4}\d+)$/.test(c.readerSid))adapterDeny('DEDICATED_READER_IDENTITY_REQUIRED');
  if(!/^[A-Za-z]:[\\/]/.test(c.dockerCli)||path.basename(c.dockerCli).toLowerCase()!=='docker.exe'||/[\r\n\0]/.test(c.dockerCli))adapterDeny('EXPLICIT_DOCKER_CLI_REQUIRED');
  const t=c.topology;
  if(!t||!['baseline','phone'].includes(t.phase)||!Array.isArray(t.peers)||t.peers.length!==2||
    t.peers.map(p=>p.service).sort().join(',')!=='migration-executor,observer'||!t.controlNetwork||
    t.controlNetwork.name!==E.project+'-authority'||!/^[a-f0-9]{64}$/.test(t.controlNetwork.id)||!/^[a-f0-9]{64}$/.test(t.controlNetwork.configurationSha256)||
    t.peers.some(p=>p.id===E.containerId||!/^[a-f0-9]{64}$/.test(p.id)||!p.name.startsWith(E.project+'-')||!/^.+@sha256:[a-f0-9]{64}$/.test(p.image)||
      !/^[a-f0-9]{64}$/.test(p.configurationSha256))||new Set(t.peers.map(p=>p.id)).size!==2)adapterDeny('ATTESTED_SERVICE_TOPOLOGY_REQUIRED');
  if(!exactKeys(c.authorities,['fingerprints','receipts','enrollment']))adapterDeny('APPROVAL_AUTHORITIES_REQUIRED');
  const all:[ApprovalPurpose,ProductionApprovalEndpoint][]=[...Object.entries(c.authorities) as [ApprovalPurpose,ProductionApprovalEndpoint][],
    ...(c.externalFencing?[['fencing',c.externalFencing] as [ApprovalPurpose,ProductionApprovalEndpoint]]:[])];
  const publicKeys:string[]=[],issuers:string[]=[],origins:string[]=[];
  const files=[c.observerPasswordFile];
  for(const [purpose,v] of all){
    if(!exactKeys(v,['anchor','mtls'])||!exactKeys(v.anchor,['issuer','keyId','publicKeyPem','endpoint','audience','purpose'])||
      !exactKeys(v.mtls,['certificateFile','privateKeyFile','caFile','serverCertificateSha256']))adapterDeny('INVALID_PRODUCTION_AUTHORITY');
    const a=v.anchor;let u:URL;
    try{u=new URL(a.endpoint);const key=createPublicKey(a.publicKeyPem);if(key.asymmetricKeyType!=='ed25519')throw Error();
      publicKeys.push(createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex'));
    }catch{adapterDeny('INVALID_TRUST_ANCHOR');}
    if(a.purpose!==purpose||a.audience!=='cashback-registration-migration'||!a.issuer||!a.keyId||u!.protocol!=='https:'||
      u!.pathname!=='/approvals'||u!.username||u!.password||u!.search||u!.hash||!/^[a-f0-9]{64}$/.test(v.mtls.serverCertificateSha256))adapterDeny('INVALID_TRUST_ANCHOR');
    if(new Set([v.mtls.certificateFile,v.mtls.privateKeyFile,v.mtls.caFile].map(f=>path.resolve(f).toLowerCase())).size!==3)adapterDeny('SEPARATE_CREDENTIAL_FILES_REQUIRED');
    if(purpose!=='fencing'&&Number(u!.port||443)!==({fingerprints:8443,receipts:8444,enrollment:8445} as const)[purpose])adapterDeny('AUTHORITY_ENDPOINT_MISMATCH');
    issuers.push(a.issuer);origins.push(u!.origin);files.push(v.mtls.certificateFile,v.mtls.privateKeyFile,v.mtls.caFile);
  }
  if([publicKeys,issuers,origins].some(v=>new Set(v).size!==v.length))adapterDeny('INDEPENDENT_AUTHORITIES_REQUIRED');
  for(const f of files)if(!inside(f)||inside(f,repository))adapterDeny('PROTECTED_EXTERNAL_PATH_REQUIRED');
  if(files.slice(1).some(f=>path.resolve(f).toLowerCase()===path.resolve(c.observerPasswordFile).toLowerCase()))adapterDeny('SEPARATE_CREDENTIAL_FILES_REQUIRED');
}

async function verifyAcl(files:string[],readerSid?:string,extraSids:readonly string[]=[],allowDedicatedTraversal=true):Promise<void>{
  if(process.platform!=='win32')adapterDeny('WINDOWS_PROTECTED_STORAGE_REQUIRED');
  // Fixed read-only PowerShell; the path is an environment value, never executable source.
  const script="$ErrorActionPreference='Stop';$v=@(foreach($f in ($env:CASHBACK_PROTECTED_FILES|ConvertFrom-Json)){$a=Get-Acl -LiteralPath $f;$o=$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value;$r=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])|ForEach-Object{@{sid=$_.IdentityReference.Value;type=$_.AccessControlType.ToString();rights=[int64]$_.FileSystemRights}});@{owner=$o;current=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value;rules=$r}});ConvertTo-Json -InputObject $v -Depth 4 -Compress";
  const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]!]]));
  env.CASHBACK_PROTECTED_FILES=JSON.stringify(files);
  let value:any;
  try{value=JSON.parse(await new Promise<string>((ok,fail)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],
    {env,shell:false,windowsHide:true,timeout:1500,maxBuffer:131072},(error,stdout)=>error?fail(error):ok(stdout))));}
  catch{adapterDeny('PROTECTED_STORAGE_ACL_UNAVAILABLE');}
  if(!Array.isArray(value)||value.length!==files.length)adapterDeny('PROTECTED_STORAGE_ACL_UNSAFE');
  for(let i=0;i<value.length;i++){
    const entry=value[i],allowed=['S-1-5-18',entry.current,...(readerSid?[readerSid]:[]),...extraSids];
    const traversalOnly=(r:any)=>allowDedicatedTraversal&&i<value.length-1&&/^S-1-5-(21-(\d+-){2}\d+-\d+|80-(\d+-){4}\d+)$/.test(r.sid)&&
      Number.isSafeInteger(r.rights)&&!(r.rights&(2|4|16|64|256|65536|262144|524288));
    if((readerSid&&entry.current!==readerSid)||!allowed.includes(entry.owner)||!Array.isArray(entry.rules)||!entry.rules.length||
      entry.rules.some((r:any)=>r.type==='Allow'&&!allowed.includes(r.sid)&&!traversalOnly(r))||
      !entry.rules.some((r:any)=>r.type==='Allow'&&r.sid===entry.current))adapterDeny('PROTECTED_STORAGE_ACL_UNSAFE');
  }
}
async function protectedText(file:string,readerSid?:string,extraSids:readonly string[]=[],sizeLimit=131072,protectedRoot=ROOT):Promise<string>{
  if(!inside(file,protectedRoot))adapterDeny('PROTECTED_EXTERNAL_PATH_REQUIRED');
  const parentPaths=[protectedRoot];let current=path.dirname(file);
  while(current.toLowerCase()!==protectedRoot.toLowerCase()){if(!inside(current,protectedRoot))adapterDeny('PROTECTED_EXTERNAL_PATH_REQUIRED');parentPaths.push(current);current=path.dirname(current);}
  for(const p of [...parentPaths,file]){const s=await lstat(p);if(s.isSymbolicLink()||(!s.isDirectory()&&p!==file))adapterDeny('PROTECTED_STORAGE_LINK_FORBIDDEN');}
  await verifyAcl([...parentPaths,file],readerSid,extraSids,protectedRoot===ROOT);
  const s=await lstat(file);if(!s.isFile()||s.nlink!==1||s.size>sizeLimit||path.resolve(await realpath(file)).toLowerCase()!==path.resolve(file).toLowerCase())adapterDeny('PROTECTED_FILE_UNSAFE');
  return readFile(file,'utf8');
}
/** Explicit trusted startup only. Does not create credentials, start services, or contact Docker/SQL/authorities. */
export async function loadProductionMigrationConfiguration(file:string,repository:string):Promise<LoadedProductionMigrationConfiguration>{
  try{
    const text=await protectedText(file),c=JSON.parse(text) as ProductionMigrationDeployment;
    validateProductionMigrationDeployment(c,repository);
    freeze(c);
    const original=new Map<string,string>([[file,sha(text)]]);
    const read=async(f:string)=>{const value=await protectedText(f,c.readerSid),previous=original.get(f);if(previous&&previous!==sha(value))adapterDeny('PRODUCTION_CONFIGURATION_CHANGED');original.set(f,sha(value));return value;};
    const endpoints=[...Object.values(c.authorities),...(c.externalFencing?[c.externalFencing]:[])];
    const credentialValues=async(v:ProductionApprovalEndpoint)=>{
      const [certificate,privateKey,ca]=await Promise.all([v.mtls.certificateFile,v.mtls.privateKeyFile,v.mtls.caFile].map(read));
      const cert=new X509Certificate(certificate),key=createPrivateKey(privateKey),issuer=new X509Certificate(ca);
      if(!cert.checkPrivateKey(key)||!issuer.ca||Date.parse(cert.validTo)<=Date.now()||Date.parse(cert.validFrom)>Date.now())adapterDeny('MTLS_CREDENTIALS_UNAVAILABLE');
      return {certificate,privateKey,ca,serverCertificateSha256:v.mtls.serverCertificateSha256};
    };
    const password=await read(c.observerPasswordFile);if(!password||password.length>4096||/[\r\n\0]/.test(password))adapterDeny('OBSERVER_CREDENTIAL_MISSING');
    for(const v of endpoints)await credentialValues(v);
    const guard=async()=>{if(sha(await protectedText(file))!==original.get(file))adapterDeny('PRODUCTION_CONFIGURATION_CHANGED');};
    const token=Object.freeze({kind:'protected-registration-migration-configuration' as const});
    configurations.set(token,freeze({topology:c.topology,dockerCli:c.dockerCli,authorities:c.authorities,externalFencing:c.externalFencing,
      transport:purpose=>{
        const v=purpose==='fencing'?c.externalFencing:c.authorities[purpose];if(!v)adapterDeny('EXCLUSIVITY_NOT_ENFORCED');
        return mtlsApprovalTransport(v.anchor.endpoint,async()=>{await guard();return credentialValues(v);});
      },observerPassword:async (signal:AbortSignal)=>{if(signal.aborted)adapterDeny('ABORTED');await guard();return read(c.observerPasswordFile);},assertUnchanged:guard}));
    return token;
  }catch(e){if(e instanceof AccessAdapterBlocked)throw e;adapterDeny('PRODUCTION_CONFIGURATION_UNAVAILABLE');}
}
/** Opaque capability; plain JSON and CLI flags cannot install production credentials. */
export function productionMigrationComponents(c:LoadedProductionMigrationConfiguration):Components {
  const value=configurations.get(c);if(!value)adapterDeny('PROTECTED_PRODUCTION_CONFIGURATION_REQUIRED');return value;
}
export async function configuredMigrationCreationPrerequisites(c:LoadedProductionMigrationConfiguration):Promise<void>{
  const value=productionMigrationComponents(c);await value.assertUnchanged();
  if(!value.externalFencing)adapterDeny('EXCLUSIVITY_NOT_ENFORCED');
  // Presence is not exclusivity proof: creation/control-plane must read and bind the provider's signed live evidence.
}
/** Fixed existing owner policy, read-only with the SAME NTFS/ancestry protections.
 * No phase approval, policy replacement or permission broadening is performed. */
export async function readApprovedRegistrationOwnerPolicy():Promise<unknown>{
  try{return JSON.parse(await protectedText('C:\\approved-registration\\owner-policy.approved.json',undefined,[],131072,'C:\\approved-registration'));}
  catch(e){if(e instanceof AccessAdapterBlocked)throw e;adapterDeny('OWNER_POLICY_UNAVAILABLE');}
}

export interface CreationProductionDeployment {
  format:'registration-creation-production/v1';status:'APPROVED';target:typeof E;readerSid:string;
  observerPasswordFile:string;migratorPasswordFile:string;
  enrollment:ProductionApprovalEndpoint;externalFencing:ProductionApprovalEndpoint|null;
  ledgerAccessSids?:string[];
}
export interface LoadedCreationProductionPrerequisites {readonly kind:'protected-registration-creation-prerequisites'}
interface CreationComponents {
  enrollment:{anchor:ApprovalTrustAnchor;transport:ApprovalTransport};
  fencing:SignedApprovalReader|null;assertCredentials():Promise<void>;
  assertLedger():Promise<void>;
  assertOwnerPolicy():Promise<void>;readOwnerPolicy():Promise<unknown>;
}
const creationConfigurations=new WeakMap<object,CreationComponents>();
/** Creation credentials precede Docker identities. They do not attest peers or open migration gates. */
export async function loadCreationProductionPrerequisites(file:string,repository:string):Promise<LoadedCreationProductionPrerequisites>{
  try{
    const initial=await protectedText(file),c=JSON.parse(initial) as CreationProductionDeployment;
    if(!exactKeys(c,['format','status','target','readerSid','observerPasswordFile','migratorPasswordFile','enrollment','externalFencing',...('ledgerAccessSids'in c?['ledgerAccessSids']:[])])||
      c.format!=='registration-creation-production/v1'||c.status!=='APPROVED'||digest(c.target)!==digest(E))adapterDeny('CREATION_CONFIGURATION_NOT_APPROVED');
    if(!/^S-1-5-(21-(\d+-){2}\d+-\d+|80-(\d+-){4}\d+)$/.test(c.readerSid))adapterDeny('DEDICATED_READER_IDENTITY_REQUIRED');
    const endpoints:[ApprovalPurpose,ProductionApprovalEndpoint][]=[['enrollment',c.enrollment],...(c.externalFencing?[['fencing',c.externalFencing] as [ApprovalPurpose,ProductionApprovalEndpoint]]:[])];
    const keys:string[]=[],issuers:string[]=[],origins:string[]=[],credentialFiles=[c.observerPasswordFile,c.migratorPasswordFile];
    for(const [purpose,v] of endpoints){
      if(!exactKeys(v,['anchor','mtls'])||!exactKeys(v.anchor,['issuer','keyId','publicKeyPem','endpoint','audience','purpose'])||
        !exactKeys(v.mtls,['certificateFile','privateKeyFile','caFile','serverCertificateSha256']))adapterDeny('INVALID_PRODUCTION_AUTHORITY');
      const a=v.anchor,u=new URL(a.endpoint),key=createPublicKey(a.publicKeyPem);
      if(a.purpose!==purpose||a.audience!=='cashback-registration-migration'||!a.issuer||!a.keyId||key.asymmetricKeyType!=='ed25519'||
        u.protocol!=='https:'||u.pathname!=='/approvals'||u.username||u.password||u.search||u.hash||
        (purpose==='enrollment'&&Number(u.port||443)!==8445)||!/^[a-f0-9]{64}$/.test(v.mtls.serverCertificateSha256))adapterDeny('INVALID_TRUST_ANCHOR');
      if(new Set([v.mtls.certificateFile,v.mtls.privateKeyFile,v.mtls.caFile].map(f=>path.resolve(f).toLowerCase())).size!==3)adapterDeny('SEPARATE_CREDENTIAL_FILES_REQUIRED');
      keys.push(createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex'));issuers.push(a.issuer);origins.push(u.origin);
      credentialFiles.push(v.mtls.certificateFile,v.mtls.privateKeyFile,v.mtls.caFile);
    }
    if([keys,issuers,origins].some(v=>new Set(v).size!==v.length))adapterDeny('INDEPENDENT_AUTHORITIES_REQUIRED');
    if(credentialFiles.some(f=>!inside(f)||inside(f,repository)))adapterDeny('PROTECTED_EXTERNAL_PATH_REQUIRED');
    if(path.resolve(c.observerPasswordFile).toLowerCase()===path.resolve(c.migratorPasswordFile).toLowerCase()||
      credentialFiles.slice(2).some(f=>[c.observerPasswordFile,c.migratorPasswordFile].some(p=>path.resolve(p).toLowerCase()===path.resolve(f).toLowerCase())))adapterDeny('SEPARATE_CREDENTIAL_FILES_REQUIRED');
    if(c.ledgerAccessSids&&(!Array.isArray(c.ledgerAccessSids)||c.ledgerAccessSids.length!==3||new Set(c.ledgerAccessSids).size!==3||
      c.ledgerAccessSids.some(s=>!/^S-1-5-(21-(\d+-){2}\d+-\d+|80-(\d+-){4}\d+)$/.test(s))))adapterDeny('LEDGER_ACL_APPROVAL_REQUIRED');
    freeze(c);
    const hashes=new Map<string,string>([[file,sha(initial)]]);
    const read=async(f:string)=>{const value=await protectedText(f,c.readerSid),previous=hashes.get(f);if(previous&&previous!==sha(value))adapterDeny('PRODUCTION_CONFIGURATION_CHANGED');hashes.set(f,sha(value));return value;};
    const mtls=async(v:ProductionApprovalEndpoint)=>{
      const [certificate,privateKey,ca]=await Promise.all([v.mtls.certificateFile,v.mtls.privateKeyFile,v.mtls.caFile].map(read));
      const cert=new X509Certificate(certificate),key=createPrivateKey(privateKey),issuer=new X509Certificate(ca);
      if(!cert.checkPrivateKey(key)||!issuer.ca||Date.parse(cert.validTo)<=Date.now()||Date.parse(cert.validFrom)>Date.now())adapterDeny('MTLS_CREDENTIALS_UNAVAILABLE');
      return {certificate,privateKey,ca,serverCertificateSha256:v.mtls.serverCertificateSha256};
    };
    const assertCredentials=async()=>{
      await read(file);
      for(const f of [c.observerPasswordFile,c.migratorPasswordFile]){const password=await read(f);if(!password||password.length>4096||/[\r\n\0]/.test(password))adapterDeny('REGISTRATION_CREDENTIAL_MISSING');}
      for(const [,v] of endpoints)await mtls(v);
      if(!c.externalFencing)adapterDeny('EXCLUSIVITY_NOT_ENFORCED');
    };
    await assertCredentials();
    const transport=(v:ProductionApprovalEndpoint)=>mtlsApprovalTransport(v.anchor.endpoint,async()=>{await read(file);return mtls(v);});
    const assertLedger=async()=>{
      await read(file);if(!c.ledgerAccessSids)adapterDeny('LEDGER_ACL_APPROVAL_REQUIRED');
      await protectedText(path.join(ROOT,'ledger','events.jsonl'),c.readerSid,c.ledgerAccessSids,16*1024*1024);
      try{await lstat(path.join(ROOT,'ledger','writer.lock'));adapterDeny('CREATION_LEDGER_LOCKED_RECOVERY_REQUIRED');}
      catch(e){if(e instanceof AccessAdapterBlocked)throw e;if(!e||typeof e!=='object'||!('code'in e)||e.code!=='ENOENT')adapterDeny('CREATION_LEDGER_UNAVAILABLE');}
    };
    const readOwnerPolicy=async():Promise<unknown>=>{
      try{
        await read(file);
        return readApprovedRegistrationOwnerPolicy();
      }catch(e){if(e instanceof AccessAdapterBlocked)throw e;adapterDeny('OWNER_POLICY_UNAVAILABLE');}
    };
    const token=Object.freeze({kind:'protected-registration-creation-prerequisites' as const});
    creationConfigurations.set(token,Object.freeze({enrollment:Object.freeze({anchor:c.enrollment.anchor,transport:transport(c.enrollment)}),
      fencing:c.externalFencing?new SignedApprovalReader('fencing',c.externalFencing.anchor,transport(c.externalFencing)):null,
      assertCredentials,assertLedger,readOwnerPolicy,assertOwnerPolicy:async()=>{await readOwnerPolicy();}}));
    return token;
  }catch(e){if(e instanceof AccessAdapterBlocked)throw e;adapterDeny('PRODUCTION_CONFIGURATION_UNAVAILABLE');}
}
export function creationProductionComponents(c:LoadedCreationProductionPrerequisites):CreationComponents {
  const value=creationConfigurations.get(c);if(!value)adapterDeny('PROTECTED_CREATION_CONFIGURATION_REQUIRED');return value;
}
