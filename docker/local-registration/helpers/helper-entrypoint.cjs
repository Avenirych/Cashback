'use strict';
// Creation/identity attestation is not authorization to execute a migration.
// The only migration implementation remains src/docker-phone-migration-runner.ts.
// Import is inert. Explicit invocation loads existing compiled production transport.
function main(args) {
  const role = args.length === 1 && ['migration-executor', 'observer'].includes(args[0]) ? args[0] : null;
  return {
    status: 'BLOCKED',
    reason: role ? 'HELPER_RUNTIME_CONFIGURATION_REQUIRED' : 'HELPER_INVOCATION_INVALID',
    role,
    creationDoesNotAuthorizeExecution: true,
    SERVICE_ADMITTED: false,
    APPLY_ELIGIBLE: false,
    PHONE_APPLY_CONCURRENCY_VERIFIED: false,
  };
}
if (require.main === module) {
  const result=main(process.argv.slice(2));
  if(!result.role){process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=1;}
  else {
    const controller=new AbortController();
    process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());
    Promise.resolve().then(()=>require('../dist/docker-phone-helper-runtime').runHelperProcess(result.role,controller.signal))
      .catch(()=>{process.stdout.write(JSON.stringify({...result,reason:'HELPER_EXECUTION_BLOCKED_OR_UNKNOWN'})+'\n');process.exitCode=1;});
  }
}
module.exports = {main};
