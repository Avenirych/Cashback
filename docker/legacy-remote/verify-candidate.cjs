'use strict';
// Read-only source guard. No network, Docker, application startup or database access.
const fs=require('node:fs'),cp=require('node:child_process'),p=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=p.resolve(__dirname,'../..'),canonical='fb2cfee91e1d7cb113d301c69e48c9613e100e6c';
const git=args=>cp.execFileSync('git',args,{cwd:root,windowsHide:true,maxBuffer:32*1024*1024});
const read=file=>fs.readFileSync(p.join(root,file),'utf8');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const paths=git(['ls-tree','-r','--name-only',canonical]).toString().trim().split('\n');
const unchanged=paths.filter(file=>file.startsWith('src/finance/')||
 /docker\/historical\/(?:FINANCIAL-POLICY-|financial-policy-|owner-policy-scenarios|policy21-scenarios|FINANCE-PREPRODUCTION-SOURCE-MANIFEST|finance-completion-source-manifest|financial-lifecycle-source-manifest)/.test(file)||
 ['src/app.module.ts','src/auth/auth.service.ts','src/auth/auth.controller.ts','src/users/users.service.ts','src/users/user.entity.ts',
 'cashback-frontend/src/pages/Register.tsx','cashback-frontend/src/pages/Profile.tsx','cashback-frontend/src/context/AuthContext.tsx',
 'cashback-frontend/src/bonusApi.ts','cashback-frontend/src/components/MarketingPreferencesPanel.tsx',
 'package.json','package-lock.json','cashback-frontend/package.json','cashback-frontend/package-lock.json','compose.yaml'].includes(file)||
 (file.startsWith('src/')&&file.endsWith('.spec.ts')));
for(const file of unchanged){const a=git(['show',canonical+':'+file]),b=fs.readFileSync(p.join(root,file));assert.equal(a.toString().replace(/\r\n/g,'\n'),b.toString().replace(/\r\n/g,'\n'),'Unapproved canonical change: '+file);}
const manifest=JSON.parse(read('docker/legacy-remote/activation-manifest.json'));
assert.equal(manifest.approvedRemote,'d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f');
assert.equal(manifest.deferredPhoneFeature,true);assert.deepEqual(manifest.activeApplicationMigrationList,[]);
assert.equal(manifest.synchronize,false);assert.equal(manifest.automaticMigrations,false);assert.equal(manifest.activeFinanceModule,false);
for(const entry of manifest.archives){const bytes=fs.readFileSync(p.join(root,entry.archive));assert.equal(sha(bytes),entry.sha256);assert.equal(sha(git(['show',manifest.approvedRemote+':'+entry.originalPath])),entry.sha256);assert.equal(entry.activationAllowed,false);assert(entry.archive.endsWith('.source.txt'));if(!entry.activeSourceRetained)assert(!fs.existsSync(p.join(root,entry.originalPath)),entry.originalPath+' must remain deferred');}
assert.equal(manifest.archives.length,54);
const allSrc=[];function walk(dir){for(const entry of fs.readdirSync(p.join(root,dir),{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())walk(file);else if(entry.isFile())allSrc.push(file);}}walk('src');
assert(!allSrc.some(f=>/1792195200000|cli-data-source|cli\.datasource/.test(f)));
assert(!read('src/app.module.ts').includes('FinanceModule'));
assert(!read('src/users/user.entity.ts').includes('phone_verified'));
assert(!read('src/users/users.controller.ts').includes("Patch('phone')"));
const config=read('src/local-configuration.ts');assert(config.includes('synchronize:false'));assert(config.includes('migrationsRun:false'));
const bonuses=read('cashback-frontend/src/bonusApi.ts');assert(bonuses.includes('BACKEND_URL'));assert(!bonuses.includes('3002'));
assert.equal(manifest.legacyBonusApi,'CI_ONLY_MEMORY_DATABASE_NO_LISTENER');
const legacy=read('cashback-frontend/bonus-api/server.mjs');assert(legacy.includes('LEGACY_BONUS_API_INACTIVE_CI_ONLY'));assert(legacy.includes('LEGACY_CI_MEMORY_DATABASE_REQUIRED'));assert(!/legacyHttpReferenceNotActivated\(\);/.test(legacy));
const pages=JSON.parse(read('cashback-frontend/public/search-index.json'));
assert.equal(pages.length,15);for(const route of ['/privacy','/faq','/cookies'])assert(pages.some(page=>page.path===route&&page.text.length>50));
assert(!pages.some(page=>/profile|auth\/|token|dashboard/.test(page.path)));
const index=git(['ls-files','-z']).toString().split('\0').filter(Boolean);
const sqlite=index.filter(file=>/\.(?:sqlite|db)(?:-(?:wal|shm))?$/.test(file));
if(sqlite.length&&!process.argv.includes('--before-stage'))throw Error('SQLite payload remains in index');
const result={status:'CANDIDATE_SOURCE_GUARD_PASS',canonicalUnchangedFiles:unchanged.length,financeSourceFiles:unchanged.filter(f=>f.startsWith('src/finance/')).length,canonicalBackendTestsPreserved:unchanged.filter(f=>f.startsWith('src/')&&f.endsWith('.spec.ts')).length,remoteArchivesVerified:54,publicSearchPages:pages.length,deferredPhoneExcluded:true,legacyInactive:true,sqliteIndexPayloads:sqlite.length,activeDatabaseAccessed:false};
console.log(JSON.stringify(result,null,2));
