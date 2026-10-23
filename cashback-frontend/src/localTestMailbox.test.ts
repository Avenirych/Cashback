import {localTestMailboxEnabled} from './localTestMailbox';
const prior=process.env.REACT_APP_LOCAL_DEMO_REVIEWS;
afterEach(()=>{if(prior===undefined)delete process.env.REACT_APP_LOCAL_DEMO_REVIEWS;else process.env.REACT_APP_LOCAL_DEMO_REVIEWS=prior;});
test('ordinary production builds do not expose local mailbox',()=>{delete process.env.REACT_APP_LOCAL_DEMO_REVIEWS;expect(localTestMailboxEnabled('production','http://localhost:3004','http://127.0.0.1:3006')).toBe(false);});
test('explicit local demo build permits Mailpit only at the exact site and API',()=>{process.env.REACT_APP_LOCAL_DEMO_REVIEWS='true';expect(localTestMailboxEnabled('production','http://localhost:3004','http://127.0.0.1:3006')).toBe(true);expect(localTestMailboxEnabled('production','https://example.com','http://127.0.0.1:3006')).toBe(false);expect(localTestMailboxEnabled('production','http://localhost:3004','https://api.example.com')).toBe(false);});
