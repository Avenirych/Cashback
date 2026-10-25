import {render,act,waitFor,screen,fireEvent,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {COOKIE_STORAGE_KEY,readCookieConsent,saveCookieConsent,subscribeCookieConsent} from './cookieConsent';
import Analytics from './pages/Analytics';
import CookieConsent from './components/CookieConsent';
import Footer from './components/Footer';
import {LanguageProvider} from './context/LanguageContext';
beforeEach(()=>{localStorage.clear();saveCookieConsent({analytics:false,marketing:false});localStorage.clear();global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>[]});});
afterEach(()=>jest.restoreAllMocks());
test.each([[false,false],[true,false],[false,true],[true,true]])('permissions %s/%s persist and gate real Analytics requests',async(analytics,marketing)=>{
 saveCookieConsent({analytics,marketing});expect(readCookieConsent()).toMatchObject({analytics,marketing,saved:true});
 const ui=render(<Analytics/>);await act(async()=>{});expect(fetch).toHaveBeenCalledTimes(analytics?1:0);ui.unmount();
 render(<Analytics/>);await act(async()=>{});expect(fetch).toHaveBeenCalledTimes(analytics?2:0);
});
test('withdrawal aborts pending Analytics and stops new queries',async()=>{
 saveCookieConsent({analytics:true,marketing:false});(fetch as jest.Mock).mockImplementation(()=>new Promise(()=>{}));render(<Analytics/>);
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));const signal=(fetch as jest.Mock).mock.calls[0][1].signal;
 act(()=>{saveCookieConsent({analytics:false,marketing:true});});expect(signal.aborted).toBe(true);expect(fetch).toHaveBeenCalledTimes(1);
});
test('optional cookie cleanup preserves necessary session and unrelated storage',()=>{
 document.cookie='_ga=test; path=/';document.cookie='_fbp=test; path=/';document.cookie='session=keep; path=/';localStorage.setItem('lang','ru');sessionStorage.setItem('auth_test','keep');
 saveCookieConsent({analytics:false,marketing:true});expect(document.cookie).not.toContain('_ga=');expect(document.cookie).toContain('_fbp=');
 saveCookieConsent({analytics:false,marketing:false});expect(document.cookie).not.toContain('_fbp=');expect(document.cookie).toContain('session=keep');expect(localStorage.getItem('lang')).toBe('ru');expect(sessionStorage.getItem('auth_test')).toBe('keep');
});
test('invalid/legacy choices are denied and cross-tab withdrawal propagates',()=>{
 for(const raw of ['{','null',JSON.stringify({analytics:true,marketing:true}),JSON.stringify({version:2,saved:true,necessary:true,analytics:'yes',marketing:true})]){localStorage.setItem(COOKIE_STORAGE_KEY,raw);expect(readCookieConsent()).toMatchObject({saved:false,analytics:false,marketing:false});}
 saveCookieConsent({analytics:true,marketing:true});const cb=jest.fn(),stop=subscribeCookieConsent(cb);localStorage.removeItem(COOKIE_STORAGE_KEY);window.dispatchEvent(new StorageEvent('storage',{key:COOKIE_STORAGE_KEY}));expect(cb).toHaveBeenCalledWith(expect.objectContaining({analytics:false,marketing:false}));stop();
});
test('storage errors fail closed',()=>{
 const spy=jest.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});expect(saveCookieConsent({analytics:true,marketing:true})).toBe(false);expect(readCookieConsent()).toMatchObject({analytics:false,marketing:false,saved:false});spy.mockRestore();saveCookieConsent({analytics:false,marketing:false});
});
test('footer opens saved settings; Escape discards draft and returns focus; reject revokes',()=>{
 localStorage.setItem('lang','ru');saveCookieConsent({analytics:true,marketing:false});render(<MemoryRouter><LanguageProvider><CookieConsent/><Footer lang="ru"/></LanguageProvider></MemoryRouter>);
 const opener=within(screen.getByRole('contentinfo')).getByRole('button',{name:'Настройки cookie'});opener.focus();fireEvent.click(opener);
 let dialog=screen.getByRole('dialog');expect(within(dialog).getByRole('switch',{name:'Аналитические cookie'})).toBeChecked();
 fireEvent.click(within(dialog).getByRole('switch',{name:'Рекламные и партнёрские cookie'}));fireEvent.keyDown(dialog,{key:'Escape'});expect(readCookieConsent().marketing).toBe(false);expect(document.activeElement).toBe(opener);
 fireEvent.click(opener);dialog=screen.getByRole('dialog');fireEvent.click(within(dialog).getByRole('button',{name:'Отклонить необязательные'}));expect(readCookieConsent()).toMatchObject({analytics:false,marketing:false});expect(screen.queryByRole('dialog')).toBeNull();
});
test('blanket old all never grants consent; explicit accept all grants both',()=>{
 localStorage.setItem('lang','en');localStorage.setItem('cookiesAccepted','all');localStorage.setItem(COOKIE_STORAGE_KEY,JSON.stringify({analytics:true,marketing:true}));render(<LanguageProvider><CookieConsent/></LanguageProvider>);
 for(const s of screen.getAllByRole('switch'))expect(s).not.toBeChecked();fireEvent.click(screen.getByRole('button',{name:'Accept all'}));expect(readCookieConsent()).toMatchObject({analytics:true,marketing:true,saved:true});
});
