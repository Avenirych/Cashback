import React from 'react';
import {render,screen,within,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import MyActivity from './MyActivity';
import Header from '../components/Header';
import ProtectedGuard from '../components/ProtectedGuard';
import content from '../content/myActivity.json';
import profile from '../content/profilePresentation.json';
import {activityCopy} from '../components/ActivityLimits';
let mockLang='ru',mockAuth:any,mockFail=false;
jest.mock('../context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLang,setLang:jest.fn()})}));
jest.mock('../components/SiteSearch',()=>()=>null);
const oldActivity=process.env.REACT_APP_ACTIVITY_LIMITS,oldDemo=process.env.REACT_APP_DEMO_ONLY;
beforeEach(()=>{
 mockLang='ru';mockFail=false;mockAuth={user:{id:424242,name:'Fixture',email:'fixture@example.test',email_verified:true},token:'synthetic-session',loading:false,isEmailVerificationPending:false};
 process.env.REACT_APP_ACTIVITY_LIMITS='true';process.env.REACT_APP_DEMO_ONLY='true';
 global.fetch=jest.fn(async(url,init)=>{
  const path=String(url);
  if(path.endsWith('/activity/me'))return {ok:!mockFail,json:async()=>({mode:'demo',plan:{plan:'FREE'},limits:[{action:'video',period:'day',used:12,reserved:1,maximum:50,remaining:37,resetAt:'2026-11-01T00:00:00Z'}]})};
  if(path.endsWith('/activity/appeals'))return {ok:true,json:async()=>({})};
  if(path.endsWith('/moderation/mine'))return {ok:true,json:async()=>({restriction:{level:2,blocked:true,until:'2026-11-23'},cases:[{id:7,kind:'post',target_id:11,state:'confirmed',confirmed_at:'2026-10-23'}],notifications:[{id:1,case_id:7,action:'confirm',reason:'Synthetic decision reason'}]})};
  if(path.endsWith('/moderation/queue'))return {ok:false,status:403};
  if(path.endsWith('/7/appeal'))return {ok:true};
  throw Error('Unexpected request '+path);
 }) as jest.Mock;
});
afterAll(()=>{for(const [key,value] of Object.entries({REACT_APP_ACTIVITY_LIMITS:oldActivity,REACT_APP_DEMO_ONLY:oldDemo})){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
function mount(path='/my-activity'){return render(<MemoryRouter initialEntries={[path]}><Header/><Routes><Route element={<ProtectedGuard/>}><Route path="/my-activity" element={<MyActivity/>}/></Route><Route path="/register" element={<h1>Guest registration</h1>}/><Route path="/verify-email" element={<h1>Verify email</h1>}/></Routes></MemoryRouter>);}
test.each(['ru','en','de','fr'] as const)('%s retains limits, explanations, separate appeal and existing navigation',async lang=>{
 mockLang=lang;const v=mount();const c=content[lang],p=profile[lang],t=activityCopy[lang];
 expect(await screen.findByRole('cell',{name:'12'})).toBeVisible();
 expect(screen.getByRole('heading',{level:1,name:c.title})).toBeVisible();
 expect(Array.from(v.container.querySelectorAll('main > section > h2'),e=>e.textContent)).toEqual([p.limits,c.restrictions]);
 for(const text of [...p.limitsText,...p.appealsText])expect(screen.getByText(text)).toBeVisible();
 const limits=document.getElementById('my-activity-limits')!,appeals=document.getElementById('my-activity-restrictions')!;
 expect(within(limits).getAllByRole('heading')).toHaveLength(1);
 expect(within(limits).getByRole('table')).toHaveTextContent('37');
 expect(limits).toHaveTextContent('UTC');
 expect(v.container.querySelectorAll('#my-activity-restrictions form')).toHaveLength(1);
 expect(v.container.querySelector('#my-activity-limits form')).toBeNull();
 expect(screen.queryByText(new RegExp(t.test))).toBeNull();
 expect(screen.getByText(c.moderationUnavailable)).toBeVisible();
 expect(within(appeals).getByRole('link',{name:p.moderation})).toHaveAttribute('href','/forum/moderation');
 expect((fetch as jest.Mock).mock.calls.some(([u])=>String(u).includes('/moderation/'))).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:/Fixture/}));
 expect(screen.getByRole('link',{name:c.title})).toHaveAttribute('href','/my-activity');
});
test('guests use the existing protected redirect and never request activity data',()=>{
 mockAuth.user=null;mockAuth.token=null;mount();
 expect(screen.getByRole('heading',{name:'Guest registration'})).toBeVisible();expect(fetch).not.toHaveBeenCalled();
});
test('unverified users keep email verification guard',()=>{
 mockAuth.user.email_verified=false;mount();expect(screen.getByRole('heading',{name:'Verify email'})).toBeVisible();expect(fetch).not.toHaveBeenCalled();
});
test('loading auth does not mount protected activity',()=>{
 mockAuth.loading=true;mount();expect(document.querySelector('.my-activity-page')).toBeNull();expect(fetch).not.toHaveBeenCalled();
});

test('disabled limits show unavailable support, not fabricated table or API appeal',()=>{
 process.env.REACT_APP_ACTIVITY_LIMITS='false';mount();
 expect(screen.getByText(profile.ru.limitsUnavailable)).toBeVisible();
 expect(screen.getByText(profile.ru.appealsUnavailable)).toBeVisible();
 expect(screen.queryByRole('table')).toBeNull();expect(document.querySelector('main form')).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
test('API failure is an error; refresh retries the existing owned GET',async()=>{
 mockFail=true;mount();expect(await screen.findByRole('alert')).toHaveTextContent(activityCopy.ru.error);
 expect(screen.queryByRole('table')).toBeNull();
 mockFail=false;fireEvent.click(screen.getByRole('button',{name:activityCopy.ru.retry}));
 expect(await screen.findByRole('cell',{name:'12'})).toBeVisible();
 const calls=(fetch as jest.Mock).mock.calls.filter(([u])=>String(u).endsWith('/activity/me'));expect(calls).toHaveLength(2);expect(calls[1][1].headers.Authorization).toBe('Bearer synthetic-session');
});
test('moved activity appeal preserves reason validation and authenticated body without user IDs',async()=>{
 mount();await screen.findByRole('cell',{name:'12'});
 const area=screen.getByRole('textbox',{name:activityCopy.ru.appeal});
 expect(area).toHaveAttribute('required');expect(area).toHaveAttribute('minlength','10');expect(area).toHaveAttribute('maxlength','1000');
 fireEvent.change(area,{target:{value:'Please review this unexpected restriction.'}});
 fireEvent.submit(area.closest('form')!);
 expect(await screen.findByText(activityCopy.ru.sent)).toBeVisible();
 const call=(fetch as jest.Mock).mock.calls.find(([u])=>String(u).endsWith('/activity/appeals'));
 expect(JSON.parse(call[1].body)).toEqual({reason:'Please review this unexpected restriction.'});
 expect(call[1].headers.Authorization).toBe('Bearer synthetic-session');
});
test.each(['ru','en','de','fr'] as const)('%s non-demo preserves existing disciplinary restrictions, localized notices and case appeal',async lang=>{
 process.env.REACT_APP_DEMO_ONLY='false';mockLang=lang;mount();
 expect(await screen.findByText('Synthetic decision reason',{exact:false})).toBeVisible();
 expect(screen.getByText(content[lang].actions.confirm,{exact:false})).toBeVisible();
 expect(screen.getByText('2026-11-23')).toBeVisible();expect(screen.getByText(content[lang].yes)).toBeVisible();
 expect(document.querySelectorAll('main')).toHaveLength(1);
 const review=require('../content/reviewMessages.json')[lang];
 const reason=screen.getByLabelText(review.reason);
 fireEvent.change(reason,{target:{value:'Please independently reconsider this decision'}});
 fireEvent.click(screen.getByRole('button',{name:review.appeal}));
 await waitFor(()=>expect((fetch as jest.Mock).mock.calls.some(([u,o])=>String(u).endsWith('/7/appeal')&&o.method==='POST')).toBe(true));
 const call=(fetch as jest.Mock).mock.calls.find(([u])=>String(u).endsWith('/7/appeal'));
 expect(JSON.parse(call[1].body)).toEqual({reason:'Please independently reconsider this decision'});
 expect(screen.queryByText(review.queue)).toBeNull();
});
