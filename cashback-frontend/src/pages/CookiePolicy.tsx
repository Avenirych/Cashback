import React from 'react';
import {Link} from 'react-router-dom';
import {useLang} from '../context/LanguageContext';
import FAQ from './FAQ';
import policy from '../content/cookiePolicy.json';
const labels={
 ru:{title:'Политика использования файлов Cookie',date:'Дата вступления в силу: 30 октября 2026 года'},
 en:{title:'Cookie Policy',date:'Effective date: 30 October 2026'},
 de:{title:'Cookie-Richtlinie',date:'Gültig ab: 30. Oktober 2026'},
 fr:{title:'Politique relative aux cookies',date:'Date d’entrée en vigueur : 30 octobre 2026'},
};
const routes:Record<string,string>={
 'Политикой конфиденциальности':'/privacy','Политика конфиденциальности':'/privacy',
 'Terms and Conditions':'/terms','Правилами активности':'/activity-limits','Правила активности':'/activity-limits','Контакты':'/contacts',
 'Privacy Policy':'/privacy','Activity Rules':'/activity-limits','Contacts':'/contacts',
 'Datenschutzerklärung':'/privacy','Aktivitätsregeln':'/activity-limits','Kontaktseite':'/contacts',
 'Politique de confidentialité':'/privacy','Règles d’activité':'/activity-limits',
};
const fragments=Object.keys(routes).sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
function inline(text:string):React.ReactNode{return text.split(new RegExp('(\\*\\*[^*]+\\*\\*|privacy@cashbackplus\\.co\\.uk|'+fragments+')','g')).map((part,index)=>{
 if(part.startsWith('**')&&part.endsWith('**'))return <strong key={index}>{inline(part.slice(2,-2))}</strong>;
 if(part==='privacy@cashbackplus.co.uk')return <a key={index} href={'mailto:'+part}>{part}</a>;
 return routes[part]?<Link key={index} to={routes[part]}>{part}</Link>:part;
});}
export default function CookiePolicy(){
 const {lang}=useLang();const key=lang.toLowerCase() as keyof typeof labels;const language=Object.prototype.hasOwnProperty.call(labels,key)?key:'en';const t=labels[language];
 const sections:{title:string;blocks:{type:string;text?:string;items?:string[]}[]}[]=policy.rules[language];
 return <FAQ lang={language} title={t.title} introduction={<p style={{color:'var(--text-secondary)',lineHeight:1.6,marginBottom:24}}>{t.date}</p>}
 items={sections.map(section=>({question:section.title,answer:<>{section.blocks.map((block,index)=>
  block.type==='heading'?<h3 key={index}>{block.text}</h3>:
  block.type==='list'?<ul key={index} style={{paddingLeft:24}}>{block.items?.map(item=><li key={item}>{inline(item)}</li>)}</ul>:
  <p key={index}>{inline(block.text??'')}</p>)}</>}))}/>;
}
