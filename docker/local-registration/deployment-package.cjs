'use strict';
// Bare commands remain offline. Explicit protected-config composition below uses the
// existing control-plane; CLI flags never substitute for signed creation authority.
const fs = require('node:fs');
const path = require('node:path');
function report(operation, args = []) {
  const permitted = ['preflight','first-start','post-start','reconcile'];
  if (!permitted.includes(operation) || args.length) return {status:'BLOCKED',reason:'UNSUPPORTED_ARGUMENT_OR_CLI_APPROVAL'};
  const draft = JSON.parse(fs.readFileSync(path.join(__dirname,'phase-policy.draft.json'),'utf8'));
  // This package deliberately cannot convert a draft into an approved runtime policy.
  // Execution requires independently deployed authority and a creation action contract.
  return {status:operation==='preflight'?'DRY_RUN':'BLOCKED',operation,execution:'BLOCKED',
    statusContract:{DRY_RUN:'offline, no resource changes',BLOCKED:'prerequisites or authority absent',
      READY_FOR_APPROVAL:'complete reviewed package, no execution permission',
      EXECUTION_AUTHORIZED:'protected composition and independent scoped signed approval required'},
    reason:'CREATION_AUTHORITY_NOT_PROVISIONED',policyStatus:draft.status,
    lifecycle:['CREATION_AUTHORIZED','CREATED_UNVERIFIED','IDENTITY_ATTESTED','SERVICE_ADMITTED'],
    unresolved:['APPROVED_PHASE_POLICY','HELPER_IMAGE_DIGESTS','HELPER_FULL_IDENTITIES',
      'CONTROL_NETWORK_ID_AND_HASH','COMPOSE_AND_MOUNT_FINGERPRINTS','INDEPENDENT_CREATION_APPROVAL',
      'EXTERNAL_FENCING_PROVIDER','ED25519_AND_MTLS_ANCHORS','PROTECTED_RUNTIME_CREDENTIALS'],
    next:'STOP_NO_RESOURCE_MUTATION',creationGate:false,applyEligible:false};
}
async function main(operation,args=process.argv.slice(2)) {
  let result;
  try {
    if(args.length&&['first-start','post-start','reconcile'].includes(operation)){
      require('ts-node').register({transpileOnly:true,project:path.resolve(__dirname,'../../tsconfig.json')});
      result=await require('./creation-control-plane').executeCreationControlPlane(operation,args,path.resolve(__dirname,'../..'));
    }else result=report(operation,args);
  }catch(error){
    const reason=error&&typeof error.reason==='string'&&/^[A-Z_]+$/.test(error.reason)?error.reason:'PROTECTED_CREATION_PREREQUISITE_UNAVAILABLE';
    result={status:'BLOCKED',reason,SERVICE_ADMITTED:false,APPLY_ELIGIBLE:false,PHONE_APPLY_CONCURRENCY_VERIFIED:false,next:'STOP_NO_AUTOMATIC_RETRY_OR_RECOVERY'};
  }
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(!['DRY_RUN','CREATED_UNVERIFIED','SERVICE_ADMITTED'].includes(result.status)) process.exitCode=1;
}
module.exports={report,main};
