import {BACKEND_URL} from './backend';
import messages from './content/passwordMessages.json';
export type PasswordLanguage=keyof typeof messages;
export type PasswordError='invalid'|'generic'|'rate'|'auth'|'uncertain'|'credentials';
export const passwordLanguage=(lang:string):PasswordLanguage=>Object.prototype.hasOwnProperty.call(messages,lang.toLowerCase())?lang.toLowerCase() as PasswordLanguage:'en';
export const passwordText=(lang:string)=>messages[passwordLanguage(lang)];
export class PasswordFailure extends Error{constructor(readonly kind:PasswordError){super('PASSWORD_REQUEST_FAILED');}}
export function validNewPassword(value:string){
 // Count UTF-8 bytes without a browser polyfill or normalization.
 const bytes=new Blob([value]).size;
 return value.length>=8&&/[A-Z]/.test(value)&&/[a-z]/.test(value)&&/\d/.test(value)&&/[^A-Za-z0-9]/.test(value)&&bytes<=72;
}
export async function passwordRequest(kind:'request'|'confirm'|'change',body:Record<string,string>,bearer?:string):Promise<void>{
 const path=kind==='change'?'/auth/password/change':'/auth/password-reset/'+kind;
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),15000);
 try{
  const response=await fetch(BACKEND_URL+path,{method:'POST',headers:{'Content-Type':'application/json',...(kind==='change'&&bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body),signal:abort.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  // No untrusted response body/error text is read, displayed or logged.
  if(response.status===(kind==='request'?202:204))return;
  if(response.status===429)throw new PasswordFailure('rate');
  if(response.status===401||response.status===403)throw new PasswordFailure('auth');
  if(response.status===400)throw new PasswordFailure(kind==='confirm'?'invalid':kind==='change'?'credentials':'generic');
  throw new PasswordFailure(kind==='request'?'generic':'uncertain');
 }catch(e){if(e instanceof PasswordFailure)throw e;throw new PasswordFailure('uncertain');}
 finally{clearTimeout(timer);}
}
