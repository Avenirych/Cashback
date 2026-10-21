'use strict';
// Opt-in service-level integration. Creates ONLY labelled disposable resources.
const fs=require('node:fs'),p=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const docker='C:/Users/serge/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const pgImage='postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df';
const run=crypto.randomUUID(),root=p.resolve('work/finance-completion-'+run),networkName='cashback-finance-service-'+run;
const password=crypto.randomBytes(32).toString('hex');let network,postgres,node;
fs.mkdirSync(root,{recursive:true});
function d(args,options={}){return cp.execFileSync(docker,['--context','desktop-linux',...args],{encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe'],...options}).trim();}
function assert(ok,message){if(!ok)throw Error(message);}
function inspect(id,kind='container'){return JSON.parse(d([kind,'inspect',id]))[0];}
function verify(id){const x=inspect(id);assert(x.Id===id&&x.Config.Labels['com.cashback.finance-service-test']===run,'Disposable ownership mismatch');assert(!x.HostConfig.PublishAllPorts&&Object.keys(x.HostConfig.PortBindings||{}).length===0,'Published test port forbidden');assert(x.Mounts.every(m=>m.Type==='tmpfs'),'Unexpected test volume');return x;}
function baseline(){const ids=d(['ps','-aq','--no-trunc']).split(/\s+/).filter(Boolean);return ids.map(id=>{const x=inspect(id);return {id,image:x.Image,startedAt:x.State.StartedAt,running:x.State.Running};});}
(async()=>{let result;try{
 assert(process.env.CASHBACK_FINANCE_SERVICE_TEST==='1','Explicit service integration opt-in required');
 assert(d(['info','--format','{{.ID}}'])==='ec3d6303-4d66-4410-8317-b739cebc046c','Unexpected daemon');
 const before=baseline(),volumes=d(['volume','ls','-q']),networks=d(['network','ls','-q','--no-trunc']);
 const release=JSON.parse(fs.readFileSync('docker/historical/SECURITY-ACTIVATION-RESULT.json'));
 assert(release.status==='SECURITY_ACTIVE','Security activation evidence required');
 const base=inspect(release.newImage,'image'),tag=base.RepoTags.find(t=>t.startsWith('cashback-historical-security:'));
 assert(tag&&inspect(tag,'image').Id===release.newImage,'Verified local test base missing');
 const context=p.join(root,'context');fs.mkdirSync(context,{recursive:true});fs.cpSync('dist/finance',p.join(context,'finance'),{recursive:true});fs.copyFileSync('docker/historical/finance-service-scenarios.cjs',p.join(context,'finance-test.cjs'));fs.copyFileSync('docker/historical/owner-policy-scenarios.cjs',p.join(context,'owner-policy-test.cjs'));fs.copyFileSync('docker/historical/policy21-scenarios.cjs',p.join(context,'policy21-test.cjs'));fs.copyFileSync('docker/historical/finance-migration-readiness.cjs',p.join(context,'migration-readiness.cjs'));
 fs.writeFileSync(p.join(context,'Dockerfile'),`FROM ${tag}\nCOPY finance /app/dist/finance\nCOPY finance-test.cjs /app/finance-test.cjs\nCOPY owner-policy-test.cjs /app/owner-policy-test.cjs\nCOPY policy21-test.cjs /app/policy21-test.cjs\nCOPY migration-readiness.cjs /app/migration-readiness.cjs\n`);
 const testTag='cashback-finance-service-test:'+run;d(['build','--network','none','--pull=false','--tag',testTag,context]);
 network=d(['network','create','--internal','--label','com.cashback.finance-service-test='+run,networkName]);const net=inspect(network,'network');assert(net.Id===network&&net.Internal===true,'Network isolation failed');
 postgres=d(['run','-d','--pull','never','--name',networkName+'-pg','--label','com.cashback.finance-service-test='+run,'--network',networkName,'--network-alias','finance-pg','--tmpfs','/var/lib/postgresql/data:rw,size=536870912','-e','POSTGRES_USER=finance_owner','-e','POSTGRES_DB=finance_completion_isolated','-e','POSTGRES_PASSWORD',pgImage],{env:{...process.env,POSTGRES_PASSWORD:password}});verify(postgres);
 let ready=false;for(let i=0;i<80;i++){try{assert(d(['exec',postgres,'cat','/proc/1/comm'])==='postgres','Initializing');d(['exec',postgres,'pg_isready','-U','finance_owner','-d','finance_completion_isolated']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
 assert(ready,'Test database did not start');
 const sql=s=>d(['exec','-i',postgres,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','finance_owner','-d','finance_completion_isolated'],{input:s});
 const cluster=sql('SELECT system_identifier FROM pg_control_system()');assert(!['7698666936429441062','7698128168850814668'].includes(cluster),'Protected cluster rejected');assert(sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'")==='0','Test schema not empty');
 node=d(['create','--name',networkName+'-node','--label','com.cashback.finance-service-test='+run,'--network',networkName,'--cap-drop','ALL','--security-opt','no-new-privileges:true','--env','PGPASSWORD','--env','PGHOST=finance-pg','--env','CASHBACK_FINANCE_ISOLATED_TEST=1','--env','CASHBACK_FINANCE_MIGRATION_READINESS=1','--entrypoint','node',testTag,'/app/finance-test.cjs'],{env:{...process.env,PGPASSWORD:password}});verify(node);
 let stdout;try{stdout=d(['start','--attach',node]);}catch(e){fs.writeFileSync(p.join(root,'service-failure.log'),String(e.stderr||e.stdout||e.message).replaceAll(password,'[REDACTED]'));throw Error('Service scenario failed; see isolated service-failure.log');}
 fs.writeFileSync(p.join(root,'service-output.log'),stdout+'\n');assert(inspect(node).State.ExitCode===0,'Service scenario process failed');
 result=JSON.parse(stdout.split(/\r?\n/).filter(Boolean).at(-1));result.cluster=cluster;result.testDatabase='finance_completion_isolated';result.archive=root;
 for(const previous of before){const x=inspect(previous.id);assert(x.Image===previous.image&&x.State.StartedAt===previous.startedAt&&x.State.Running===previous.running,'Protected process identity changed');}
 assert(volumes===d(['volume','ls','-q']),'Persistent volume inventory changed');result.protectedContainerIdentitiesPreserved=true;result.originalNetworks=networks;
 }catch(e){result={status:'FINANCE_SERVICE_POSTGRES_BLOCKED',reason:e.message.split('\n')[0],archive:root};process.exitCode=1;}
 finally{try{for(const id of [node,postgres].filter(Boolean)){verify(id);d(['rm','-f',id]);}if(network){const x=inspect(network,'network');assert(x.Id===network&&x.Labels['com.cashback.finance-service-test']===run&&Object.keys(x.Containers||{}).length===0,'Test network cleanup ownership failed');d(['network','rm',network]);}result.cleanup='exact owned test containers/network removed; no volumes created';}catch{result.cleanup='BLOCKED_MANUAL_REVIEW';process.exitCode=1;}fs.writeFileSync(p.join(root,'result.json'),JSON.stringify(result,null,2));fs.writeFileSync('docker/historical/FINANCE-SERVICE-TEST-RESULT.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
})();
