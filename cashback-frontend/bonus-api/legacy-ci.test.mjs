import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {BonusService} from './server.mjs';

const sender={userId:11,username:'Sender'}, recipient={userId:22,username:'Recipient'};
function isolated(work){const service=new BonusService(':memory:');try {work(service);} finally {service.close();}}

test('legacy direct entry refuses activation without creating data',()=>{
 const before=readdirSync(new URL('.',import.meta.url));
 const result=spawnSync(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/LEGACY_BONUS_API_INACTIVE_CI_ONLY/);
 assert.deepEqual(readdirSync(new URL('.',import.meta.url)),before);
});
test('persistent database paths are refused',()=>{assert.throws(()=>new BonusService('./forbidden.sqlite'),/MEMORY_DATABASE_REQUIRED/);});
test('isolated in-memory credit and snapshot retain historical demo amounts',()=>isolated(s=>{
 s.testCredit(11,3,'credit-event-1');
 assert.equal(s.snapshot(11).summary.balance,3);
 assert.equal(s.snapshot(22).summary.balance,0);
}));
test('transfer retains expiry, isolation and idempotency',()=>isolated(s=>{
 const lot=s.testCredit(11,3,'credit-event-2');
 const result=s.transfer(sender,recipient,[lot.id],'transfer-event-1');
 assert.equal(result.length,1);assert.equal(result[0].amount,3);assert.equal(result[0].expiresAt,lot.expiresAt);
 assert.deepEqual(s.transfer(sender,recipient,[lot.id],'transfer-event-1'),result);
 assert.equal(s.snapshot(22).summary.balance,3);assert.equal(s.snapshot(11).summary.balance,0);
 assert.equal(s.snapshot(22).transfers.length,1);
 assert.throws(()=>s.transfer(sender,{userId:33,username:'Third'},[lot.id],'transfer-event-1'),/Idempotency/);
 assert.throws(()=>s.transfer(sender,recipient,[lot.id],'another-request'),/no longer available/);
}));
test('self transfer, foreign lots and duplicate credit are rejected atomically',()=>isolated(s=>{
 const lot=s.testCredit(11,3,'credit-event-3');
 assert.throws(()=>s.transfer(sender,sender,[lot.id],'self-request'),/yourself/);
 assert.throws(()=>s.transfer(recipient,sender,[lot.id],'foreign-request'),/no longer available/);
 assert.throws(()=>s.testCredit(11,3,'credit-event-3'));
 assert.equal(s.snapshot(11).summary.balance,3);assert.equal(s.snapshot(22).summary.balance,0);
}));
test('invalid amounts and identities cannot credit memory database',()=>isolated(s=>{
 for(const amount of [0,-1,Infinity,NaN,1.001,1000001])assert.throws(()=>s.testCredit(11,amount,'invalid-credit'));
 for(const id of [0,-1,1.1,'11'])assert.throws(()=>s.snapshot(id));
 assert.equal(s.snapshot(11).summary.balance,0);
}));
