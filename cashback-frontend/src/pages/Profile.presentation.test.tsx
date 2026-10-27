import React from 'react';
import {render,screen,within,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Profile from './Profile';
import copy from '../content/profilePresentation.json';
import {translations} from '../i18n';
let mockLang='ru';
const account={id:424242,name:'Fixture User',email:'fixture@example.test',email_verified:true,balance:'123.45',phone_e164:'+442079460123'};
let mockAuth:any;
let profile:any;
let preferences:any;
jest.mock('../context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLang})}));
const oldDemo=process.env.REACT_APP_DEMO_ONLY,oldActivity=process.env.REACT_APP_ACTIVITY_LIMITS;
beforeEach(()=>{
 localStorage.clear();sessionStorage.clear();mockLang='ru';profile={...account};
 mockAuth={user:{...account},token:'synthetic-profile-session',loading:false};
 process.env.REACT_APP_DEMO_ONLY='true';process.env.REACT_APP_ACTIVITY_LIMITS='true';
 preferences={userId:account.id,accountUpdates:true,specialOffers:false,partnerRecommendations:false,smsMarketing:false,createdAt:null,updatedAt:null,smsMarketingGrantedAt:null,smsMarketingRevokedAt:null,smsMarketingConsentVersion:null};
 global.fetch=jest.fn(async(url,init)=>{
  const path=String(url);
  if(path.endsWith('/auth/profile'))return {ok:true,json:async()=>profile};
  if(path.endsWith('/user/marketing-preferences')){
   if(init?.method==='POST')preferences={...preferences,...JSON.parse(init.body as string)};
   return {ok:true,json:async()=>preferences};
  }
  if(path.endsWith('/activity/me'))return {ok:true,json:async()=>({mode:'demo',plan:{plan:'FREE'},limits:[{action:'video',period:'day',used:12,reserved:1,maximum:50,remaining:37,resetAt:'2026-11-01T00:00:00Z'}]})};
  if(path.endsWith('/activity/appeals'))return {ok:true,json:async()=>({})};
  throw Error('Unexpected mocked request');
 }) as jest.Mock;
});
afterAll(()=>{for(const [k,v] of Object.entries({REACT_APP_DEMO_ONLY:oldDemo,REACT_APP_ACTIVITY_LIMITS:oldActivity})){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
function mount(){return render(<MemoryRouter><Profile/></MemoryRouter>);}
test.each(['ru','en','de','fr'] as const)('%s: exact section order, complete copy and genuine legacy balance without a currency claim',async lang=>{
 mockLang=lang;const c=copy[lang];const v=mount();await screen.findByRole('button',{name:copy[mockLang as keyof typeof copy].edit});
 expect(Array.from(v.container.querySelectorAll('main > section > h2'),e=>e.textContent)).toEqual([c.personal,c.security,c.marketing,c.partner,c.rewards,c.tax,c.deletion,c.demo]);
 for(const text of [...c.upper,...c.marketingText,...c.partnerText,...c.taxText,...c.demoText])expect(screen.getByText(text)).toBeInTheDocument();
 expect(screen.getByTestId('profile-balance')).toHaveTextContent('123.45');
 expect(v.container.querySelector('.profile-reward-amount')!.textContent).not.toMatch(/£|GBP/);
 expect(screen.getByText(c.rewardNote)).toBeInTheDocument();
 expect(v.container.querySelector('#profile-partners input')).toBeNull();
 expect(within(document.getElementById('profile-partners')!).getByRole('link',{name:c.manageMarketing})).toHaveAttribute('href','#profile-marketing');
 expect(v.container.querySelector('#profile-tax input')).toBeNull();
 expect(v.container.querySelector('#profile-tax form')).toBeNull();
 expect(v.container.querySelector('#profile-limits')).toBeNull();
 expect(v.container.querySelector('#profile-appeals')).toBeNull();
 expect((fetch as jest.Mock).mock.calls.some(([u])=>String(u).includes('/activity/'))).toBe(false);
});

test.each([undefined,null,NaN,Infinity,'', 'invalid'])('missing/invalid balance %p is unavailable rather than a fabricated zero',async value=>{
 profile.balance=value;mockAuth.user.balance=value;mount();
 expect(await screen.findByText(copy.ru.balanceUnavailable)).toBeInTheDocument();
 expect(screen.getByTestId('profile-balance')).not.toHaveTextContent('0.00');
});
test('unavailable login history never substitutes registration or an unknown API field; tax flags do not create an unsupported form',async()=>{
 profile={...profile,created_at:'2020-01-02T03:04:05Z',last_login_at:'2026-09-08T12:34:56Z',w8ben_required:true};
 const v=mount();await screen.findByRole('button',{name:copy[mockLang as keyof typeof copy].edit});
 const security=document.getElementById('profile-security')!;
 expect(within(security).getByText(copy.ru.historyUnavailable)).toBeInTheDocument();
 expect(security.textContent).not.toMatch(/2020|2026|03:04|12:34/);
 expect(v.container.querySelector('#profile-tax input')).toBeNull();
 expect(screen.getByText(copy.ru.taxUnavailable)).toBeInTheDocument();
});
test('support/deletion are real official mail channels, not an inert delete action',()=>{
 mount();const d=document.getElementById('profile-deletion')!;
 expect(within(d).getByRole('link',{name:copy.ru.deleteRequest})).toHaveAttribute('href','mailto:privacy@cashbackplus.uk');
 expect(within(d).getByRole('link',{name:copy.ru.privacy})).toHaveAttribute('href','/privacy');
 expect(d.querySelector('button')).toBeNull();
 expect(within(document.getElementById('profile-security')!).getByRole('link',{name:copy.ru.support})).toHaveAttribute('href','mailto:support@cashbackplus.uk');
 expect((fetch as jest.Mock).mock.calls.every(([,o])=>!o.method||o.method==='GET')).toBe(true);
});
test('demo section is conditional and developer quota buttons are hidden even when server quota mode is demo',async()=>{
 process.env.REACT_APP_DEMO_ONLY='false';mount();await screen.findByRole('button',{name:copy[mockLang as keyof typeof copy].edit});
 expect(document.getElementById('profile-demo')).toBeNull();
 expect(screen.queryByText(/Тест лимита без начисления/)).toBeNull();
});
test('Profile no longer mounts activity or appeals even when the activity feature is disabled',()=>{
 process.env.REACT_APP_ACTIVITY_LIMITS='false';mount();
 expect(document.querySelector('#profile-limits')).toBeNull();
 expect(document.querySelector('#profile-appeals')).toBeNull();
 expect((fetch as jest.Mock).mock.calls.some(([u])=>String(u).includes('/activity/'))).toBe(false);
});
test.each(['ru','en','de','fr'] as const)('%s marketing/partner controls retain opt-in, service notices, localized editing and withdrawal',async lang=>{
 mockLang=lang;mount();const c=copy[lang],t=translations[lang.toUpperCase() as keyof typeof translations];
 const edit=await screen.findByRole('button',{name:c.edit});await waitFor(()=>expect(edit).toBeEnabled());edit.focus();fireEvent.click(edit);
 const dialog=screen.getByRole('dialog');expect(dialog).toHaveAttribute('aria-modal','true');
 const choices=within(dialog).getAllByRole('checkbox');expect(choices).toHaveLength(3);choices.forEach(x=>expect(x).not.toBeChecked());
 fireEvent.click(within(dialog).getByRole('checkbox',{name:t.partnerRecommendations}));
 fireEvent.submit(dialog.querySelector('form')!);
 await waitFor(()=>expect((fetch as jest.Mock).mock.calls.some(([u,o])=>String(u).endsWith('/user/marketing-preferences')&&o.method==='POST')).toBe(true));
 const call=(fetch as jest.Mock).mock.calls.find(([u,o])=>String(u).endsWith('/user/marketing-preferences')&&o.method==='POST');
 expect(JSON.parse(call[1].body)).toEqual({specialOffers:false,partnerRecommendations:true});
 expect(call[1].body).not.toContain('accountUpdates');
});
test('marketing dialog closes with Escape and restores the invoking control',async()=>{
 mount();const edit=await screen.findByRole('button',{name:copy.ru.edit});await waitFor(()=>expect(edit).toBeEnabled());edit.focus();fireEvent.click(edit);
 const dialog=screen.getByRole('dialog');expect(dialog).toHaveFocus();
 fireEvent.keyDown(dialog,{key:'Escape'});
 expect(screen.queryByRole('dialog')).toBeNull();expect(edit).toHaveFocus();
});

test('all optional marketing consents can be withdrawn together while mandatory service notifications remain enabled',async()=>{
 preferences={...preferences,specialOffers:true,partnerRecommendations:true,smsMarketing:true};
 mount();const edit=await screen.findByRole('button',{name:copy.ru.edit});await waitFor(()=>expect(edit).toBeEnabled());fireEvent.click(edit);
 const dialog=screen.getByRole('dialog');
 within(dialog).getAllByRole('checkbox').forEach(choice=>{expect(choice).toBeChecked();fireEvent.click(choice);});
 fireEvent.submit(dialog.querySelector('form')!);
 await waitFor(()=>expect((fetch as jest.Mock).mock.calls.some(([u,o])=>String(u).endsWith('/user/marketing-preferences')&&o.method==='POST')).toBe(true));
 const call=(fetch as jest.Mock).mock.calls.find(([u,o])=>String(u).endsWith('/user/marketing-preferences')&&o.method==='POST');
 expect(JSON.parse(call[1].body)).toEqual({specialOffers:false,partnerRecommendations:false,smsMarketing:false});
 expect(preferences.accountUpdates).toBe(true);
});
