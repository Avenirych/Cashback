import React, {useEffect, useRef} from 'react';
import './CookieConsent.css';
import {useLang} from '../context/LanguageContext';
import {cookieMessages} from '../content/cookieMessages';
import {CookieChoices as Choices} from '../cookieConsent';
export function CookieChoices({value,onChange}:{value:Choices;onChange:(value:Choices)=>void}) {
 const {lang}=useLang(),t=cookieMessages[lang as keyof typeof cookieMessages] ?? cookieMessages.en;
 return <div className="cookie-choices">
  <p><strong>{t.necessary}</strong><br/>{t.necessaryDescription}</p>
  <label className="cookie-setting"><input type="checkbox" role="switch" checked={value.analytics} onChange={e=>onChange({...value,analytics:e.target.checked})}/>{t.analytics}</label>
  <label className="cookie-setting"><input type="checkbox" role="switch" checked={value.marketing} onChange={e=>onChange({...value,marketing:e.target.checked})}/>{t.marketing}</label>
  {!value.marketing&&<p className="cookie-warning">{t.trackingWarning}</p>}
 </div>;
}
interface Props {value:Choices;onChange:(value:Choices)=>void;onSave:(value:Choices)=>void;onClose:()=>void;error:boolean}
export default function CookieSettingsModal({value,onChange,onSave,onClose,error}:Props) {
 const {lang}=useLang(),t=cookieMessages[lang as keyof typeof cookieMessages] ?? cookieMessages.en;
 const dialog=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.focus();return ()=>{if(previous?.isConnected)previous.focus();};},[]);
 return <div className="cookie-modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div ref={dialog} tabIndex={-1} className="cookie-modal" lang={lang} role="dialog" aria-modal="true" aria-label={t.settings} onKeyDown={e=>{
   if(e.key==='Escape'){e.stopPropagation();onClose();}
   if(e.key==='Tab'){
    const nodes=dialog.current?.querySelectorAll<HTMLElement>('input,button');if(!nodes?.length)return;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first.focus();}
   }
  }}>
   <h2>{t.settings}</h2><p>{t.settingsDescription}</p><CookieChoices value={value} onChange={onChange}/>
   {error&&<p role="alert">{t.saveError}</p>}
   <div className="cookie-buttons">
    <button type="button" onClick={()=>onSave(value)}>{t.save}</button>
    <button type="button" onClick={()=>onSave({analytics:false,marketing:false})}>{t.decline}</button>
    <button type="button" onClick={()=>onSave({analytics:true,marketing:true})}>{t.accept}</button>
    <button type="button" onClick={onClose}>{t.close}</button>
   </div>
  </div>
 </div>;
}
