import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useLang} from '../context/LanguageContext';
import {faqSections, informationPages, labels, locale, sections} from '../content/siteContent';
import InformationAccordion from './InformationAccordion';
import Footer from './Footer';
import CookieSettingsModal from './CookieSettingsModal';
import {cookieMessages} from '../content/cookieMessages';
import {ruFaqGroups, ruIntro, russianSection} from '../content/russianEditorial';
export function InformationLinks({lang}:{lang:string}){const l=locale(lang);return <nav className="information-links" aria-label={labels.services[l]}>{(['services','faq','terms','privacy','cookies','contacts'] as const).map(id=><Link key={id} to={'/'+id}>{labels[id][l]}</Link>)}<Link to="/activity-limits">{labels.rules[l]}</Link><Link to="/forum/rules">{labels.review[l]}</Link></nav>;}
export default function InformationPage({page,lang:provided}:{page:string;lang?:string}){
 const {lang}=useLang(),l=locale(provided||lang),[settings,setSettings]=useState(false),faq=page==='faq',p=informationPages[page];
 const items=faq?faqSections:p.sections.filter(id=>!(l==='ru'&&page==='about'&&id==='platform')).map(id=>sections[id]);
 return <><main className="information-page" lang={l}><h1>{faq?labels.faq[l]:labels[p.title][l]}</h1>
 {p?.legal&&<aside className="feature-notice"><strong>{labels.status[l]}</strong><p>{labels.draft[l]}</p></aside>}
 {l==='ru'&&<p className="information-lead">{ruIntro[page]}</p>}
 {l!=='ru'&&(page==='about'||page==='services'||faq)&&<aside className="feature-notice"><strong>{labels.status[l]}</strong><p>{labels.demo[l]}</p></aside>}
 {page==='contacts'&&l!=='ru'&&<p className="feature-notice">{labels.contactUnavailable[l]}</p>}
 {l==='ru' ? faq ? ruFaqGroups.map(group=><section className="faq-group" key={group.title}><h2>{group.title}</h2><InformationAccordion items={group.items} lang={l}/></section>) : <div className="information-prose">{items.map(russianSection).map(item=><section key={item.id} id={item.id==='rights'?'privacySection11':item.id==='choices'?'privacySection12':item.id}><h2>{item.title.ru}</h2><p>{item.body.ru}</p></section>)}</div> : <InformationAccordion items={items} lang={l}/>}
 {page==='cookies'&&<><button type="button" onClick={()=>setSettings(true)}>{cookieMessages[l].manage}</button>{settings&&<CookieSettingsModal onClose={()=>setSettings(false)}/>}</>}
 {page==='contacts'&&<><Link to="/profile">{labels.profile[l]}</Link><form className="information-contact-form" aria-describedby="contact-unavailable" onSubmit={e=>e.preventDefault()}><p id="contact-unavailable">{labels.send[l]}</p><label>{labels.name[l]}<input name="name" disabled autoComplete="off"/></label><label>{labels.message[l]}<textarea name="message" disabled/></label><button type="submit" disabled>{labels.send[l]}</button></form></>}
 {l!=='ru'&&<InformationLinks lang={l}/>}</main><Footer lang={l}/></>;
}
