import {activityText} from '../components/ActivityLimits';
import {useEffect,useRef,useState} from 'react';
import {Link,Navigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useLang} from '../context/LanguageContext';
import {FORUM_API_URL} from '../forum';
import {reviewCopy} from '../components/ReviewsCarousel';
import {demoReviewMessages} from '../content/demoReviewMessages';
import ForumAuthor from '../components/ForumAuthor';
import {clearReviewIntent} from '../reviewReturn';
export const REVIEW_RETURN_PATH='/forum/reviews/new';
export default function ReviewEntry(){
  const {user,token,loading,forumLoading,forumUser,forumSessionActive,forumBanned}=useAuth(),{lang}=useLang(),t=reviewCopy(lang);
  const demo=process.env.REACT_APP_LOCAL_DEMO_REVIEWS==='true',dt=demoReviewMessages[lang as keyof typeof demoReviewMessages];
  const [enabled,setEnabled]=useState<boolean|null>(null),[title,setTitle]=useState(''),[body,setBody]=useState(''),[rating,setRating]=useState(3),[genuine,setGenuine]=useState(false),[agreed,setAgreed]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const key=useRef<string|undefined>(undefined);
  useEffect(()=>{if(user?.email_verified&&forumUser)clearReviewIntent();},[user?.email_verified,forumUser]);
  useEffect(()=>{const c=new AbortController();void fetch(FORUM_API_URL+(demo?'/demo-reviews/config':'/forum/reviews/config'),{signal:c.signal}).then(r=>r.ok?r.json():{enabled:false}).then(x=>{if(!c.signal.aborted)setEnabled(x.enabled===true);}).catch(()=>{if(!c.signal.aborted)setEnabled(false);});return()=>c.abort();},[demo]);
  if(!t||loading||forumLoading)return null;
  if(!user)return <Navigate replace to={(demo?'/register?next=':'/login?next=')+encodeURIComponent(REVIEW_RETURN_PATH)}/>;
  if(!user.email_verified)return <Navigate replace to={'/register?next='+encodeURIComponent(REVIEW_RETURN_PATH)}/>;
  if(!forumUser||(!demo&&!forumSessionActive))return <Navigate replace to={'/forum/register?next='+encodeURIComponent(REVIEW_RETURN_PATH)}/>;
  return <main style={{maxWidth:650,margin:'auto',padding:24}}><h1>{t.newReview}</h1><Link to="/forum/rules">{t.rules}</Link> · <Link to="/forum/moderation">{t.manage}</Link>
    <ForumAuthor author={{id:null,username:forumUser.username,avatar_url:forumUser.avatar_url,created_at:forumUser.created_at}} lang={lang}/>
    {demo&&dt&&<><p><strong>{dt.label}</strong></p><p>{dt.retention}</p><Link to="/forum/reviews/history">{dt.history}</Link></>}
    {enabled===false&&<p role="status">{t.failed}</p>}
    {enabled&& !forumBanned&&!forumUser.banned&&<form style={{display:'grid',gap:12}} onSubmit={async e=>{
      e.preventDefault();if(busy||!genuine||!agreed)return;setBusy(true);setNotice('');key.current??=crypto.randomUUID();
      try{if(!demo){const acceptance=await fetch(FORUM_API_URL+'/forum/rules/accept',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({agreedToRules:agreed})});if(!acceptance.ok)throw Error();}const r=await fetch(FORUM_API_URL+(demo?'/demo-reviews':'/forum/reviews'),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':key.current},body:JSON.stringify({title,body,rating,experienceConfirmed:genuine,demoDeclared:demo&&genuine,agreedToRules:agreed,language:lang})});if(!r.ok){if(r.status===429){setNotice(activityText(lang).limitReached);return;}throw Error();}setNotice(demo?dt.success:t.pending);setTitle('');setBody('');setGenuine(false);window.dispatchEvent(new Event('cashback-demo-review-published'));}catch{setNotice(t.failed);}finally{setBusy(false);}
    }}><label>{t.reviewTitle}<input required minLength={3} maxLength={255} value={title} disabled={busy} onChange={e=>{setTitle(e.target.value);key.current=undefined;}}/></label>
      <label>{t.body}<textarea required minLength={20} maxLength={4000} disabled={busy} value={body} onChange={e=>{setBody(e.target.value);key.current=undefined;}}/></label>
      <label>{t.rating}<select value={rating} disabled={busy} onChange={e=>{setRating(Number(e.target.value));key.current=undefined;}}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label>
      <label><input type="checkbox" required checked={genuine} disabled={busy} onChange={e=>setGenuine(e.target.checked)}/>{demo?dt.declaration:t.genuine}</label><label><input type="checkbox" required checked={agreed} disabled={busy} onChange={e=>setAgreed(e.target.checked)}/>{t.rules}</label><button disabled={busy||!genuine||!agreed}>{demo?dt.publish:t.submit}</button></form>}
    {notice&&<p role="status">{notice} <Link to="/profile">{activityText(lang).title}</Link></p>}<p><Link to="/forum">{t.read}</Link></p>
  </main>;
}
