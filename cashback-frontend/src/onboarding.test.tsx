import React from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import {AppRoutes} from './App';
import {useAuth} from './context/AuthContext';
import {LanguageProvider} from './context/LanguageContext';
import BonusGuard from './components/BonusGuard';
import Profile,{messages} from './pages/Profile';
import Welcome from './pages/Welcome';
import {translations} from './i18n';
import {emptyWiseForm,enrollmentKey,enrollInProgram,getOnboardingMessages,readOnboarding,saveCredentials,useOnboarding,wiseKey} from './onboarding';
jest.mock('./context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('./components/Header',()=>()=>null);
jest.mock('./components/CookieConsent',()=>()=>null);
const mockAuth=useAuth as jest.Mock;
const user={id:101,name:'Demo User',email:'demo@example.test',email_verified:true};
const form={fullName:user.name,email:user.email,wiseEmail:'wise@example.test',currency:'GBP',accountType:'Business'};
const saved={...form,userId:user.id,savedAt:'2026-10-06T10:30:00Z'};
function auth(current:unknown=user,loading=false){mockAuth.mockReturnValue({user:current,loading,token:null,isEmailVerificationPending:false});}
function Location(){return <output data-testid="location">{useLocation().pathname}</output>}
function State(){return <output data-testid="eligible">{String(useOnboarding().eligible)}</output>}
function wrapper(children:React.ReactNode,path='/'){return <LanguageProvider><MemoryRouter initialEntries={[path]}>{children}<Location/></MemoryRouter></LanguageProvider>}
function gate(){return <Routes><Route element={<BonusGuard/>}><Route path="/participate" element={<p>Protected participation</p>}/></Route><Route path="/profile" element={<p>Profile required</p>}/><Route path="/register" element={<p>Registration required</p>}/><Route path="/verify-email" element={<p>Email required</p>}/></Routes>}
function seed(data:unknown,enrolled:unknown={userId:user.id,enrolledAt:saved.savedAt}){localStorage.setItem(wiseKey,typeof data==='string'?data:JSON.stringify(data));localStorage.setItem(enrollmentKey,JSON.stringify(enrolled));}
function fill(){for(const key of Object.keys(form) as (keyof typeof form)[])fireEvent.change(screen.getByLabelText(messages.en[key]),{target:{value:form[key]}});}
beforeEach(()=>{localStorage.clear();sessionStorage.clear();auth();global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>[]}) as typeof fetch;});
afterEach(()=>jest.restoreAllMocks());

