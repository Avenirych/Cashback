import {BadRequestException} from '@nestjs/common';
import {randomBytes,createHash} from 'node:crypto';
export type PasswordLocale='ru'|'en'|'de'|'fr';
export type PasswordAction='password_reset_request'|'password_reset_confirm'|'password_change';
export interface PasswordQuota {period:'minute'|'hour'|'quarter_hour';seconds:number;maximum:number}
export const RESET_TTL_SECONDS=1800;
export const PASSWORD_JOB_RETENTION_SECONDS=86400;
export const PASSWORD_QUEUE_CAPACITY=1000;
export const PASSWORD_ACCOUNT_QUOTAS:Record<PasswordAction,readonly PasswordQuota[]>={
 password_reset_request:[{period:'minute',seconds:60,maximum:1},{period:'hour',seconds:3600,maximum:3}],
 password_reset_confirm:[{period:'quarter_hour',seconds:900,maximum:20}],
 password_change:[{period:'quarter_hour',seconds:900,maximum:5}],
};
export function passwordQuotas(action:PasswordAction,scope:'account'|'source'|'global'):readonly PasswordQuota[]{
 if(scope==='account')return PASSWORD_ACCOUNT_QUOTAS[action];
 if(scope==='global')return[{period:'quarter_hour',seconds:900,maximum:20}];
 return action==='password_reset_request'?[{period:'hour',seconds:3600,maximum:20}]:[{period:'quarter_hour',seconds:900,maximum:20}];
}
export const passwordLocale=(v:unknown):PasswordLocale=>typeof v==='string'&&['ru','en','de','fr'].includes(v.toLowerCase())?v.toLowerCase() as PasswordLocale:'en';
export function recoveryEmail(v:unknown):string{
 if(typeof v!=='string')throw new BadRequestException('Valid email required');
 const s=v.trim().toLowerCase();
 if(s.length>320||s.includes('..')||!/^[a-zA-Z0-9._+\-]{1,64}@[a-zA-Z0-9.\-]{1,255}\.[a-zA-Z]{2,}$/.test(s))throw new BadRequestException('Valid email required');
 return s;
}
export function resetDigest(token:unknown):Buffer{
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new BadRequestException('Invalid or expired reset link');
 return createHash('sha256').update('password-reset-v1:'+token).digest();
}
/** Raw capability must never be persisted, logged, returned by API or snapshotted in tests. */
export function newResetCapability(){const raw=randomBytes(32).toString('hex');return{raw,digest:resetDigest(raw)};}
