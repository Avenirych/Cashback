import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useLang} from '../context/LanguageContext';
import {FORUM_API_URL} from '../forum';
import messages from '../content/reviewMessages.json';
import demos from '../content/demoReviews.json';
import ContentReport from './ContentReport';
import './ReviewsCarousel.css';
import {DemoReviewCard,DemoReviewData} from './DemoReviewCard';
import {demoReviewMessages} from '../content/demoReviewMessages';

export const reviewCopy = (lang:string) => messages[lang.toLowerCase() as keyof typeof messages] ?? null;
export const reviewDisplayMode = (value:string|undefined):'demo'|'public' => value==='public'?'public':'demo';
export interface PublicReview {id:number;caseId:number;title:string;body:string;rating:number;status:'published';demo:false;author:{username:string}}
export default function ReviewsCarousel({mode='public'}:{mode?:'public'|'demo'}) {
  const {lang}=useLang(), t=reviewCopy(lang);
  const liveDemo=mode==='demo'&&process.env.REACT_APP_LOCAL_DEMO_REVIEWS==='true';
  const [demoRows,setDemoRows]=useState<DemoReviewData[]>([]);
  const [revision,setRevision]=useState(0);
  const demoCopy=demoReviewMessages[lang as keyof typeof demoReviewMessages];
  const [reviews,setReviews]=useState<PublicReview[]>([]),[failed,setFailed]=useState(false);
  const track=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!liveDemo)return;const refresh=()=>setRevision(n=>n+1);window.addEventListener('focus',refresh);window.addEventListener('cashback-demo-review-published',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('cashback-demo-review-published',refresh);};},[liveDemo]);
  useEffect(()=>{
    if(mode==='demo'&&!liveDemo)return;
    const controller=new AbortController();
    void fetch(FORUM_API_URL+(liveDemo?'/demo-reviews?page=1':'/forum/reviews'),{signal:controller.signal}).then(async r=>{
      if(!r.ok)throw Error('reviews');const data=await r.json();
      if(liveDemo){if(!controller.signal.aborted)setDemoRows(Array.isArray(data.items)?data.items.filter((x:DemoReviewData)=>x.demo===true):[]);return;}
      if(!controller.signal.aborted)setReviews(Array.isArray(data)?data.filter(x=>x.status==='published'&&x.demo===false&&typeof x.author?.username==='string'&&typeof x.body==='string'&&typeof x.title==='string'&&Number.isInteger(x.rating)&&x.rating>=1&&x.rating<=5):[]);
    }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return()=>controller.abort();
  },[mode,liveDemo,revision]);
  if(!t)return null;
  const move=(direction:number)=>track.current?.scrollBy({left:direction*track.current.clientWidth,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  return <section className="reviews-carousel" aria-label={t.title}>
    <h2>{t.title}</h2><p>{mode==='demo'?t.demo:t.disclosure}</p>{mode==='public'&&<p>{t.community}</p>}
    <div className="reviews-controls"><button type="button" onClick={()=>move(-1)} aria-label={t.previous}>←</button><button type="button" onClick={()=>move(1)} aria-label={t.next}>→</button>{(mode==='public'||liveDemo)&&<Link className="review-cta" to="/forum/reviews/new">{t.leave}</Link>}{liveDemo&&<Link to="/forum/reviews/history">{demoCopy?.history}</Link>}</div>
    <div className="reviews-track" ref={track} tabIndex={0} role="region" aria-label={t.title} onKeyDown={e=>{
      if(e.target!==e.currentTarget)return;
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}
      if(e.key==='Home'||e.key==='End'){e.preventDefault();track.current?.scrollTo({left:e.key==='Home'?0:track.current.scrollWidth,behavior:'auto'});}
    }}>
      {mode==='demo'?(liveDemo?demoRows.map(r=><DemoReviewCard key={r.id} review={r}/>):demos.map(d=><article className="review-card" key={d.id}><strong>{d.name}</strong><p>{d.text[lang.toLowerCase() as keyof typeof d.text]}</p><small>{t.demo}</small></article>)):reviews.map(r=><article className="review-card" key={r.id}><strong>{r.author.username}</strong><h3>{r.title}</h3><p>{r.body}</p><p>{t.rating}: {r.rating}/5</p><ContentReport caseId={r.caseId}/></article>)}
    </div>
    {mode==='public'&&!reviews.length&&<p role="status">{failed?t.failed:t.empty}</p>}
    {liveDemo&&failed&&<p role="alert">{demoCopy?.disabled}</p>}
  </section>;
}
