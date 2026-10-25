import React from 'react';
import FAQ from './FAQ';
import {useLang} from '../context/LanguageContext';
import policy from '../content/termsPolicy.json';
const labels={
 ru:{title:'Terms and Conditions — Условия использования',date:'Дата вступления в силу: 30 октября 2026 г.',jurisdiction:'Юрисдикция: Англия и Уэльс, Соединённое Королевство'},
 en:{title:'Terms and Conditions',date:'Effective date: 30 October 2026',jurisdiction:'Jurisdiction: England and Wales, United Kingdom'},
 de:{title:'Allgemeine Nutzungsbedingungen',date:'Gültig ab: 30. Oktober 2026',jurisdiction:'Gerichtsstand: England und Wales, Vereinigtes Königreich'},
 fr:{title:'Conditions générales d’utilisation',date:'Date d’entrée en vigueur : 30 octobre 2026',jurisdiction:'Juridiction : Angleterre et pays de Galles, Royaume-Uni'},
};
export default function TermsAndConditions(){
 const {lang}=useLang();const key=lang.toLowerCase() as keyof typeof labels;const language=Object.prototype.hasOwnProperty.call(labels,key)?key:'en';const t=labels[language];
 const sections:{title:string;blocks:{type:string;text?:string;items?:string[]}[]}[]=policy.rules[language];
 return <FAQ lang={language} title={t.title} introduction={<>
  <p style={{color:'var(--text-secondary)',lineHeight:1.6}}>{t.date}</p>
  <p style={{color:'var(--text-secondary)',lineHeight:1.6,marginBottom:24}}>{t.jurisdiction}</p>
 </>} items={sections.map(section=>({question:section.title,answer:<>{section.blocks.map((block,index)=>
  block.type==='heading'?<h3 key={index}>{block.text}</h3>:
  block.type==='definition'?<p key={index}><strong>{block.text}</strong></p>:
  block.type==='list'?<ul key={index} style={{paddingLeft:24}}>{block.items?.map(item=><li key={item}>{item}</li>)}</ul>:
  <p key={index}>{block.text}</p>)}</>}))}/>;
}
