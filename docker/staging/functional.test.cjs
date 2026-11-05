'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),yaml=require('js-yaml');
const {validate}=require('./validate.cjs');
const base=yaml.load(fs.readFileSync(path.join(__dirname,'../compose.staging.yaml'),'utf8'));
test('functional overlay retains every original config safety assertion',()=>{const c=structuredClone(base);c.services.backend.environment.CASHBACK_STAGING_WORKFLOWS='synthetic-v1';a.equal(validate(c),true);});
for(const mode of ['true','production','unsafe'])test('unknown functional mode '+mode,()=>{const c=structuredClone(base);c.services.backend.environment.CASHBACK_STAGING_WORKFLOWS=mode;a.throws(()=>validate(c));});
test('cannot use functional flag to enable financial writes',()=>{const c=structuredClone(base);Object.assign(c.services.backend.environment,{CASHBACK_STAGING_WORKFLOWS:'synthetic-v1',CASHBACK_FINANCIAL_WRITES:'true'});a.throws(()=>validate(c));});
test('synthetic extension has target guard, no financial grants, no historical inclusion',()=>{const s=fs.readFileSync(path.join(__dirname,'sql/50-functional.sql'),'utf8');for(const x of ["current_database()='cashback_staging_app'",':{?expected_system_identifier}','7698666936429441062','pg_advisory_xact_lock','MODERATION_AUDIT_IMMUTABLE'])a.ok(s.includes(x));a.doesNotMatch(s.replace(/^--.*$/gm,''),/GRANT[^;]*(?:bonus_items|bonus_transfers|WITH GRANT OPTION|SUPERUSER)|SECURITY DEFINER|\\ir/i);});
test('runtime cannot appoint itself',()=>{const s=fs.readFileSync(path.join(__dirname,'sql/50-functional.sql'),'utf8');a.match(s,/GRANT SELECT ON[^;]*forum_moderators,forum_owner_bootstrap/);a.doesNotMatch(s.replace(/^--.*$/gm,''),/GRANT (?:INSERT|UPDATE|ALL)[^;]*(?:forum_moderators|forum_owner_bootstrap)/);});

test('SQL refusals use ON_ERROR_STOP failure, never quit-with-ignored-exit-argument',()=>{for(const n of ['50-functional.sql','60-synthetic-moderator.sql']){const s=fs.readFileSync(path.join(__dirname,'sql',n),'utf8');a.match(s,/ON_ERROR_STOP on/);a.match(s,/SELECT 1\/0 AS staging_guard_refused/);a.doesNotMatch(s,/\\quit/);}});
