import {ContentModerationService} from './content-moderation.service';
import {verifyFunctionalStaging} from '../staging-functional';
const original={...process.env};
beforeEach(async()=>{process.env.CASHBACK_BACKEND_PROFILE='staging';process.env.CASHBACK_STAGING_WORKFLOWS='synthetic-v1';process.env.CASHBACK_CONTENT_MODERATION='true';await verifyFunctionalStaging({query:async()=>[{schema_ok:true,financial_closed:true,appointment_closed:true}]},true)});
afterEach(async()=>{process.env={...original};await verifyFunctionalStaging({query:async()=>[]},false)});
function fixture({email='fixture@example.invalid',verified=true,member=true,banned=false,accepted=true,moderator=false,ready=true,blocked=false}={}){
 const query=jest.fn(async(sql:string)=>{
 if(sql==='SET TRANSACTION READ ONLY')return [];
 if(sql.includes('SELECT version FROM forum_moderation_schema'))return [{version:3}];
 if(sql.startsWith('SELECT id,email,email_verified'))return [{id:7,email,email_verified:verified}];
 if(sql.includes('JOIN users u ON u.id=fm.user_id'))return ready?[{user_id:1}]:[];
 if(sql.startsWith('SELECT banned,agreed_to_rules'))return member?[{banned,agreed_to_rules:accepted,rules_version:'2026-10-22-reviews-v1'}]:[];
 if(sql.startsWith('SELECT confirmed_at'))return blocked?Array.from({length:8},()=>({confirmed_at:new Date().toISOString()})):[];
 if(sql.startsWith('SELECT user_id FROM forum_moderators'))return moderator?[{user_id:7}]:[];
 throw Error('Unexpected read');});
 return {query,service:new ContentModerationService({transaction:async(fn:any)=>fn({query})} as any)};
}
test('ordinary synthetic member gets writes but no moderation; read-only transaction',async()=>{const {service,query}=fixture();expect(await service.stagingAccess(7)).toEqual({profile:'synthetic-v1',userId:7,permissions:{forumRegistration:true,publication:true,moderation:false}});expect(query).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');expect(query.mock.calls.every(([s])=>!/^INSERT|^UPDATE|^DELETE|^GRANT|^ALTER/.test(s))).toBe(true)});
test('only DB-appointed eligible moderator gets moderation capability',async()=>{expect((await fixture({moderator:true}).service.stagingAccess(7)).permissions.moderation).toBe(true)});
test('new verified synthetic user may register but cannot publish/moderate',async()=>{expect((await fixture({member:false}).service.stagingAccess(7)).permissions).toEqual({forumRegistration:true,publication:false,moderation:false})});
test.each([{email:'real@example.com'},{verified:false}])('deny real or unverified account %j',async opts=>{await expect(fixture(opts).service.stagingAccess(7)).rejects.toThrow('Verified synthetic account required')});
test.each([{banned:true},{accepted:false}])('ineligible membership never grants publication or moderation %j',async opts=>{const p=(await fixture({...opts,moderator:true}).service.stagingAccess(7)).permissions;expect(p.publication).toBe(false);expect(p.moderation).toBe(false)});
test('missing publication readiness fails closed',async()=>{await expect(fixture({ready:false}).service.stagingAccess(7)).rejects.toThrow('eligible moderator')});
test.each(['production','development'])('never issues capability in %s',async p=>{process.env.CASHBACK_BACKEND_PROFILE=p;await expect(fixture().service.stagingAccess(7)).rejects.toThrow('unavailable')});
test('unverified DB capability never issues access',async()=>{await verifyFunctionalStaging({query:async()=>[]},false);await expect(fixture().service.stagingAccess(7)).rejects.toThrow('unavailable')});
