import React, {useState, useEffect} from 'react';
import './CookieConsent.css';
import CookieSettingsModal, {CookieChoices} from './CookieSettingsModal';
import {useLang} from '../context/LanguageContext';
import {cookieMessages} from '../content/cookieMessages';
import {CookieChoices as Choices, readCookieConsent, saveCookieConsent, subscribeCookieConsent, OPEN_COOKIE_SETTINGS} from '../cookieConsent';
export default function CookieConsent() {
 const {lang}=useLang(),t=cookieMessages[lang as keyof typeof cookieMessages] ?? cookieMessages.en;
 const [draft,setDraft]=useState<Choices>(readCookieConsent);
 const [visible,setVisible]=useState(()=>!readCookieConsent().saved);
 const [showSettings,setShowSettings]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{
  const unsubscribe=subscribeCookieConsent(value=>{setDraft(value);setVisible(!value.saved);});
  const open=()=>{setDraft(readCookieConsent());setError(false);setShowSettings(true);};
  window.addEventListener(OPEN_COOKIE_SETTINGS,open);
  return ()=>{unsubscribe();window.removeEventListener(OPEN_COOKIE_SETTINGS,open);};
 },[]);
 const save=(value:Choices)=>{const success=saveCookieConsent(value);setError(!success);if(success){setVisible(false);setShowSettings(false);}};
 return <>
  {visible&&!showSettings&&<div className="cookie-window" lang={lang} role="region" aria-label={t.title}>
   <h3>{t.title}</h3><p className="cookie-text">{t.description}</p><CookieChoices value={draft} onChange={setDraft}/>
   {error&&<p role="alert">{t.saveError}</p>}
   <div className="cookie-buttons">
    <button type="button" className="cookie-btn-necessary" onClick={()=>save(draft)}>{t.save}</button>
    <button type="button" className="cookie-btn-decline" onClick={()=>save({analytics:false,marketing:false})}>{t.decline}</button>
    <button type="button" className="cookie-btn-accept" onClick={()=>save({analytics:true,marketing:true})}>{t.accept}</button>
    <button type="button" className="cookie-btn-settings" onClick={()=>{setDraft(readCookieConsent());setError(false);setShowSettings(true);}}>{t.manage}</button>
   </div>
  </div>}
  {showSettings&&<CookieSettingsModal value={draft} onChange={setDraft} onSave={save} error={error} onClose={()=>{setShowSettings(false);setDraft(readCookieConsent());setError(false);}}/>}
 </>;
}
