import {useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {useLang} from '../context/LanguageContext';
import {FORUM_API_URL} from '../forum';
import {reviewCopy} from './ReviewsCarousel';
export default function ForumRulesAcceptance(){
  const {token}=useAuth(),{lang}=useLang(),t=reviewCopy(lang);
  const [needed,setNeeded]=useState(false),[agreed,setAgreed]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{if(!token)return;let active=true;void(async()=>{try{const c=await fetch(FORUM_API_URL+'/forum/reviews/config');if(!c.ok||!(await c.json()).enabled||!token)return;const r=await fetch(FORUM_API_URL+'/forum/rules/acceptance',{headers:{Authorization:'Bearer '+token}});if(r.ok&&active)setNeeded(!(await r.json()).accepted);}catch{}})();return()=>{active=false;};},[token]);
  if(!needed||!t)return null;
  return <form onSubmit={async e=>{e.preventDefault();if(!agreed||busy)return;setBusy(true);try{const r=await fetch(FORUM_API_URL+'/forum/rules/accept',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({agreedToRules:true})});if(!r.ok)throw Error();setNeeded(false);}catch{setNotice(t.failed);}finally{setBusy(false);}}}>
    <label><input type="checkbox" checked={agreed} required disabled={busy} onChange={e=>setAgreed(e.target.checked)}/>{t.rules}</label><button disabled={!agreed||busy}>{t.send}</button>{notice&&<p role="alert">{notice}</p>}
  </form>;
}
