import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useLang} from '../context/LanguageContext';
import ActivityLimits from '../components/ActivityLimits';
import ModerationCenter from './ModerationCenter';
import content from '../content/myActivity.json';
import profileContent from '../content/profilePresentation.json';
import './Profile.css';
import './MyActivity.css';

export default function MyActivity() {
 const {user,token}=useAuth();
 const {lang}=useLang();
 const language=lang.toLowerCase() as keyof typeof content;
 const t=content[language]||content.en;
 const copy=profileContent[language]||profileContent.en;
 const [appealTarget,setAppealTarget]=useState<HTMLDivElement|null>(null);
 const enabled=process.env.REACT_APP_ACTIVITY_LIMITS==='true';
 const demo=process.env.REACT_APP_DEMO_ONLY==='true';
 if(!user||!token)return null; // AppRoutes uses the existing ProtectedGuard.
 return <main className="profile-container my-activity-page" lang={language} aria-labelledby="my-activity-title">
  <header className="profile-intro"><h1 id="my-activity-title">{t.title}</h1></header>
  <section className="profile-section" id="my-activity-limits" aria-labelledby="my-activity-limits-title">
   <h2 id="my-activity-limits-title">{copy.limits}</h2>
   {copy.limitsText.map(text=><p key={text}>{text}</p>)}
   <ActivityLimits key={user.id} token={token} lang={lang} embedded hideHeading showDemoControls={false} separateAppeal appealTarget={appealTarget}/>
   {!enabled&&<p role="status">{copy.limitsUnavailable}</p>}
  </section>
  <section className="profile-section" id="my-activity-restrictions" aria-labelledby="my-activity-restrictions-title">
   <h2 id="my-activity-restrictions-title">{t.restrictions}</h2>
   {copy.appealsText.map(text=><p key={text}>{text}</p>)}
   <Link to="/forum/moderation">{copy.moderation}</Link>
   {demo?<p role="status">{t.moderationUnavailable}</p>:<ModerationCenter key={user.id} embedded/>}
   <div ref={setAppealTarget}/>
   {!enabled&&<p>{copy.appealsUnavailable}</p>}
   <Link to="/contacts">{copy.support}</Link>
  </section>
 </main>;
}
