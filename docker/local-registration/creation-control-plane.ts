import {readFile,lstat,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {RegistrationInfrastructureLedger} from './legacy-source/src/docker-phone-infrastructure-ledger';
import {LedgerDockerCreation,validateCreationPlan} from './legacy-source/src/docker-phone-creation-contract';
import type {CreationFence,CreationPlan} from './legacy-source/src/docker-phone-creation-contract';
import {loadCreationProductionPrerequisites,creationProductionComponents,loadProductionMigrationConfiguration,productionMigrationComponents} from './legacy-source/src/docker-phone-production-configuration';
import {installProductionMigrationConfiguration} from './legacy-source/src/docker-phone-access-sources';
import {registrationSecurityDigest as hash,REGISTRATION_PHONE_EXPECTED as E} from './legacy-source/src/docker-phone-registration-target';
import {firstStartHelpers,helperDockerTransport,productionHelperCreationIO,inspectHelperCreation,verifyRunningCreationPlan,HelperCreationBlocked} from './helper-creation';
import {collectRegistrationServicePhase,productionCollectorIO} from './collector';
import type {ExistingPostgresPolicy} from './existing-postgres-baseline';

const LEDGER='C:\\approved-registration-infrastructure\\ledger';
const closed={SERVICE_ADMITTED:false,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED:false} as const;
function stop(reason:string):never{throw new HelperCreationBlocked(reason);}
async function json(file:string):Promise<any>{
  const p=resolve(file),s=await lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>1048576||await realpath(p)!==p)stop('UNSAFE_INPUT_FILE');
  return JSON.parse(await readFile(p,'utf8'));
}
/** Verifies the independent provider's signed LIVE creation lease. This is a reader,
 * never an implementation of host fencing or an assertion that all admins are excluded. */
export function creationFenceFromProvider(reader:ReturnType<typeof creationProductionComponents>['fencing']):CreationFence {
  return {held:async plan=>{
    if(!reader)stop('EXTERNAL_FENCING_PROVIDER_MISSING');
    const v=await reader.readPayload(hash(plan),AbortSignal.timeout(1500));
    if(!v||Array.isArray(v)||v.scope!=='registration-helper-creation'||v.provider!==plan.fencing.provider||
      v.fencingEpoch!==plan.fencing.epoch||v.bindingSha256!==plan.fencing.bindingSha256||hash(v.identity)!==hash(plan.identity)||
      v.exclusive!==true||v.continuous!==true||v.uncontrolledEntrypoints!==0||v.competingControllers!==0||
      v.observedAt>Date.now()||Date.now()-v.observedAt>4000||v.expiresAt<=Date.now())stop('EXTERNAL_FENCING_NOT_HELD');
    return true;
  }};
}
/** Existing First-Start's explicit trusted composition. No automatic startup on import.
 * Merely passing a config/plan path conveys no permission: enrollment signature,
 * protected credentials, enforced fencing and a durable reservation are all required. */
