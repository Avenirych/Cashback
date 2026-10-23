import {useEffect, useId, useRef, useState} from 'react';
import {Section, Locale} from '../content/siteContent';
import './Information.css';

/** Shared FAQ pattern: one open panel, keyboard navigation and Escape to close. */
export default function InformationAccordion({items, lang}: {items: Section[]; lang: Locale}) {
 const prefix=useId(), root=useRef<HTMLDivElement>(null), buttons=useRef<(HTMLButtonElement|null)[]>([]);
 const [open,setOpen]=useState<string|null>(null);
 useEffect(()=>{const reveal=()=>{const hash=window.location.hash.slice(1),id=hash==='privacySection11'?'rights':hash==='privacySection12'?'choices':hash;setOpen(items.some(item=>item.id===id)?id:null);};reveal();window.addEventListener('hashchange',reveal);return()=>window.removeEventListener('hashchange',reveal);},[lang,items]);
 useEffect(()=>{const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!root.current?.contains(e.target))setOpen(null);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 return <div className="information-accordion" ref={root}>{items.map((item,index)=>{
  const expanded=open===item.id, question=`${prefix}-${item.id}-q`, answer=`${prefix}-${item.id}-a`;
  return <section id={item.id==='rights'?'privacySection11':item.id==='choices'?'privacySection12':item.id} className="information-card" key={item.id}><h2><button ref={el=>{buttons.current[index]=el;}} id={question} type="button" aria-expanded={expanded} aria-controls={answer} onClick={()=>setOpen(expanded?null:item.id)} onKeyDown={e=>{
   if(e.key==='Escape'){setOpen(null);buttons.current[index]?.focus();e.preventDefault();}
   const next=e.key==='ArrowDown'?(index+1)%items.length:e.key==='ArrowUp'?(index+items.length-1)%items.length:e.key==='Home'?0:e.key==='End'?items.length-1:null;
   if(next!==null){e.preventDefault();buttons.current[next]?.focus();}
  }}>{item.title[lang]}<span aria-hidden="true">{expanded?'−':'+'}</span></button></h2>
  <div id={answer} role="region" aria-labelledby={question} hidden={!expanded} className="information-answer">{item.body[lang]}</div></section>;
 })}</div>;
}
