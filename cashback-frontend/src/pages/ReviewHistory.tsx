import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useLang} from '../context/LanguageContext';
import {FORUM_API_URL} from '../forum';
import {demoReviewMessages} from '../content/demoReviewMessages';
import {DemoReviewCard,DemoReviewData} from '../components/DemoReviewCard';
export default function ReviewHistory(){
 const {lang}=useLang(),t=demoReviewMessages[lang as keyof typeof demoReviewMessages];const [page,setPage]=useState(1),[items,setItems]=useState<DemoReviewData[]>([]),[total,setTotal]=useState(0),[failed,setFailed]=useState(false);
 useEffect(()=>{const c=new AbortController();setFailed(false);void fetch(FORUM_API_URL+'/demo-reviews?page='+page,{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{if(!c.signal.aborted){setItems(data.items.filter((r:DemoReviewData)=>r.demo===true));setTotal(data.total);}}).catch(()=>{if(!c.signal.aborted)setFailed(true);});return()=>c.abort();},[page]);
 if(!t)return null;return <main style={{maxWidth:1000,margin:'auto',padding:24}}><h1>{t.history}</h1><p>{t.retention}</p><Link to="/forum/reviews/new">{t.publish}</Link> · <Link to="/">Cashback+</Link>{failed&&<p role="alert">{t.disabled}</p>}<div style={{display:'grid',gap:16,margin:'24px 0'}}>{items.map(r=><DemoReviewCard key={r.id} review={r}/>)}</div><nav><button disabled={page===1} onClick={()=>setPage(page-1)}>{t.previous}</button> <span>{page} / {Math.max(1,Math.ceil(total/10))}</span> <button disabled={page*10>=total} onClick={()=>setPage(page+1)}>{t.next}</button></nav></main>;
}
