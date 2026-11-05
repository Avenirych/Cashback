const saved={...process.env};
afterEach(()=>{process.env={...saved};jest.resetModules();});
function load(staging:string|undefined,api?:string){
 jest.resetModules();
 if(staging===undefined)delete process.env.REACT_APP_STAGING;else process.env.REACT_APP_STAGING=staging;
 if(api===undefined)delete process.env.REACT_APP_API_BASE;else process.env.REACT_APP_API_BASE=api;
 return require('./backend');
}
test('local defaults retain existing backend and legacy catalog ports',()=>{
 const m=load(undefined);expect(m.BACKEND_URL).toBe('http://localhost:3001');expect(m.LEGACY_BACKEND_URL).toBe('http://localhost:3000');
});
test('local explicit proxy remains unchanged',()=>{expect(load(undefined,'/api').BACKEND_URL).toBe('/api');});
test('staging uses same-origin API for both client families',()=>{
 const m=load('true','/api');expect(m.BACKEND_URL).toBe('/api');expect(m.LEGACY_BACKEND_URL).toBe('/api');
});
test.each([undefined,'http://localhost:3001','https://unapproved.example/api',''])('staging refuses API override %s',api=>{expect(()=>load('true',api)).toThrow('STAGING_API_CONFIGURATION_REFUSED');});
test('staging never opens local mailbox or historical bonus read exception',()=>{
 load('true','/api');
 const mail=require('./localTestMailbox');expect(mail.LOCAL_TEST_MAILBOX_URL).toBe('');
 expect(mail.localTestMailboxEnabled('development','http://127.0.0.1:3005','/api')).toBe(false);
 expect(require('./bonusReadOnly').localBonusReadOnly('http://localhost:3004')).toBe(false);
});
export {};
