import {render,screen,fireEvent,act} from '@testing-library/react';
import {LanguageProvider} from '../context/LanguageContext';
import CookieConsent from './CookieConsent';
import {cookieMessages} from '../content/cookieMessages';
import {saveCookieConsent,readCookieConsent,openCookieSettings} from '../cookieConsent';
beforeEach(()=>{localStorage.clear();saveCookieConsent({analytics:false,marketing:false});localStorage.clear();});
test.each(['ru','en','de','fr'] as const)('%s independent optional switches',lang=>{
 localStorage.setItem('lang',lang);render(<LanguageProvider><CookieConsent/></LanguageProvider>);const t=cookieMessages[lang];
 const a=screen.getByRole('switch',{name:t.analytics}),m=screen.getByRole('switch',{name:t.marketing});
 expect(screen.getAllByRole('switch')).toHaveLength(2);expect(a).not.toBeChecked();expect(m).not.toBeChecked();
 fireEvent.click(a);expect(m).not.toBeChecked();expect(localStorage.getItem('cashback_cookie_settings')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:t.save}));expect(readCookieConsent()).toMatchObject({analytics:true,marketing:false,saved:true});
});

test.each([[false,false],[true,false],[false,true],[true,true]])('UI saves and reopens %s/%s', (analytics,marketing)=>{
 localStorage.setItem('lang','en');const first=render(<LanguageProvider><CookieConsent/></LanguageProvider>);
 if(analytics)fireEvent.click(screen.getByRole('switch',{name:cookieMessages.en.analytics}));
 if(marketing)fireEvent.click(screen.getByRole('switch',{name:cookieMessages.en.marketing}));
 fireEvent.click(screen.getByRole('button',{name:cookieMessages.en.save}));first.unmount();
 render(<LanguageProvider><CookieConsent/></LanguageProvider>);expect(screen.queryByRole('region')).toBeNull();
 act(()=>openCookieSettings());expect((screen.getByRole('switch',{name:cookieMessages.en.analytics}) as HTMLInputElement).checked).toBe(analytics);
 expect((screen.getByRole('switch',{name:cookieMessages.en.marketing}) as HTMLInputElement).checked).toBe(marketing);
});
