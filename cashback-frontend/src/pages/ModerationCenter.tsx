import {useCallback,useEffect,useState} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useLang} from '../context/LanguageContext';
import {FORUM_API_URL} from '../forum';
import {reviewCopy} from '../components/ReviewsCarousel';
import activityContent from '../content/myActivity.json';
interface Case {id:number;kind:string;target_id:number;state:string;confirmed_at?:string;revoked_at?:string;title?:string;review_body?:string;content?:string;appeal_id?:number;appeal_reason?:string}
interface Notice {id:number;case_id:number;action:string;reason:string}
interface Mine {restriction:{level:number;blocked:boolean;until:string|null};cases:Case[];notifications:Notice[]}
export default function ModerationCenter({embedded=false}:{embedded?:boolean}={}){
  const {token,user,loading}=useAuth(),{lang}=useLang(),t=reviewCopy(lang);
  const [mine,setMine]=useState<Mine|null>(null),[queue,setQueue]=useState<Case[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [reason,setReason]=useState(''),[manualCase,setManualCase]=useState('');
  const refresh=useCallback(async()=>{
    if(!token)return;
    try{
      const [own,q]=await Promise.all([fetch(FORUM_API_URL+'/forum/moderation/mine',{headers:{Authorization:'Bearer '+token}}),fetch(FORUM_API_URL+'/forum/moderation/queue',{headers:{Authorization:'Bearer '+token}})]);
      if(!own.ok)throw Error();setMine(await own.json());
      if(q.ok)setQueue(await q.json());else if(q.status===403)setQueue(null);else throw Error();
    }catch{setError(t?.failed||'');}
  },[token,t]);
  useEffect(()=>{void refresh();},[refresh]);
  if(loading||!t)return null;
  if(!user)return <Navigate replace to="/login"/>;
  const action=async(caseId:number,verb:string,extra:object={})=>{
    if(busy||reason.trim().length<3)return;setBusy(true);setError('');
    try{const r=await fetch(FORUM_API_URL+'/forum/moderation/'+caseId+'/'+verb,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({reason,...extra})});if(!r.ok)throw Error();setReason('');await refresh();}catch{setError(t.failed);}finally{setBusy(false);}
  };
  const Container=embedded?'div':'main',Title=embedded?'h3':'h1';
  const labels=activityContent[lang.toLowerCase() as keyof typeof activityContent]||activityContent.en;
  return <Container style={embedded?undefined:{maxWidth:850,margin:'auto',padding:24}}><Title>{t.manage}</Title><Link to="/forum">{t.read}</Link>
    {error&&<p role="alert">{error}</p>}
    {mine&&<><h2>{t.restricted}</h2><dl><dt>{labels.level}</dt><dd>{Number.isFinite(mine.restriction.level)?mine.restriction.level:labels.unknown}</dd><dt>{labels.blocked}</dt><dd>{typeof mine.restriction.blocked==='boolean'?(mine.restriction.blocked?labels.yes:labels.no):labels.unknown}</dd><dt>{labels.until}</dt><dd>{mine.restriction.until||'—'}</dd></dl>
      <h2>{t.notices}</h2>{mine.notifications.map(n=><p key={n.id}>#{n.case_id}: {labels.actions[n.action as keyof typeof labels.actions]||labels.unknown} — {n.reason}</p>)}
      {mine.cases.filter(c=>c.confirmed_at&&!c.revoked_at).map(c=><p key={c.id}>#{c.id} <button disabled={busy||reason.trim().length<3} onClick={()=>void action(Number(c.id),'appeal')}>{t.appeal}</button></p>)}
    </>}
    <label>{t.reason}<textarea minLength={3} maxLength={2000} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
    {queue&&<><h2>{t.queue}</h2>{queue.map(c=><article key={c.id} style={{border:'1px solid #bbb',padding:16,marginTop:12}}><h3>#{c.id} {c.title}</h3><p style={{whiteSpace:'pre-wrap'}}>{c.review_body||c.content}</p><p>{c.appeal_reason}</p>
      {c.appeal_id ? <><button disabled={busy||reason.trim().length<3} onClick={()=>void action(Number(c.id),'resolve-appeal',{revoke:true})}>{t.revoke}</button><button disabled={busy||reason.trim().length<3} onClick={()=>void action(Number(c.id),'resolve-appeal',{revoke:false})}>{t.uphold}</button></>:<>{(['publish','hold','confirm'] as const).map(decision=><button key={decision} disabled={busy||reason.trim().length<3} onClick={()=>void action(Number(c.id),'decision',{decision})}>{t[decision]}</button>)}</>}
    </article>)}<label>{t.caseId}<input type="number" min={1} value={manualCase} onChange={e=>setManualCase(e.target.value)}/></label><button disabled={busy||reason.trim().length<3||!Number.isSafeInteger(Number(manualCase))||Number(manualCase)<1} onClick={()=>void action(Number(manualCase),'revoke')}>{t.revoke}</button></>}
  </Container>;
}
