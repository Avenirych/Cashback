import {Link} from 'react-router-dom';
import content from '../content/activityRules.json';
import Footer from '../components/Footer';
import './ForumRules.css';
import {useEffect,useState} from 'react';
import {BACKEND_URL} from '../backend';
import {useLang} from '../context/LanguageContext';
import {activityText} from '../components/ActivityLimits';
type RulesLanguage = keyof typeof content.rules;
function ActivityRulePanel({section, index, language}: {section: typeof content.rules.ru[number]; index: number; language: RulesLanguage}) {
  const [open, setOpen] = useState(false);
  const id = `activity-rule-${language}-${index}`;
  const toggle = () => setOpen(previous => !previous);
  return <details className="forum-rule-panel" open={open}>
    <summary id={id + '-heading'} role="button" tabIndex={0} aria-expanded={open} aria-controls={id}
      onClick={event => { event.preventDefault(); toggle(); }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
      }}>
      <span>{index + 1}. {section.title}</span><span className="forum-rule-arrow" aria-hidden="true">⌄</span>
    </summary>
    <div className="forum-rule-body" id={id} aria-labelledby={id + '-heading'}>
      {section.blocks.map((block, position) => typeof block === 'string'
        ? <p key={position}>{block}</p>
        : <ul key={position}>{block.map(item => <li key={item}>{item}</li>)}</ul>)}
    </div>
  </details>;
}
export default function ActivityRules(){const {lang}=useLang(),t=activityText(lang);const [limits,setLimits]=useState<{action:'video'|'research'|'review'|'topic'|'post';period:'day'|'month';maximum:number|null}[]>([]),[failed,setFailed]=useState(false);useEffect(()=>{const c=new AbortController();void fetch(BACKEND_URL+'/activity/policies',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{if(!c.signal.aborted&&Array.isArray(x.limits))setLimits(x.limits);}).catch(()=>{if(!c.signal.aborted)setFailed(true);});return()=>c.abort();},[]);
const requestedLanguage = lang.toLowerCase();
const language: RulesLanguage = Object.prototype.hasOwnProperty.call(content.rules, requestedLanguage)
  ? requestedLanguage as RulesLanguage : 'en';
return <>
  <main className="forum-rules-page" lang={language}>
    <h1>{t.rules}</h1>
    {failed&&<p role="alert">{t.error}</p>}
    <ul>{limits.map(r=><li key={r.action+r.period}>{t[r.action]}: {r.maximum??t.unlimited} {t[r.period]} · UTC</li>)}</ul>
    <p><Link to="/profile">{t.title}</Link> · <Link to="/contacts">{t.contact}</Link></p>
    <div className="forum-rule-sections" key={language}>
      {content.rules[language].map((section,index)=><ActivityRulePanel
        key={section.title} section={section} index={index} language={language} />)}
    </div>
  </main>
  <Footer lang={language.toUpperCase()} />
</>;
}
