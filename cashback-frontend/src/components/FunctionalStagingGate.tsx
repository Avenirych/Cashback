import {ReactNode,useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {FORUM_API_URL} from '../forum';
import DemoClosed from './DemoClosed';
export type StagingPermission='forumRegistration'|'publication'|'moderation';
export function functionalBuild(env:{[key:string]:string|undefined}=process.env){return env.REACT_APP_STAGING==='true'&&env.REACT_APP_STAGING_WORKFLOWS==='synthetic-v1';}
export const functionalStagingBuild=functionalBuild();
const localWrites=process.env.NODE_ENV==='development'&&process.env.REACT_APP_STAGING!=='true'&&(process.env.REACT_APP_DEMO_ONLY!=='true'||process.env.REACT_APP_LOCAL_DEMO_REVIEWS==='true');
export function permits(payload:unknown,user:{id:number;email:string;email_verified?:boolean}|null,permission:StagingPermission):boolean {
  if(!user?.email_verified||!/^[A-Za-z0-9._+%-]+@example[.]invalid$/i.test(user.email)||!payload||typeof payload!=='object')return false;
  const p=payload as {profile?:unknown;userId?:unknown;permissions?:Partial<Record<StagingPermission,unknown>>};
  return p.profile==='synthetic-v1'&&p.userId===user.id&&p.permissions?.[permission]===true;
}
export function useFunctionalPermission(permission:StagingPermission){
  const {user,token}=useAuth();
  const [state,setState]=useState<{token:string;userId:number;payload:unknown}|null>(null);
  useEffect(()=>{
    setState(null);
    if(!functionalStagingBuild||!token||!user?.email_verified)return;
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),8000),uid=user.id;
    void fetch(FORUM_API_URL+'/forum/staging-access',{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:c.signal})
      .then(async r=>r.ok?await r.json():null).then(payload=>{if(!c.signal.aborted)setState({token,userId:uid,payload});}).catch(()=>{}).finally(()=>clearTimeout(timer));
    return()=>{clearTimeout(timer);c.abort();};
  },[token,user?.id,user?.email_verified]);
  if(!functionalStagingBuild)return localWrites&&permission!=='moderation';
  return !!state&&state.token===token&&state.userId===user?.id&&permits(state.payload,user,permission);
}
export default function FunctionalStagingGate({permission,children}:{permission:StagingPermission;children:ReactNode}){
  const allowed=useFunctionalPermission(permission);
  return allowed?<>{children}</>:<DemoClosed/>;
}
