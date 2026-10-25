import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useLang} from '../context/LanguageContext';
import {useAuth} from '../context/AuthContext';
import content from '../content/moderationRules.json';
import ModerationCenter from './ModerationCenter';
import './ForumRules.css';

type Language = keyof typeof content.rules;
const navigation = {
  ru: {back:'Читать форум', demo:'Инструменты модерации недоступны в демонстрационном режиме.'},
  en: {back:'Read forum', demo:'Moderation tools are unavailable in demonstration mode.'},
  de: {back:'Forum lesen', demo:'Moderationswerkzeuge sind im Demonstrationsmodus nicht verfügbar.'},
  fr: {back:'Lire le forum', demo:'Les outils de modération ne sont pas disponibles en mode démonstration.'},
};
const documentRoutes = ['/terms', '/forum/rules', '/activity-limits', '/privacy'];

function PolicyBody({body, documentLinks}: {body:string; documentLinks:boolean}) {
  const lines = body.split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith('### ')) {
      blocks.push(<h3 key={index}>{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      const first = index;
      const items = [];
      while (index < lines.length && lines[index].startsWith('- ')) {
        const text = lines[index].slice(2);
        const route = documentLinks ? documentRoutes[items.length] : undefined;
        items.push(<li key={index}>{route ? <Link to={route}>{text}</Link> : text}</li>);
        index++;
      }
      index--;
      blocks.push(<ul key={first}>{items}</ul>);
    } else if (line) {
      blocks.push(<p key={index}>{line}</p>);
    }
  }
  return <>{blocks}</>;
}

function PolicyPanel({heading, body, index, language}: {heading:string; body:string; index:number; language:Language}) {
  const [open, setOpen] = useState(false);
  const id = `moderation-rule-${language}-${index}`;
  const toggle = () => setOpen(previous => !previous);
  return <details className="forum-rule-panel" open={open}>
    <summary id={id+'-heading'} role="button" tabIndex={0} aria-expanded={open} aria-controls={id}
      onClick={event => {event.preventDefault(); toggle();}}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); toggle();}
      }}>
      <span>{index+1}. {heading}</span><span className="forum-rule-arrow" aria-hidden="true">⌄</span>
    </summary>
    <div className="forum-rule-body" id={id} aria-labelledby={id+'-heading'}>
      <PolicyBody body={body} documentLinks={index === 15}/>
    </div>
  </details>;
}

export default function ModerationPolicy() {
  const {lang} = useLang();
  const {user, token, loading} = useAuth();
  const normalized = lang.toLowerCase();
  const language:Language = Object.prototype.hasOwnProperty.call(content.rules, normalized)
    ? normalized as Language : 'en';
  const demo = process.env.REACT_APP_DEMO_ONLY === 'true';
  return <>
    <main className="forum-rules-page" lang={language}>
      <h1>{content.titles[language]}</h1>
      <p className="forum-rules-date">{content.effectiveDate[language]}</p>
      <Link to="/forum">{navigation[language].back}</Link>
      <div className="forum-rule-sections" key={language}>
        {content.rules[language].map(([heading, body], index) =>
          <PolicyPanel key={heading} heading={heading} body={body} index={index} language={language}/>)}
      </div>
      {demo && <p role="status">{navigation[language].demo}</p>}
    </main>
    {!demo && !loading && user && token && <ModerationCenter/>}
  </>;
}
