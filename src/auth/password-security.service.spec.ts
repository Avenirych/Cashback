import {BadRequestException,HttpException} from '@nestjs/common';
import {PasswordSecurityService} from './password-security.service';
import {newResetCapability,passwordQuotas,resetDigest} from './password-recovery-policy';
import {compareSessionVersion,MAX_SESSION_VERSION} from './session-version';
import {hashAccountPassword,verifyAccountPassword} from './account-password';
jest.mock('./account-password',()=>({hashAccountPassword:jest.fn(),verifyAccountPassword:jest.fn()}));
// In-memory contract model only: never imports an app module, opens a socket or SQL connection.
function fixture(){
 const capability=newResetCapability();
 let user:any={id:9,email:'synthetic@example.invalid',name:'Synthetic',password:'$2b$10$'+'A'.repeat(53),email_verified:true,session_version:0,account_uuid:null};
 let slot:Buffer|null=capability.digest,expired=false,fail=false,failIntent=false,intents=0,queued=0,mailFailed=false;
 let chain:Promise<unknown>=Promise.resolve();
 const manager={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('SET '))return [];
  if(sql.includes('FROM public.auth_password_schema'))return [{version:1,primary:true}];
  if(sql.includes('LIMIT 0'))return [];
  if(sql.includes('AS allowed'))return [{allowed:true}];
  if(sql.includes('pg_advisory_xact_lock'))return [];
  if(sql.includes('count(*)'))return [{n:queued}];
  if(sql.startsWith('SELECT')&&sql.includes('FROM public.users u')){
   if(sql.includes('password_reset_digest=$1'))return !expired&&slot?.equals(args[0])?[{...user}]:[];
   return [{...user}];
  }
  if(sql.startsWith('UPDATE public.users SET password=$2')){
   if(fail)throw Error('synthetic database failure');
   if(user.session_version!==args[3]||user.password!==args[2]||user.session_version===MAX_SESSION_VERSION)return [[],0];
   if(args.length===5&&(expired||!slot?.equals(args[4])))return [[],0];
   user={...user,password:args[1],session_version:user.session_version+1};slot=null;
   return [[{id:user.id,session_version:user.session_version}],1];
  }
  if(sql.startsWith('INSERT INTO public.auth_password_mail_jobs')){if(sql.includes("'password_changed'")){if(failIntent)throw Error('synthetic intent failure');intents++;}else queued++;return [];}
  if(sql.startsWith('SELECT id,kind'))return mailFailed?[]:[{id:'synthetic-intent',kind:'password_changed',recipient_email:user.email,user_id:user.id,locale:'en',attempts:0}];
  if(sql.startsWith("UPDATE public.auth_password_mail_jobs SET state='processing'"))return [[{id:'synthetic-intent'}],1];
  if(sql.startsWith('SELECT name'))return [{name:user.name}];
  if(sql.startsWith('UPDATE public.auth_password_mail_jobs SET state=$2')){mailFailed=true;return [];}
  throw Error('Unexpected contract query');
 }};
 const db={transaction:(_level:any,work:any)=>{
  const run=chain.then(async()=>{const saved={user:{...user},slot,intents,queued};try{return await work(manager);}catch(e){user=saved.user;slot=saved.slot;intents=saved.intents;queued=saved.queued;throw e;}});
  chain=run.catch(()=>undefined);return run;
 }};
 const activity={enabled:()=>true,passwordAttempt:jest.fn(async(_i:any,_s:any,_a:any,work:any)=>work())};
 const mail={assertPasswordDeliveryReady:async()=>{},sendPasswordChangedEmail:async()=>{throw Error('synthetic SMTP failure');}};
 const service=new PasswordSecurityService(db as any,activity as any,mail as any);
 return {service,activity,token:()=>capability.raw,version:()=>user.session_version,intents:()=>intents,queued:()=>queued,verified:()=>user.email_verified,expire:()=>{expired=true;},dbFail:()=>{fail=true;},intentFail:()=>{failIntent=true;},overflow:()=>{user.session_version=MAX_SESSION_VERSION;}};
}
beforeEach(()=>{jest.resetAllMocks();(hashAccountPassword as jest.Mock).mockResolvedValue('$2b$10$'+'B'.repeat(53));(verifyAccountPassword as jest.Mock).mockImplementation(async(v:string)=>v==='current-valid');});
describe('password credential transactional contract (mock database)',()=>{
 test('known and unknown addresses have the same accepted response and queue path',async()=>{const f=fixture();await f.service.initialize();const a=await f.service.request('synthetic@example.invalid','en','fixture');const b=await f.service.request('unknown@example.invalid','en','fixture');expect(a).toEqual(b);expect(f.queued()).toBe(2);expect(f.intents()).toBe(0);});
 test('valid capability changes password, increments sv and creates one intent',async()=>{const f=fixture();await f.service.initialize();await f.service.confirm(f.token(),'Replacement!123','fixture');expect(f.version()).toBe(1);expect(f.intents()).toBe(1);expect(f.verified()).toBe(true);});
 test('expired capability changes nothing',async()=>{const f=fixture();await f.service.initialize();f.expire();await expect(f.service.confirm(f.token(),'Replacement!123','fixture')).rejects.toBeInstanceOf(BadRequestException);expect(f.version()).toBe(0);expect(f.intents()).toBe(0);});
 test('replay is rejected',async()=>{const f=fixture();await f.service.initialize();await f.service.confirm(f.token(),'Replacement!123','fixture');await expect(f.service.confirm(f.token(),'Replacement!123','fixture')).rejects.toBeInstanceOf(BadRequestException);expect(f.intents()).toBe(1);});
 test('simulated concurrent confirmations allow one commit (not a real SQL concurrency proof)',async()=>{const f=fixture();await f.service.initialize();const result=await Promise.allSettled([f.service.confirm(f.token(),'Replacement!123','fixture'),f.service.confirm(f.token(),'Replacement!123','fixture')]);expect(result.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(f.version()).toBe(1);expect(f.intents()).toBe(1);});
 test('wrong current password cannot change credentials',async()=>{const f=fixture();await f.service.initialize();await expect(f.service.change({id:9,sv:0},'wrong','Replacement!123','en','fixture')).rejects.toBeInstanceOf(BadRequestException);expect(f.version()).toBe(0);});
 test('database error returns failure without a version increment',async()=>{const f=fixture();await f.service.initialize();f.dbFail();await expect(f.service.change({id:9,sv:0},'current-valid','Replacement!123','en','fixture')).rejects.toMatchObject({status:503});expect(f.version()).toBe(0);expect(f.intents()).toBe(0);});
 test('notification-intent insert failure rolls back password and sv',async()=>{const f=fixture();await f.service.initialize();f.intentFail();await expect(f.service.confirm(f.token(),'Replacement!123','fixture')).rejects.toMatchObject({status:503});expect(f.version()).toBe(0);expect(f.intents()).toBe(0);});
 test('malformed token is rejected without credential changes',async()=>{const f=fixture();await f.service.initialize();await expect(f.service.confirm(undefined,'Replacement!123','fixture')).rejects.toBeInstanceOf(BadRequestException);expect(f.version()).toBe(0);});
 test('uninitialized service fails closed without queue admission',async()=>{const f=fixture();await expect(f.service.request('unknown@example.invalid','en','fixture')).rejects.toMatchObject({status:503});expect(f.queued()).toBe(0);});
 test('SMTP failure after commit cannot roll back or repeat credential update',async()=>{const f=fixture();await f.service.initialize();await f.service.change({id:9,sv:0},'current-valid','Replacement!123','de','fixture');await f.service.processOne();expect(f.version()).toBe(1);expect(f.intents()).toBe(1);});
 test('old JWT version becomes invalid after password change',async()=>{const f=fixture();await f.service.initialize();await f.service.change({id:9,sv:0},'current-valid','Replacement!123','fr','fixture');expect(compareSessionVersion(0,f.version()).valid).toBe(false);expect(compareSessionVersion(undefined,f.version()).valid).toBe(false);});
 test('overflow fails closed',async()=>{const f=fixture();await f.service.initialize();f.overflow();await expect(f.service.change({id:9,sv:MAX_SESSION_VERSION},'current-valid','Replacement!123','en','fixture')).rejects.toMatchObject({status:503});expect(f.intents()).toBe(0);});
 test('rate refusal stops queue admission',async()=>{const f=fixture();await f.service.initialize();f.activity.passwordAttempt.mockRejectedValueOnce(new HttpException('limited',429));await expect(f.service.request('unknown@example.invalid','en','fixture')).rejects.toMatchObject({status:429});expect(f.queued()).toBe(0);});
 test('purpose digest is not the raw capability',()=>{const c=newResetCapability();expect(c.digest.length).toBe(32);expect(resetDigest(c.raw).equals(c.digest)).toBe(true);expect(c.digest.equals(Buffer.from(c.raw,'hex'))).toBe(false);});
 test('fixed policy requires account and source limits',()=>{expect(passwordQuotas('password_reset_request','account').map(q=>q.maximum)).toEqual([1,3]);expect(passwordQuotas('password_change','account')[0].maximum).toBe(5);expect(passwordQuotas('password_reset_confirm','source')[0].maximum).toBe(20);});
});
