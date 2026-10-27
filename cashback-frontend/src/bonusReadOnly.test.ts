import {localBonusReadOnly,canReadBonusSnapshot,assertBonusSnapshotReadAllowed} from './bonusReadOnly';
const keys=['REACT_APP_BONUS_READ_ONLY','REACT_APP_DEMO_ONLY','REACT_APP_REGISTRATION_ISOLATED','REACT_APP_API_BASE','NODE_ENV'];
const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
beforeEach(()=>Object.assign(process.env,{NODE_ENV:'development',REACT_APP_BONUS_READ_ONLY:'true',REACT_APP_DEMO_ONLY:'true',REACT_APP_REGISTRATION_ISOLATED:'true',REACT_APP_API_BASE:'/api'}));
afterAll(()=>keys.forEach(k=>{if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}));
test.each(['http://127.0.0.1:3005/dashboard','http://localhost:3005/profile'])('explicit local historical read opt-in: %s',url=>expect(localBonusReadOnly(url)).toBe(true));
test.each(['http://127.0.0.1:3004/dashboard','https://127.0.0.1:3005','http://example.test:3005','invalid'])('other origins fail closed: %s',url=>expect(localBonusReadOnly(url)).toBe(false));
test.each([['NODE_ENV','production'],['REACT_APP_BONUS_READ_ONLY','false'],['REACT_APP_BONUS_READ_ONLY','typo'],['REACT_APP_DEMO_ONLY','false'],['REACT_APP_REGISTRATION_ISOLATED','typo'],['REACT_APP_API_BASE','https://example.test']])('%s=%s never opens isolated snapshot',(k,v)=>{process.env[k]=v;expect(localBonusReadOnly('http://127.0.0.1:3005')).toBe(false);});
test('ordinary nonisolated behavior remains compatible, isolated unknown environment remains blocked',()=>{process.env.REACT_APP_REGISTRATION_ISOLATED='false';expect(canReadBonusSnapshot()).toBe(true);process.env.REACT_APP_REGISTRATION_ISOLATED='true';expect(canReadBonusSnapshot()).toBe(false);expect(()=>assertBonusSnapshotReadAllowed()).toThrow();});

test('production-build local frontend 3004 can read the reviewed historical backend without opening writes',()=>{
 Object.assign(process.env,{NODE_ENV:'production'});process.env.REACT_APP_API_BASE='http://127.0.0.1:3006';
 expect(localBonusReadOnly('http://localhost:3004/dashboard')).toBe(true);
 const {assertBonusNetworkAllowed}=require('./registrationIsolation');
 expect(()=>assertBonusNetworkAllowed()).toThrow();
});
test.each(['https://localhost:3004/dashboard','http://127.0.0.1:3004/dashboard','http://example.test:3004/dashboard','http://localhost:3005/dashboard'])('local production-build exception never follows other origins: %s',href=>{
 Object.assign(process.env,{NODE_ENV:'production'});process.env.REACT_APP_API_BASE='http://127.0.0.1:3006';expect(localBonusReadOnly(href)).toBe(false);
});
test.each(['http://localhost:3006','http://127.0.0.1:3006/','https://example.test/api','/api'])('production read rejects a different API target: %s',api=>{
 Object.assign(process.env,{NODE_ENV:'production'});process.env.REACT_APP_API_BASE=api;expect(localBonusReadOnly('http://localhost:3004/dashboard')).toBe(false);
});
