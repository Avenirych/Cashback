import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useLang} from '../context/LanguageContext';
import {FORUM_API_URL} from '../forum';
import messages from '../content/reviewMessages.json';
export default function ContentReport({caseId}:{caseId?:number}) {
  const {token}=useAuth(),{lang}=useLang(),t=messages[lang.toLowerCase() as keyof typeof messages];
  const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  if(!caseId||!t)return null;
  return <div><button type="button" onClick={()=>setOpen(!open)}>{t.report}</button>{open&&(!token?<Link to="/login">{t.signIn}</Link>:<form onSubmit={async e=>{
    e.preventDefault();if(busy)return;setBusy(true);setNotice('');
    try{const r=await fetch(FORUM_API_URL+'/forum/moderation/'+caseId+'/report',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({reason})});if(!r.ok)throw Error();setNotice(t.sent);setOpen(false);}catch{setNotice(t.failed);}finally{setBusy(false);}
  }}><label>{t.reason}<textarea required minLength={3} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={busy}>{t.send}</button></form>)}{notice&&<p role="status">{notice}</p>}</div>;
}
