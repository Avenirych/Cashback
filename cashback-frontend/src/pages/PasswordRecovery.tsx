import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useLang} from '../context/LanguageContext';
import {validateEmail} from '../utils/emailValidator';
import {passwordText,passwordLanguage,passwordRequest,validNewPassword,PasswordFailure,PasswordError} from '../passwordApi';
import {captureRecoveryToken,clearRecoveryToken} from '../passwordRecoveryToken';
import './Login.css';
export default function PasswordRecovery({mode}:{mode:'request'|'confirm'|'change'}){
 const {lang}=useLang(),t=passwordText(lang),navigate=useNavigate();
 const {token,clearSessionAfterPasswordChange}=useAuth();
 const capability=useRef<string|null>(mode==='confirm'?captureRecoveryToken():null);
 const mounted=useRef(false),flight=useRef(false),spent=useRef(false);
 const [email,setEmail]=useState(''),[current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState('');
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState<PasswordError|'policy'|'mismatch'|'emailInvalid'|null>(null),[blocked,setBlocked]=useState(false);
 useEffect(()=>{mounted.current=true;if(mode==='confirm')clearRecoveryToken();return()=>{mounted.current=false;};},[mode]);
 const title=mode==='request'?t.recovery:mode==='confirm'?t.reset:t.change;
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();if(flight.current||spent.current||blocked)return;setError(null);
  if(mode==='request'&&!validateEmail(email).valid){setError('emailInvalid');return;}
  if(mode!=='request'){
   if(!validNewPassword(next)){setError('policy');return;}
   if(next!==confirm){setError('mismatch');return;}
   if(mode==='confirm'&&!capability.current){setError('invalid');return;}
   if(mode==='change'&&(!token||!current)){setError('auth');return;}
  }
  flight.current=true;setBusy(true);const bearer=token;
  // Consume the in-memory capability locally once at the explicit submit boundary.
  const raw=capability.current;
  if(mode==='confirm'){spent.current=true;capability.current=null;clearRecoveryToken();}
  try{
   await passwordRequest(mode,mode==='request'?{email:email.trim().toLowerCase(),locale:passwordLanguage(lang)}:mode==='confirm'?{token:raw!,newPassword:next}:{currentPassword:current,newPassword:next,locale:passwordLanguage(lang)},bearer||undefined);
   if(!mounted.current)return;
   if(mode==='request'){setDone(true);return;}
   const cleared=!bearer||clearSessionAfterPasswordChange(bearer);
   if(cleared)navigate('/login',{replace:true,state:{passwordUpdated:true}});else setDone(true);
  }catch(e){if(mounted.current){const kind=e instanceof PasswordFailure?e.kind:'uncertain';setError(kind);if(kind==='uncertain'||mode==='confirm')setBlocked(true);}}
  finally{flight.current=false;if(mounted.current){setBusy(false);setCurrent('');setNext('');setConfirm('');}}
 };
 const invalid=mode==='confirm'&&!capability.current&&!busy&&!spent.current;
 const fields=<>
  <h2>{title}</h2>
  {(error||invalid)&&<p role="alert">{t[error||(invalid?'invalid':'generic')]}</p>}
  {done?<p role="status">{mode==='request'?t.neutral:t.success}</p>:<form onSubmit={submit} aria-label={title} aria-busy={busy}>
   {mode==='request'?<label>{t.email}<input type="email" autoComplete="email" required maxLength={320} disabled={busy||blocked} value={email} onChange={e=>setEmail(e.target.value)}/></label>:<>
    {mode==='change'&&<label>{t.current}<input type="password" autoComplete="current-password" required disabled={busy||blocked} value={current} onChange={e=>setCurrent(e.target.value)}/></label>}
    <p id={'password-policy-'+mode}>{t.policy}</p>
    <label>{t.newPassword}<input type="password" autoComplete="new-password" required aria-describedby={'password-policy-'+mode} disabled={busy||blocked||invalid} value={next} onChange={e=>setNext(e.target.value)}/></label>
    <label>{t.confirm}<input type="password" autoComplete="new-password" required disabled={busy||blocked||invalid} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
   </>}
   <button type="submit" disabled={busy||blocked||invalid}>{busy?t.loading:mode==='request'?t.send:t.save}</button>
  </form>}
  <p><Link to="/login">{t.login}</Link></p>
  {mode!=='request'&&<p><Link to="/forgot-password">{t.again}</Link></p>}
 </>;
 return mode==='change'?<div lang={passwordLanguage(lang)}>{fields}</div>:<main className="login-page" lang={passwordLanguage(lang)}><div className="login-layout"><Link to="/">{t.home}</Link><div className="login-card">{fields}</div></div></main>;
}
