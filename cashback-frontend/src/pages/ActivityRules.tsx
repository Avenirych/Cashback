import InformationAccordion from '../components/InformationAccordion';
import {sections,locale} from '../content/siteContent';
import {Link} from 'react-router-dom';
import {useEffect,useState} from 'react';
import {BACKEND_URL} from '../backend';
import {useLang} from '../context/LanguageContext';
import {activityText} from '../components/ActivityLimits';
export default function ActivityRules(){const {lang}=useLang(),t=activityText(lang);const [limits,setLimits]=useState<{action:'video'|'research'|'review'|'topic'|'post';period:'day'|'month';maximum:number|null}[]>([]),[failed,setFailed]=useState(false);useEffect(()=>{const c=new AbortController();void fetch(BACKEND_URL+'/activity/policies',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{if(!c.signal.aborted&&Array.isArray(x.limits))setLimits(x.limits);}).catch(()=>{if(!c.signal.aborted)setFailed(true);});return()=>c.abort();},[]);return <main lang={lang} style={{maxWidth:850,margin:'auto',padding:24}}><h1>{t.rules}</h1><p>{t.help}</p><p>{sections.renewal.body[locale(lang)]}</p>{failed&&<p role="alert">{t.error}</p>}<ul>{limits.map(r=><li key={r.action+r.period}>{t[r.action]}: {r.maximum??t.unlimited} {t[r.period]} · UTC</li>)}</ul><p>{t.privacy}</p><p>{t.demo}</p><InformationAccordion lang={locale(lang)} items={[sections.plans,sections.appeals]}/><Link to="/profile">{t.title}</Link> · <Link to="/contacts">{t.contact}</Link></main>;}
