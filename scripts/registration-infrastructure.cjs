'use strict';
// Import is inert. Explicit serve composes real existing adapters; never starts SQL on import.
const fs = require('node:fs/promises');
const path = require('node:path');
async function main(args) {
  require('ts-node').register({transpileOnly:true,project:path.resolve(__dirname,'../tsconfig.json')});
  if (args[0] === 'validate' && args.length === 2) {
    const {inspectInfrastructureDraft} = require('../src/docker-phone-infrastructure-config');
    const draft = JSON.parse(await fs.readFile(path.resolve(args[1]),'utf8'));
    const result = inspectInfrastructureDraft(draft);
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    return; // VALID source, BLOCKED execution are intentionally separate.
  }
  if (args[0] === 'serve-authority' && args.length === 2) {
    // Future explicitly authorised deployment ONLY; never called by validate/unit tests.
    const {startRegistrationAuthority} = require('../src/docker-phone-infrastructure-service');
    const config = JSON.parse(await fs.readFile(path.resolve(args[1]),'utf8'));
    let helperBoundary;
    if(config.helperProductionConfigurationFile){
      const {loadProductionMigrationConfiguration}=require('../src/docker-phone-production-configuration');
      const {productionHelperTaskBoundary}=require('../src/docker-phone-helper-runtime');
      helperBoundary=productionHelperTaskBoundary(await loadProductionMigrationConfiguration(config.helperProductionConfigurationFile,path.resolve(__dirname,'..')));
    }
    await startRegistrationAuthority(config,path.resolve(__dirname,'..'),helperBoundary);
    return;
  }
  if(args[0] === 'inspect-ledger' && args.length === 2){
    const {RegistrationInfrastructureLedger}=require('../src/docker-phone-infrastructure-ledger');
    const state=await new RegistrationInfrastructureLedger(path.resolve(args[1])).inspect();
    process.stdout.write(JSON.stringify({epoch:state.epoch,pendingReviews:Object.entries(state.commits).filter(([,c])=>c.outcome==='PENDING').map(([id])=>id),
      sessions:Object.keys(state.sessions).length,approvals:Object.keys(state.approvals).length,usedReceipts:Object.keys(state.spent).length,
      helperTasks:Object.values(state.helperTasks).map(t=>({id:t.task.id,status:t.status,runId:t.runId??null,resultSha256:t.resultSha256??null,result:t.result??null,confirmedOutcome:t.confirmedOutcome??null})),
      recovery:'READ_ONLY_REPORT_ONLY_NO_UNLOCK_OR_RETRY'},null,2)+'\n');
    return;
  }
  throw new Error('Unsupported operation');
}
if(require.main===module)main(process.argv.slice(2)).catch(()=>{process.stderr.write('REGISTRATION_INFRASTRUCTURE:BLOCKED\n');process.exitCode=1;});
module.exports={main};
