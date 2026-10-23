import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useLang} from '../context/LanguageContext';
import {featureAvailability, labels, locale, sections,routeTitle} from '../content/siteContent';
import InformationAccordion from './InformationAccordion';
import {InformationLinks} from './InformationPage';
/** Present availability before interaction; no flags here enable any service. */
export default function PageContext(){
 const {pathname}=useLocation(),{lang}=useLang(),l=locale(lang);
 const feature: keyof typeof featureAvailability|null=pathname==='/shop'||pathname==='/product-offers'||pathname==='/partner-not-connected'?'partners':pathname.startsWith('/bonuses/research')?'research':pathname==='/bonuses/ads'?'videos':pathname==='/bonuses'?'videos':pathname==='/dashboard'||pathname==='/profile'?'payments':null;
 const info=pathname.startsWith('/forum')?[sections.reviews]:pathname==='/profile'?[sections.plans,sections.payments]:pathname==='/dashboard'?[sections.payments]:feature?[sections.cashback,sections.confirmation,sections.activities]:[];
 useEffect(()=>{document.documentElement.lang=l;document.title=`${routeTitle(pathname)[l]} | Cashback+`;let meta=document.querySelector<HTMLMetaElement>('meta[name="description"]');if(!meta){meta=document.createElement('meta');meta.name='description';document.head.appendChild(meta);}meta.content=labels.seo[l];},[pathname,l]);
 if(!feature&&!info.length)return null;
 const status=feature?featureAvailability[feature]:null;
 return <section className="page-context" lang={l} aria-label={labels.status[l]}>{status&&<aside className="feature-notice"><strong>{labels.status[l]}</strong><p>{status==='preparing'?labels.preparation[l]:labels.demo[l]}</p></aside>}
 <InformationAccordion items={info} lang={l}/><InformationLinks lang={l}/></section>;
}
