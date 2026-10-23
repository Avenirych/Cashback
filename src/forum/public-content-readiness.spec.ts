import {ContentModerationService} from './content-moderation.service';
describe('public content cannot be enabled by demo or an empty moderator registry',()=>{
 const saved={...process.env};
 afterEach(()=>{for(const key of ['CASHBACK_CONTENT_MODERATION','CASHBACK_PUBLIC_CONTENT','CASHBACK_FORUM_READ_ONLY']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}});
 function fixture(eligible=true,lookupError=false){
  const query=jest.fn(async(sql:string)=>{if(sql.includes('FROM forum_moderators')){if(lookupError)throw Error('fixture database failure');return eligible?[{user_id:42}]:[];}if(sql.includes('SELECT version'))return [{version:3}];return [];});
  const transaction=jest.fn(async(work:any)=>work({query}));return {service:new ContentModerationService({transaction} as any),query};
 }
 beforeEach(()=>{process.env.CASHBACK_CONTENT_MODERATION='true';process.env.CASHBACK_PUBLIC_CONTENT='true';delete process.env.CASHBACK_FORUM_READ_ONLY;});
 test('eligible verified current-rules moderator and privacy acknowledgment permit readiness',async()=>{const {service,query}=fixture();expect(await service.configuration()).toEqual({enabled:true});expect(query).toHaveBeenCalledWith(expect.stringContaining('u.email_verified=true'),['2026-10-22-reviews-v1']);expect(query).toHaveBeenCalledWith(expect.stringContaining('privacy_acknowledged_at IS NOT NULL'),expect.anything());});
 test.each([false,true])('missing or unavailable moderator/marker cannot accept even pending posts: failure=%s',async fail=>{const {service,query}=fixture(false,fail);expect(await service.configuration()).toEqual({enabled:false});await expect(service.submit(1,'topic',{title:'Example title'})).rejects.toMatchObject({status:503});expect(query.mock.calls.some(x=>x[0].includes('INSERT'))).toBe(false);});
 test('explicit public activation is required independently of moderation flag',async()=>{delete process.env.CASHBACK_PUBLIC_CONTENT;const {service}=fixture();expect(await service.configuration()).toEqual({enabled:false});await expect(service.submit(1,'topic',{title:'Example title'})).rejects.toMatchObject({status:503});});
 test('read-only overrides all public activation flags',async()=>{process.env.CASHBACK_FORUM_READ_ONLY='true';const {service}=fixture();expect(await service.configuration()).toEqual({enabled:false});await expect(service.submit(1,'topic',{title:'Example title'})).rejects.toMatchObject({status:503});});
});