// Later historical public browsing supersedes the earlier Welcome gate. Validation
// still applies to helpers and protected participation; it is not removed to pass tests.
test.each([
 ['empty',null],['partial',{userId:user.id,fullName:form.fullName}],['invalid email',{...saved,wiseEmail:'bad'}],
 ['invalid currency',{...saved,currency:'CAD'}],['invalid account type',{...saved,accountType:'Other'}],
 ['non-string field',{...saved,email:42}],['missing saved marker',{...saved,savedAt:undefined}],
 ['invalid saved marker',{...saved,savedAt:'bad'}],['corrupt JSON','not-json'],['array',[]],
 ['other owner',{...saved,userId:102}],['no owner',{...saved,userId:undefined}]
])('%s credentials never authorize protected participation despite an old enrollment',(_name,data)=>{
 seed(data);expect(readOnboarding(user.id).eligible).toBe(false);
 render(wrapper(gate(),'/participate'));expect(screen.getByTestId('location')).toHaveTextContent('/profile');
 expect(screen.queryByText('Protected participation')).not.toBeInTheDocument();
 expect(()=>enrollInProgram(user.id)).toThrow();
});
test.each([undefined,null,0,-1,NaN,Infinity,1.5,'101'])('invalid user identity %p cannot save or access protected bonuses',id=>{
 seed({...saved,userId:id},{userId:id,enrolledAt:saved.savedAt});auth({...user,id});
 expect(readOnboarding(id).eligible).toBe(false);expect(()=>saveCredentials(id,form)).toThrow();expect(()=>enrollInProgram(id)).toThrow();
 render(wrapper(gate(),'/participate'));expect(screen.queryByText('Protected participation')).not.toBeInTheDocument();
});
test('typing does not enroll; saving and explicit enrollment update the production hook',()=>{
 render(wrapper(<><Profile/><State/></>));fill();
 expect(screen.getByTestId('eligible')).toHaveTextContent('false');
 expect(screen.getByRole('button',{name:messages.en.enroll})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:messages.en.saveCredentials}));
 expect(readOnboarding(user.id).credentialsSaved).toBe(true);expect(localStorage.getItem(enrollmentKey)).toBeNull();
 expect(screen.getByTestId('eligible')).toHaveTextContent('false');
 fireEvent.click(screen.getByRole('button',{name:messages.en.enroll}));expect(screen.getByTestId('eligible')).toHaveTextContent('true');
 expect(global.fetch).not.toHaveBeenCalled();
});
test.each(['en','ru','de','fr'])('public Welcome retains localized %s browsing without granting enrollment',lang=>{
 render(wrapper(<Welcome lang={lang}/>));
 const t=translations[lang.toUpperCase() as keyof typeof translations];
 const button=screen.getByRole('button',{name:t.getBonuses});expect(button).toBeEnabled();
 fireEvent.click(button);expect(screen.getByTestId('location')).toHaveTextContent('/bonuses');
 expect(readOnboarding(user.id).eligible).toBe(false);expect(getOnboardingMessages(lang).explanation.length).toBeGreaterThan(20);
});
test.each(['/bonuses','/bonuses/ads','/bonuses/research'])('direct %s permits public browsing, not onboarding',path=>{
 render(wrapper(<AppRoutes/>,path));expect(screen.getByTestId('location')).toHaveTextContent(path);
 expect(readOnboarding(user.id).eligible).toBe(false);expect(localStorage.getItem(enrollmentKey)).toBeNull();
});
test.each(['/bonuses','/bonuses/ads','/bonuses/research'])('guests can browse %s without creating an account or enrollment',path=>{
 auth(null);render(wrapper(<AppRoutes/>,path));expect(screen.getByTestId('location')).toHaveTextContent(path);
 expect(localStorage.getItem(enrollmentKey)).toBeNull();expect(global.fetch).not.toHaveBeenCalled();
});
test.each(['/bonuses','/bonuses/ads','/bonuses/research'])('eligible owner may refresh %s without losing eligibility',path=>{
 seed(saved);const view=render(wrapper(<AppRoutes/>,path));expect(readOnboarding(user.id).eligible).toBe(true);
 view.unmount();render(wrapper(<AppRoutes/>,path));expect(screen.getByTestId('location')).toHaveTextContent(path);expect(readOnboarding(user.id).eligible).toBe(true);
});
test('public shopping and bonus links do not bypass the participation gate',()=>{
 const view=render(wrapper(<Welcome lang="en"/>));fireEvent.click(screen.getByRole('button',{name:'Go shopping'}));expect(screen.getByTestId('location')).toHaveTextContent('/shop');
 view.unmount();render(wrapper(gate(),'/participate'));expect(screen.getByTestId('location')).toHaveTextContent('/profile');
});
test('storage revoked before a protected route render cannot grant access',()=>{
 seed(saved);localStorage.removeItem(wiseKey);render(wrapper(gate(),'/participate'));expect(screen.queryByText('Protected participation')).not.toBeInTheDocument();
});
test('invalid old enrollment requires fresh enrollment after credential repair',()=>{
 seed({...saved,email:'bad'});render(wrapper(<><Profile/><State/></>));fill();
 fireEvent.click(screen.getByRole('button',{name:messages.en.saveCredentials}));expect(readOnboarding(user.id).eligible).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:messages.en.enroll}));expect(readOnboarding(user.id).eligible).toBe(true);
});
test('corrupt enrollment can be repaired by saving and explicitly enrolling',()=>{
 localStorage.setItem(enrollmentKey,'corrupt');saveCredentials(user.id,form);expect(readOnboarding(user.id).eligible).toBe(false);enrollInProgram(user.id);expect(readOnboarding(user.id).eligible).toBe(true);
});
test('account switch, logout and return never inherit another account eligibility',()=>{
 seed(saved);const view=render(wrapper(<State/>));expect(screen.getByTestId('eligible')).toHaveTextContent('true');
 auth({...user,id:102});view.rerender(wrapper(<State/>));expect(screen.getByTestId('eligible')).toHaveTextContent('false');
 auth(null);view.rerender(wrapper(<State/>));expect(screen.getByTestId('eligible')).toHaveTextContent('false');
 auth();view.rerender(wrapper(<State/>));expect(screen.getByTestId('eligible')).toHaveTextContent('true');expect(readOnboarding(102).eligible).toBe(false);
});
test('scoped records take precedence over stale unscoped data from another account',()=>{
 saveCredentials(user.id,form);enrollInProgram(user.id);seed({...saved,userId:102},{userId:102,enrolledAt:saved.savedAt});
 expect(readOnboarding(user.id).eligible).toBe(true);expect(readOnboarding(103).eligible).toBe(false);
 localStorage.setItem(`${wiseKey}:${user.id}`,'corrupt');expect(readOnboarding(user.id).eligible).toBe(false);
});
test('repairing one scoped record never deletes another owner enrollment',()=>{
 localStorage.setItem(enrollmentKey,JSON.stringify({userId:102,enrolledAt:saved.savedAt}));localStorage.setItem(`${enrollmentKey}:${user.id}`,JSON.stringify({userId:user.id,enrolledAt:saved.savedAt}));
 saveCredentials(user.id,form);expect(JSON.parse(localStorage.getItem(enrollmentKey)!).userId).toBe(102);expect(readOnboarding(user.id).eligible).toBe(false);
});
test('storage events revoke access on an already mounted protected route',()=>{
 seed(saved);render(wrapper(gate(),'/participate'));expect(screen.getByText('Protected participation')).toBeInTheDocument();
 act(()=>{localStorage.removeItem(wiseKey);window.dispatchEvent(new StorageEvent('storage',{key:wiseKey}));});
 expect(screen.getByTestId('location')).toHaveTextContent('/profile');expect(screen.queryByText('Protected participation')).not.toBeInTheDocument();
});
test('save, enrollment and storage clearing update the mounted production hook',()=>{
 render(wrapper(<State/>));act(()=>saveCredentials(user.id,form));expect(screen.getByTestId('eligible')).toHaveTextContent('false');
 act(()=>enrollInProgram(user.id));expect(screen.getByTestId('eligible')).toHaveTextContent('true');
 act(()=>{localStorage.clear();window.dispatchEvent(new StorageEvent('storage',{key:null}));});expect(screen.getByTestId('eligible')).toHaveTextContent('false');
});
test('read and write failures fail closed and helper recovery is explicit',()=>{
 seed(saved);const read=jest.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('denied')});
 expect(readOnboarding(user.id).eligible).toBe(false);expect(()=>enrollInProgram(user.id)).toThrow();read.mockRestore();localStorage.clear();
 const write=jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('full')});
 expect(()=>saveCredentials(user.id,form)).toThrow();expect(readOnboarding(user.id).eligible).toBe(false);write.mockRestore();
 saveCredentials(user.id,form);const enrollment=jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('full')});
 expect(()=>enrollInProgram(user.id)).toThrow();expect(readOnboarding(user.id).eligible).toBe(false);enrollment.mockRestore();enrollInProgram(user.id);expect(readOnboarding(user.id).eligible).toBe(true);
});
test('partial enrollment write rolls back and never survives refresh',()=>{
 saveCredentials(user.id,form);const original=Storage.prototype.setItem;
 jest.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,key:string,value:string){if(key===enrollmentKey)throw Error('full');original.call(this,key,value)});
 expect(()=>enrollInProgram(user.id)).toThrow();expect(localStorage.getItem(`${enrollmentKey}:${user.id}`)).toBeNull();expect(readOnboarding(user.id).eligible).toBe(false);
 render(wrapper(gate(),'/participate'));expect(screen.queryByText('Protected participation')).not.toBeInTheDocument();
});
test('loading session never renders protected participation or redirects prematurely',()=>{
 seed(saved);auth(user,true);const view=render(wrapper(gate(),'/participate'));expect(screen.queryByText('Protected participation')).not.toBeInTheDocument();expect(screen.getByTestId('location')).toHaveTextContent('/participate');
 auth();view.rerender(wrapper(gate(),'/participate'));expect(screen.getByText('Protected participation')).toBeInTheDocument();
});
test('guests must register for actual participation even though public browsing is enabled',()=>{
 auth(null);render(wrapper(gate(),'/participate'));expect(screen.getByTestId('location')).toHaveTextContent('/register');
});
test('unverified users cannot participate even with saved enrollment',()=>{
 seed(saved);auth({...user,email_verified:false});render(wrapper(gate(),'/participate'));expect(screen.getByTestId('location')).toHaveTextContent('/verify-email');
});
test('invalid form cannot be saved or enrolled through direct helper calls',()=>{
 expect(()=>saveCredentials(user.id,emptyWiseForm)).toThrow();expect(()=>enrollInProgram(user.id)).toThrow();
});
test('Profile displays save and enrollment storage errors, preserves fail-closed state and supports retry',()=>{
 render(wrapper(<Profile/>));fill();
 const failedSave=jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('full')});
 fireEvent.click(screen.getByRole('button',{name:messages.en.saveCredentials}));
 expect(screen.getByText(messages.en.storageError)).toBeInTheDocument();expect(readOnboarding(user.id).eligible).toBe(false);
 failedSave.mockRestore();fireEvent.click(screen.getByRole('button',{name:messages.en.saveCredentials}));
 expect(readOnboarding(user.id).credentialsSaved).toBe(true);
 const failedEnrollment=jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('full')});
 fireEvent.click(screen.getByRole('button',{name:messages.en.enroll}));
 expect(screen.getByText(messages.en.storageError)).toBeInTheDocument();expect(readOnboarding(user.id).eligible).toBe(false);
 failedEnrollment.mockRestore();fireEvent.click(screen.getByRole('button',{name:messages.en.enroll}));
 expect(readOnboarding(user.id).eligible).toBe(true);
});
