import {Injectable,BadRequestException,ForbiddenException,UnauthorizedException,ServiceUnavailableException,HttpException} from '@nestjs/common';
import {DataSource,EntityManager} from 'typeorm';
import {randomUUID} from 'node:crypto';
import {ActivityService} from '../activity/activity.service';
import {returnedRows} from '../activity/activity-engine';
import {MailService} from '../mail/mail.service';
import {hashAccountPassword,verifyAccountPassword} from './account-password';
import {isSessionVersion,planSessionVersionIncrement} from './session-version';
import {assertCurrentSession} from './session-revocation.service';
import {newResetCapability,resetDigest,recoveryEmail,passwordLocale,RESET_TTL_SECONDS,PASSWORD_JOB_RETENTION_SECONDS,PASSWORD_QUEUE_CAPACITY} from './password-recovery-policy';
import type {PasswordLocale} from './password-recovery-policy';

type Actor={id:number;sv:number;account_uuid?:string};
type PasswordUser={id:number;email:string;name:string;password:string;email_verified:boolean;session_version:number;account_uuid:string|null};
type MailJob={id:string;kind:'reset_request'|'password_changed';recipient_email:string;user_id:number|null;locale:PasswordLocale;attempts:number};
const fields="u.id,u.email,u.name,u.password,u.email_verified,u.session_version,to_jsonb(u)->>'account_uuid' AS account_uuid";
const invalidLink=()=>new BadRequestException('Invalid or expired reset link');
const unavailable=()=>new ServiceUnavailableException('Password service unavailable');
@Injectable()
export class PasswordSecurityService {
 private ready=false;
 constructor(private readonly db:DataSource,private readonly activity:ActivityService,private readonly mail:MailService){}
 private checkReady(){if(!this.ready||!this.activity.enabled())throw unavailable();}
 private async tx<T>(work:(m:EntityManager)=>Promise<T>,readOnly=false):Promise<T>{
  try{return await this.db.transaction('READ COMMITTED',async m=>{
   if(readOnly)await m.query('SET TRANSACTION READ ONLY');
   await m.query("SET LOCAL statement_timeout='5s'");await m.query("SET LOCAL lock_timeout='1s'");return work(m);
  });}catch(e){if(e instanceof HttpException)throw e;throw unavailable();}
 }
 async initialize():Promise<void>{
  this.ready=false;if(!this.activity.enabled())throw unavailable();
  await this.tx(async m=>{
   const rows=await m.query('SELECT version,NOT pg_is_in_recovery() AS primary FROM public.auth_password_schema');
   if(rows.length!==1||rows[0].version!==1||rows[0].primary!==true)throw unavailable();
   await m.query('SELECT password_reset_digest,password_reset_expires_at,password_reset_session_version,session_version FROM public.users LIMIT 0');
   await m.query('SELECT id,kind,recipient_email,user_id,locale,event_version,state,attempts,available_at,expires_at,started_at FROM public.auth_password_mail_jobs LIMIT 0');
   const [p]=await m.query(`SELECT
    has_column_privilege(current_user,'public.users','password','UPDATE')
    AND has_column_privilege(current_user,'public.users','session_version','UPDATE')
    AND has_column_privilege(current_user,'public.users','password_reset_digest','UPDATE')
    AND has_column_privilege(current_user,'public.users','password_reset_expires_at','UPDATE')
    AND has_column_privilege(current_user,'public.users','password_reset_session_version','UPDATE')
    AND has_table_privilege(current_user,'public.auth_password_mail_jobs','INSERT')
    AND has_table_privilege(current_user,'public.auth_password_mail_jobs','UPDATE')
    AND has_table_privilege(current_user,'public.auth_password_mail_jobs','DELETE')
    AND has_table_privilege(current_user,'public.auth_password_mail_jobs','SELECT') AS allowed`);
   if(p?.allowed!==true)throw unavailable();
  },true);
  try{await this.mail.assertPasswordDeliveryReady();}catch{throw unavailable();}this.ready=true;
 }
 close(){this.ready=false;}
 private eligible(u:PasswordUser|undefined):u is PasswordUser{
  return !!u&&u.email_verified===true&&typeof u.password==='string'&&/^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(u.password);
 }
 private version(u:PasswordUser){if(!isSessionVersion(u.session_version))throw unavailable();return u.session_version;}
 async request(email:unknown,locale:unknown,source:string){
  this.checkReady();const address=recoveryEmail(email),language=passwordLocale(locale);
  return this.activity.passwordAttempt(address,source,'password_reset_request',async()=>{
   await this.tx(async m=>{
    // Serializes queue capacity admission equally for existing/unknown accounts.
    await m.query('SELECT pg_advisory_xact_lock(729215,0)');
    const [{n}]=await m.query("SELECT count(*)::integer AS n FROM public.auth_password_mail_jobs WHERE state IN ('pending','processing')");
    if(!Number.isInteger(n)||n>=PASSWORD_QUEUE_CAPACITY)throw unavailable();
    await m.query("INSERT INTO public.auth_password_mail_jobs(id,kind,recipient_email,locale,expires_at) VALUES($1,'reset_request',$2,$3,clock_timestamp()+$4::integer*interval '1 second')",[randomUUID(),address,language,RESET_TTL_SECONDS]);
   });
   return{message:'If this account is eligible, password recovery instructions will be sent.'};
  });
 }
 private async replacement(value:unknown,oldHash:string):Promise<string>{
  if(typeof value!=='string')throw new BadRequestException('New password required');
  const hash=await hashAccountPassword(value);
  if(await verifyAccountPassword(value,oldHash))throw new BadRequestException('Choose a different password');
  return hash;
 }
 async confirm(token:unknown,newPassword:unknown,source:string):Promise<void>{
  this.checkReady();const digest=resetDigest(token);
  await this.activity.passwordAttempt(null,source,'password_reset_confirm',async()=>{
   const rows=await this.tx(m=>m.query(`SELECT ${fields} FROM public.users u WHERE u.password_reset_digest=$1
    AND u.password_reset_expires_at>clock_timestamp() AND u.password_reset_session_version=u.session_version LIMIT 2`,[digest]),true);
   if(rows.length!==1||!this.eligible(rows[0]))throw invalidLink();
   const u=rows[0] as PasswordUser;this.version(u);
   await this.activity.passwordAttempt(u.email,null,'password_reset_confirm',async()=>{
    const hash=await this.replacement(newPassword,u.password);
    await this.replaceCredential(u,hash,passwordLocale('en'),digest);
   });
  });
 }
 async change(actor:Actor,currentPassword:unknown,newPassword:unknown,locale:unknown,source:string):Promise<void>{
  this.checkReady();
  if(!Number.isSafeInteger(actor.id)||actor.id<1||actor.id>2147483647||!isSessionVersion(actor.sv))throw new UnauthorizedException('Sign in again');
  if(typeof currentPassword!=='string'||!currentPassword)throw new BadRequestException('Current password required');
  await this.activity.passwordAttempt('user:'+actor.id,source,'password_change',async()=>{
   const rows=await this.tx(m=>m.query(`SELECT ${fields} FROM public.users u WHERE u.id=$1`,[actor.id]),true);
   if(rows.length!==1)throw new UnauthorizedException('Account unavailable');const u=rows[0] as PasswordUser;
   assertCurrentSession(actor.sv,this.version(u));
   if(actor.account_uuid!==undefined?actor.account_uuid!==u.account_uuid:u.account_uuid!==null)throw new UnauthorizedException('Account identity changed');
   if(!this.eligible(u))throw new ForbiddenException('Verified local password account required');
   if(!await verifyAccountPassword(currentPassword,u.password))throw new BadRequestException('Current password could not be confirmed');
   const hash=await this.replacement(newPassword,u.password);await this.replaceCredential(u,hash,passwordLocale(locale));
  });
 }
 private async replaceCredential(snapshot:PasswordUser,hash:string,locale:PasswordLocale,digest?:Buffer):Promise<void>{
  let next:number;try{next=planSessionVersionIncrement(snapshot.session_version).next;}catch{throw unavailable();}
  await this.tx(async m=>{
   const rows=await m.query(`SELECT ${fields} FROM public.users u WHERE u.id=$1 FOR UPDATE`,[snapshot.id]);
   if(rows.length!==1)throw digest?invalidLink():new UnauthorizedException('Account unavailable');
   const current=rows[0] as PasswordUser;this.version(current);
   if(!this.eligible(current)||current.password!==snapshot.password||current.email!==snapshot.email||current.account_uuid!==snapshot.account_uuid||current.session_version!==snapshot.session_version)
    throw digest?invalidLink():new UnauthorizedException('Sign in again');
   const params:unknown[]=[snapshot.id,hash,snapshot.password,snapshot.session_version];
   if(digest)params.push(digest);
   const changed=returnedRows(await m.query(`UPDATE public.users SET password=$2,session_version=session_version+1,
    password_reset_digest=NULL,password_reset_expires_at=NULL,password_reset_session_version=NULL
    WHERE id=$1 AND password=$3 AND session_version=$4 AND session_version<2147483647 AND email_verified=true
    ${digest?'AND password_reset_digest=$5 AND password_reset_expires_at>clock_timestamp() AND password_reset_session_version=session_version':''}
    RETURNING id,session_version`,params));
   if(changed.length!==1)throw digest?invalidLink():new UnauthorizedException('Sign in again');
   if(changed[0].id!==snapshot.id||changed[0].session_version!==next)throw unavailable();
   await m.query("INSERT INTO public.auth_password_mail_jobs(id,kind,recipient_email,user_id,locale,event_version,expires_at) VALUES($1,'password_changed',$2,$3,$4,$5,clock_timestamp()+$6::integer*interval '1 second')",[randomUUID(),current.email,current.id,locale,next,PASSWORD_JOB_RETENTION_SECONDS]);
  });
 }
 /** One claimed intent, no raw token persisted, no resend of reset capabilities. */
 async processOne():Promise<void>{
  this.checkReady();
  const job=await this.tx(async m=>{
   const rows=await m.query("SELECT id,kind,recipient_email,user_id,locale,attempts FROM public.auth_password_mail_jobs WHERE state='pending' AND available_at<=clock_timestamp() AND expires_at>clock_timestamp() AND attempts<3 ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED");
   if(!rows.length)return null;const j=rows[0] as MailJob;
   const changed=returnedRows(await m.query("UPDATE public.auth_password_mail_jobs SET state='processing',started_at=clock_timestamp(),attempts=attempts+1 WHERE id=$1 AND state='pending' RETURNING id",[j.id]));
   if(changed.length!==1)throw unavailable();return{...j,attempts:j.attempts+1};
  });
  if(!job)return;
  try{
   if(job.kind==='reset_request'){
    const capability=newResetCapability();
    const user=await this.tx(async m=>{
     const rows=await m.query(`SELECT ${fields} FROM public.users u WHERE u.email=$1 LIMIT 2 FOR UPDATE`,[job.recipient_email]);
     if(rows.length!==1||!this.eligible(rows[0]))return null;
     const u=rows[0] as PasswordUser;const sv=this.version(u);
     const saved=returnedRows(await m.query("UPDATE public.users SET password_reset_digest=$2,password_reset_expires_at=clock_timestamp()+$3::integer*interval '1 second',password_reset_session_version=$4 WHERE id=$1 AND session_version=$4 RETURNING id",[u.id,capability.digest,RESET_TTL_SECONDS,sv]));
     if(saved.length!==1)throw unavailable();return u;
    });
    if(user&&this.ready)await this.mail.sendPasswordResetEmail(user.email,capability.raw,user.name,passwordLocale(job.locale));
   }else if(this.ready){
    const rows=await this.tx(m=>m.query('SELECT name FROM public.users WHERE id=$1',[job.user_id]),true);
    await this.mail.sendPasswordChangedEmail(job.recipient_email,rows[0]?.name||'Cashback+ user',passwordLocale(job.locale));
   }
   await this.finishJob(job,true);
  }catch{await this.finishJob(job,false);}
 }
 private async finishJob(job:MailJob,success:boolean){
  await this.tx(async m=>{
   const retry=!success&&job.kind==='password_changed'&&job.attempts<3;
   await m.query("UPDATE public.auth_password_mail_jobs SET state=$2,finished_at=CASE WHEN $2='pending' THEN NULL ELSE clock_timestamp() END,started_at=NULL,available_at=clock_timestamp()+interval '5 minutes' WHERE id=$1 AND state='processing'",[job.id,success?'done':retry?'pending':'failed']);
  });
 }
 async cleanup():Promise<void>{
  this.checkReady();await this.tx(async m=>{
   await m.query("UPDATE public.users SET password_reset_digest=NULL,password_reset_expires_at=NULL,password_reset_session_version=NULL WHERE id IN (SELECT id FROM public.users WHERE password_reset_expires_at<=clock_timestamp() ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED)");
   await m.query("UPDATE public.auth_password_mail_jobs SET state=CASE WHEN kind='password_changed' AND attempts<3 AND expires_at>clock_timestamp() THEN 'pending' ELSE 'failed' END,started_at=NULL,available_at=clock_timestamp()+interval '5 minutes' WHERE id IN (SELECT id FROM public.auth_password_mail_jobs WHERE state='processing' AND started_at<clock_timestamp()-interval '2 minutes' ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED)");
   await m.query("DELETE FROM public.auth_password_mail_jobs WHERE id IN (SELECT id FROM public.auth_password_mail_jobs WHERE expires_at<=clock_timestamp() AND state<>'processing' ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED)");
  });
 }
}
