import {registrationIsolated} from './registrationIsolation';
/** Read-only access to the reviewed historical backend; writes remain isolated. */
export function localBonusReadOnly(href=window.location.href):boolean {
 if(process.env.REACT_APP_BONUS_READ_ONLY!=='true'||
 process.env.REACT_APP_DEMO_ONLY!=='true'||process.env.REACT_APP_REGISTRATION_ISOLATED!=='true')return false;
 try{
  const u=new URL(href);
  if(u.protocol!=='http:')return false;
  if(process.env.NODE_ENV==='development')return process.env.REACT_APP_API_BASE==='/api'&&
   ['localhost','127.0.0.1'].includes(u.hostname)&&u.port==='3005';
  return process.env.NODE_ENV==='production'&&u.origin==='http://localhost:3004'&&
   process.env.REACT_APP_API_BASE==='http://127.0.0.1:3006';
 }catch{return false;}
}
export function canReadBonusSnapshot():boolean {
 return !registrationIsolated()||localBonusReadOnly();
}
export function assertBonusSnapshotReadAllowed():void {
 if(!canReadBonusSnapshot())throw new Error('Bonus snapshot is unavailable in this mode');
}