export async function executeCreationControlPlane(operation:string,args:readonly string[],root=resolve(__dirname,'../..')){
  if(operation==='first-start'&&args.length===4&&args[0]==='--creation-config'&&args[2]==='--plan'){
    const cap=await loadCreationProductionPrerequisites(args[1],root),c=creationProductionComponents(cap);
    await c.assertCredentials();await c.assertLedger();
    const plan=validateCreationPlan(await json(args[3]),Date.now()) as CreationPlan;
    const policy=await c.readOwnerPolicy() as ExistingPostgresPolicy;
    const executable=join(process.env.LOCALAPPDATA??'', 'Programs','DockerDesktop','resources','bin','docker.exe');
    if(!process.env.LOCALAPPDATA)stop('EXPLICIT_DOCKER_CLI_REQUIRED');
    const docker=helperDockerTransport(root,executable),fence=creationFenceFromProvider(c.fencing),ledger=new RegistrationInfrastructureLedger(LEDGER);
    const journal=new LedgerDockerCreation(ledger,c.enrollment.anchor,fence);
    const io=productionHelperCreationIO(root,docker,policy,async()=>{await c.assertCredentials();},fence,async(p,challenge)=>{
      if(!c.enrollment.transport.creation)stop('CREATION_AUTHORITY_NOT_PROVISIONED');
      return JSON.parse(await c.enrollment.transport.creation(hash(p),challenge,AbortSignal.timeout(1500)));
    });
    return firstStartHelpers(plan,journal,io);
  }
  if(operation==='reconcile'&&args.length===2&&args[0]==='--creation-config'){
    const c=creationProductionComponents(await loadCreationProductionPrerequisites(args[1],root));await c.assertLedger();
    // No writer, SQL, lock removal, adoption, retry, or alleged recovery.
    return inspectHelperCreation(new RegistrationInfrastructureLedger(LEDGER));
  }
  if(operation==='post-start'&&args.length===6&&args[0]==='--creation-config'&&args[2]==='--production-config'&&args[4]==='--creation-id'){
    const creation=creationProductionComponents(await loadCreationProductionPrerequisites(args[1],root));await creation.assertLedger();await creation.assertCredentials();
    const cap=await loadProductionMigrationConfiguration(args[3],root),c=productionMigrationComponents(cap);
    const ledger=new RegistrationInfrastructureLedger(LEDGER),state=await ledger.inspect(),row=state.creations[args[5]];
    if(!row||row.stage!=='IDENTITY_ATTESTED'||!row.attestation||!row.identities||row.attestation.expiresAt<=Date.now())stop('INDEPENDENT_IDENTITY_ATTESTATION_REQUIRED');
    const policy=await creation.readOwnerPolicy() as ExistingPostgresPolicy,p=policy.servicePhase;
    const approvedAuthority=row.network??row.plan.helpers[0].networks.find(n=>n.name===E.project+'-authority');
    if(!p||hash(p.peers)!==hash(c.topology.peers)||hash(p.controlNetwork)!==hash(c.topology.controlNetwork)||p.phase!==row.plan.phase||
      p.file!=='docker/local-registration/helpers/compose.helpers.json'||p.templateSha256!==row.plan.templateSha256||p.effectiveSha256!==row.plan.effectiveComposeSha256||
      hash(p.controlNetwork)!==hash(approvedAuthority)||hash(policy.existingPostgresBaseline)!==row.plan.postgresBaselineSha256||
      hash(p.peers.map(({service,id})=>({service,id})).sort((a,b)=>a.service.localeCompare(b.service)))!==hash([...row.identities].sort((a,b)=>a.service.localeCompare(b.service)))||
      p.peers.some(peer=>{const desired=row.plan.helpers.find(h=>h.service===peer.service);return desired?.name!==peer.name||desired.image!==peer.image||row.attestation!.identities.find(a=>a.service===peer.service)?.observedConfigurationSha256!==peer.configurationSha256;}))stop('APPROVED_PHASE_POLICY_REQUIRED');
    const fence=creationFenceFromProvider(creation.fencing);if(!await fence.held(row.plan))stop('EXTERNAL_FENCING_NOT_HELD');
    // This is the actual independent read-only collector, never a caller-supplied PASS/hash.
    const proof=await collectRegistrationServicePhase(root,policy,'post-start',productionCollectorIO(root,c.dockerCli));
    await verifyRunningCreationPlan(row.plan,policy,helperDockerTransport(root,c.dockerCli));
    await c.assertUnchanged();await creation.assertCredentials();
    if(hash(await creation.readOwnerPolicy())!==hash(policy))stop('APPROVED_POLICY_CHANGED');
    if(!await fence.held(row.plan))stop('FENCING_LOST');
    await ledger.transaction((s,emit)=>{
      const current=s.creations[row.id];if(!current||current.scope!==row.scope||current.reservation!==row.reservation||hash(current.identities)!==hash(row.identities))stop('CREATION_CHANGED');
      emit({kind:'creation-admitted',id:row.id,reservation:row.reservation!,scope:row.scope,evidenceHash:hash(proof),at:Date.now()});
    });
    installProductionMigrationConfiguration(cap);
    return {status:'SERVICE_ADMITTED',SERVICE_ADMITTED:true,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED:false};
  }
  return {status:'BLOCKED',reason:'UNSUPPORTED_ARGUMENT_OR_CLI_APPROVAL',...closed};
}
