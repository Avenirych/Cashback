'use strict';
const path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..');const frontend=process.argv[2]==='frontend';
process.chdir(frontend?path.join(root,'cashback-frontend'):root);process.env.NODE_ENV='test';process.env.CI='true';
const req=createRequire(path.join(process.cwd(),'package.json'));require('./offline-guard.cjs');
let config,tests;
if(frontend){
 const execa=req('execa');execa.sync=(command,args)=>{if(command==='node'&&args?.[0]==='--eval'&&args[1]==='import("node:fs").then(() => console.log(true), () => console.log(false));')return {stdout:'true'};throw new Error('HISTORICAL_OFFLINE_PROCESS_FORBIDDEN');};
 config=req('react-scripts/scripts/utils/createJestConfig')(p=>req.resolve('react-scripts/'+p),process.cwd(),false);config.rootDir=process.cwd();config.setupFiles=[...(config.setupFiles||[]),path.join(__dirname,'offline-guard.cjs')];
 tests=['src/components/MarketingPreferencesPanel.test.tsx','src/components/WiseAccountNotice.test.tsx','src/components/ExtendedRegistration.test.tsx','src/pages/BonusAds.test.tsx','src/components/SiteSearch.test.tsx','src/pages/FooterLinks.test.tsx','src/context/AuthContext.test.tsx','src/pages/Forum.test.tsx','src/backend.config.test.ts','src/pages/EmailFlow.test.tsx','src/pages/DemoBonus.test.tsx'];
}else{config={rootDir:root,testEnvironment:'node',setupFiles:[path.join(__dirname,'offline-guard.cjs')],transform:{'^.+\\.tsx?$':[req.resolve('ts-jest'),{tsconfig:path.join(root,'tsconfig.json')}]}};tests=['src/marketing-preferences/marketing-offline.spec.ts','src/auth/extended-registration.spec.ts','src/local-configuration.spec.ts','src/local-schema.spec.ts','src/local-forum.spec.ts','src/local-preflight.spec.ts','src/auth/email-flow.spec.ts','src/local-forum-bonus-plan.spec.ts','src/forum/forum-user.service.spec.ts','src/forum/forum.service.spec.ts','src/bonus/demo-bonus.spec.ts','src/bonus/bonus.controller.spec.ts','src/bonus/bonus.service.spec.ts'];}
req('jest').runCLI({config:JSON.stringify(config),runInBand:true,runTestsByPath:true,watch:false,_:tests,$0:'jest'},[process.cwd()]).then(r=>{console.log(JSON.stringify({success:r.results.success,tests:r.results.numTotalTests,failed:r.results.numFailedTests}));process.exitCode=r.results.success?0:1;}).catch(()=>{console.error('HISTORICAL_OFFLINE_TEST_RUNNER_FAILED');process.exitCode=1;});
