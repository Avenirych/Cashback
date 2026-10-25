import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import Footer from '../components/Footer';
import content from '../content/privacyPolicy.json';
import './ForumRules.css';

type Language = keyof typeof content.rules;
interface PrivacyPolicyProps {lang:string}
const linkPattern = /(privacy@cashbackplus\.uk|support@cashbackplus\.uk|legal@cashbackplus\.uk|https:\/\/ico\.org\.uk|Политике использования Cookie|Cookie Policy|Cookie-Richtlinie|Politique relative aux cookies)/g;
function InlineText({text}: {text:string}) {
  return <>{text.split(linkPattern).map((part,index)=>{
    if (/^(privacy|support|legal)@cashbackplus\.uk$/.test(part)) {
      return <a key={index} href={'mailto:'+part}>{part}</a>;
    }
    if (part === 'https://ico.org.uk') {
      return <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>;
    }
    if (Object.values(content.cookieLinkText).includes(part)) {
      return <Link key={index} to="/cookies">{part}</Link>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  })}</>;
}
function PrivacyBody({body}: {body:string}) {
  const lines=body.split('\n');
  const blocks=[];
  for (let index=0; index<lines.length; index++) {
    const line=lines[index];
    if (line.startsWith('### ')) {
      blocks.push(<h3 key={index}>{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      const first=index,items=[];
      while (index<lines.length && lines[index].startsWith('- ')) {
        items.push(<li key={index}><InlineText text={lines[index].slice(2)}/></li>);
        index++;
      }
      index--;
      blocks.push(<ul key={first}>{items}</ul>);
    } else if (line) {
      blocks.push(<p key={index}><InlineText text={line}/></p>);
    }
  }
  return <>{blocks}</>;
}
function PrivacyPanel({heading,body,index,language}: {heading:string;body:string;index:number;language:Language}) {
  const [open,setOpen]=useState(false);
  const id=`privacy-rule-${language}-${index}`;
  const toggle=()=>setOpen(previous=>!previous);
  return <details className="forum-rule-panel" id={`privacySection${index+1}`} open={open}>
    <summary id={id+'-heading'} role="button" tabIndex={0} aria-expanded={open} aria-controls={id}
      onClick={event=>{event.preventDefault();toggle();}}
      onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}}}>
      <span>{index+1}. {heading}</span><span className="forum-rule-arrow" aria-hidden="true">⌄</span>
    </summary>
    <div className="forum-rule-body" id={id} aria-labelledby={id+'-heading'}><PrivacyBody body={body}/></div>
  </details>;
}
export default function PrivacyPolicy({lang}:PrivacyPolicyProps) {
  const normalized=(lang||'en').toLowerCase();
  const language:Language=Object.prototype.hasOwnProperty.call(content.rules,normalized)?normalized as Language:'en';
  return <>
    <main className="forum-rules-page" lang={language}>
      <h1>{content.title[language]}</h1>
      <p className="forum-rules-date">{content.effectiveDate[language]}</p>
      <div className="forum-rule-sections" key={language}>
        {content.rules[language].map(([heading,body],index)=><PrivacyPanel key={heading}
          heading={heading} body={body} index={index} language={language}/>)}
      </div>
    </main>
    <Footer lang={language.toUpperCase()}/>
  </>;
}
