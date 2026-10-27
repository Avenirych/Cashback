import {localTestMailboxEnabled} from './localTestMailbox';
const prior=process.env.REACT_APP_LOCAL_DEMO_REVIEWS;
afterEach(()=>{if(prior===undefined)delete process.env.REACT_APP_LOCAL_DEMO_REVIEWS;else process.env.REACT_APP_LOCAL_DEMO_REVIEWS=prior;});
test.each(['http://127.0.0.1:3005','http://localhost:3005'])('development preview %s uses the local proxy',origin=>{
 expect(localTestMailboxEnabled('development',origin,'/api')).toBe(true);
 expect(localTestMailboxEnabled('development',origin,'https://api.example.com')).toBe(false);
});
test('production never enables Mailpit, including the legacy local-demo flag',()=>{
 process.env.REACT_APP_LOCAL_DEMO_REVIEWS='true';
 for(const origin of ['http://localhost:3004','http://127.0.0.1:3005','https://example.com'])
 for(const api of ['/api','http://127.0.0.1:3006'])
 expect(localTestMailboxEnabled('production',origin,api)).toBe(false);
});
test('other hosts, ports and modes fail closed',()=>{
 expect(localTestMailboxEnabled('development','https://example.com','/api')).toBe(false);
 expect(localTestMailboxEnabled('development','http://127.0.0.1:3007','/api')).toBe(false);
 expect(localTestMailboxEnabled('test','http://127.0.0.1:3005','/api')).toBe(false);
 expect(localTestMailboxEnabled('development','http://localhost:3004','http://127.0.0.1:3006')).toBe(true);
});
