import type {Request,Response,NextFunction} from 'express';
/** Capability is issued only after the real initialized connection passes identity/schema/privilege checks. */
let verified = false;
export function functionalStagingActive() { return verified && process.env.CASHBACK_BACKEND_PROFILE==='staging' && process.env.CASHBACK_STAGING_WORKFLOWS==='synthetic-v1'; }
export function functionalStagingRequested(env:NodeJS.ProcessEnv=process.env) {
 const mode=env.CASHBACK_STAGING_WORKFLOWS;
 if(mode===undefined||mode==='disabled')return false;
 if(mode!=='synthetic-v1'||env.CASHBACK_BACKEND_PROFILE!=='staging'||env.DB_NAME!=='cashback_staging_app'||env.DB_USER!=='cashback_staging_runtime'||env.SMTP_HOST!=='mail'||env.SMTP_PORT!=='587'||env.SMTP_SECURE!=='false'||env.SMTP_FROM!=='noreply@example.invalid')throw Error('STAGING_WORKFLOW_CONFIG_REFUSED');
 return true;
}
export async function verifyFunctionalStaging(source:{query:(sql:string)=>Promise<any[]>}, requested:boolean) {
 verified=false;
 if(!requested)return;
 const [r]=await source.query(`SELECT (SELECT version FROM public.forum_moderation_schema)=3 AND (SELECT version FROM public.staging_functional_schema)=1 AS schema_ok,
 NOT has_table_privilege(current_user,'public.bonus_items','INSERT') AND NOT has_table_privilege(current_user,'public.bonus_items','UPDATE') AND NOT has_table_privilege(current_user,'public.bonus_transfers','INSERT') AND NOT has_column_privilege(current_user,'public.users','balance','UPDATE') AS financial_closed,
 NOT has_table_privilege(current_user,'public.forum_moderators','INSERT') AND NOT has_table_privilege(current_user,'public.forum_moderators','UPDATE') AND NOT has_table_privilege(current_user,'public.forum_moderators','DELETE') AND NOT has_table_privilege(current_user,'public.forum_owner_bootstrap','UPDATE') AS appointment_closed`);
 if(!r||r.schema_ok!==true||r.financial_closed!==true||r.appointment_closed!==true)throw Error('STAGING_WORKFLOW_PRIVILEGES_REFUSED');
 verified=true;
}
export const syntheticEmail=(email:unknown)=>typeof email==='string'&&/^[A-Za-z0-9._+%-]+@example[.]invalid$/i.test(email.trim());
export const functionalWrites = [
 ['POST','^/auth/(register|login|resend-verification)$'],
 ['POST','^/forum/(register|rules/accept|topic|post|reviews)$'],
 ['POST','^/forum/moderation/[1-9][0-9]*/(report|appeal|decision|resolve-appeal|revoke)$'],
] as const;
export function functionalWriteAllowed(method:string,path:string){return functionalWrites.some(([m,p])=>method.toUpperCase()===m&&new RegExp(p).test(path));}
export function functionalStagingBarrier(req:Request,res:Response,next:NextFunction){
 if(!functionalStagingActive())return next();
 const method=req.method.toUpperCase(),path=req.path.toLowerCase().replace(/\/+$/,'')||'/';
 if(['GET','HEAD','OPTIONS'].includes(method)||functionalWriteAllowed(method,path))return next();
 res.status(403).json({code:'STAGING_WORKFLOW_NOT_ALLOWED',message:'Not an approved synthetic workflow'});
}
