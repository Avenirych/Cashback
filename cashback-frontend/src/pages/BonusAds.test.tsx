import advertisingCopy from "../content/advertisingPrograms.json";
import React from 'react';
import {render,screen,fireEvent,act,within,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import BonusAds from './BonusAds';
let mockUser:any, mockEligible=true, mockLoading=false, mockLang='RU';
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:mockUser,token:mockUser?'mock-token':null,loading:mockLoading})}));
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLang})}));
jest.mock('../onboarding',()=>({useOnboarding:()=>({eligible:mockEligible})}));
const OriginalImage=global.Image;let images:any[],frames:Map<number,FrameRequestCallback>,frameId:number;
function Location(){return <p data-testid="location">{useLocation().pathname+useLocation().search}</p>}
function view(){return render(<MemoryRouter><BonusAds/><Location/></MemoryRouter>)}
function ready(){act(()=>images.forEach(x=>x.onload?.()));}
function tick(time:number){act(()=>{const work=[...frames.values()];frames.clear();work.forEach(fn=>fn(time));});}
function session(){return within(screen.getByRole('region',{name:'Учтено бонусов в текущей сессии:'})).getAllByText('Учтено бонусов в текущей сессии:')[0].parentElement!;}
function amount(){return Number(session().querySelector('strong')!.textContent)}
beforeEach(()=>{mockLang='RU';mockUser={id:999,email_verified:true};mockEligible=true;mockLoading=false;localStorage.clear();images=[];frames=new Map();frameId=0;jest.spyOn(Math,'random').mockReturnValue(.99);jest.spyOn(performance,'now').mockReturnValue(0);jest.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{frames.set(++frameId,fn);return frameId});jest.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{frames.delete(id)});Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});global.Image=class {onload:any;onerror:any;src='';constructor(){images.push(this)}} as any;});
afterEach(()=>{jest.restoreAllMocks();global.Image=OriginalImage;});
test('uses exact case-sensitive recovered assets and waits until both load',()=>{view();expect(images.map(x=>x.src)).toEqual(['/ads/background.png','/ads/Coin.png']);expect(screen.getByRole('button',{name:'Согласен участвовать в рекламной программе'})).toBeDisabled();ready();expect(screen.getByRole('button',{name:'Согласен участвовать в рекламной программе'})).toBeEnabled();expect(screen.getByText(/До 3 бонусов за участие в данной рекламной программе/)).toBeInTheDocument();expect(screen.getByText('Демонстрационные значения не являются реальным балансом пользователя.')).toBeInTheDocument();});
test('consent starts animation, completion earns three once and refresh adds nothing',()=>{const v=view();ready();expect(frames.size).toBe(0);fireEvent.click(screen.getByRole('button',{name:'Согласен участвовать в рекламной программе'}));expect(document.querySelector('.is-playing')).toBeInTheDocument();expect(amount()).toBe(0);tick(2500);expect(amount()).toBe(0);const callback=[...frames.values()][0];tick(5000);expect(amount()).toBe(3);act(()=>callback(6000));expect(amount()).toBe(3);const saved=localStorage.getItem('cashback_demo_ads_daily:999');expect(JSON.parse(saved!).total).toBe(3);v.unmount();view();ready();expect(amount()).toBe(0);expect(localStorage.getItem('cashback_demo_ads_daily:999')).toBe(saved);expect(frames.size).toBe(0);});
test('failed assets keep consent disabled and give understandable error',()=>{view();act(()=>images[1].onerror());expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить демонстрацию');expect(screen.getByRole('button',{name:'Согласен участвовать в рекламной программе'})).toBeDisabled();expect(frames.size).toBe(0);});
test('ending early cancels playback without reward',()=>{view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен участвовать в рекламной программе'}));tick(2000);fireEvent.click(screen.getByRole('button',{name:'Завершить сессию'}));tick(7000);expect(amount()).toBe(0);expect(localStorage.getItem('cashback_demo_ads_daily:999')).toBeNull();});
test('hidden page pauses animation and the time counter',()=>{view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен участвовать в рекламной программе'}));tick(2000);act(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});expect(frames.size).toBe(0);expect(document.querySelector('.is-paused')).toBeInTheDocument();expect(amount()).toBe(0);});
test.each([null,{id:999,email_verified:false}])('anonymous or unverified user cannot start',user=>{mockUser=user;view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен участвовать в рекламной программе'}));expect(screen.getByTestId('location')).toHaveTextContent('/register?next=%2Fbonuses%2Fads');expect(frames.size).toBe(0);});
test('incomplete onboarding preserves profile requirement',()=>{mockEligible=false;view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен участвовать в рекламной программе'}));expect(screen.getByTestId('location')).toHaveTextContent('/profile');expect(frames.size).toBe(0);});


test('central demo quota is checked after completion before any browser-only credit; failure gives no credit',async()=>{
 const old=process.env.REACT_APP_ACTIVITY_LIMITS;process.env.REACT_APP_ACTIVITY_LIMITS='true';Object.defineProperty(global,'crypto',{value:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},configurable:true});global.fetch=jest.fn().mockResolvedValue({ok:false});
 try{view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен участвовать в рекламной программе'}));expect(fetch).not.toHaveBeenCalled();tick(5000);await waitFor(()=>expect(screen.getByRole('alert')).toBeVisible());expect(amount()).toBe(0);expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/activity/demo/video'),expect.objectContaining({headers:expect.objectContaining({'Idempotency-Key':'00000000-0000-4000-8000-000000000001'}),body:'{}'}));}
 finally{if(old===undefined)delete process.env.REACT_APP_ACTIVITY_LIMITS;else process.env.REACT_APP_ACTIVITY_LIMITS=old;}
});

test.each(['ru','en','de','fr'] as const)('%s: full programme copy, explicit demo example, counters and legal links',lang=>{
 mockLang=lang;view();ready();const t=advertisingCopy[lang];expect(screen.getByRole('heading',{level:1})).toHaveTextContent(t.title);
 for(const text of [t.subtitle,t.voluntary,t.counterNote,...t.demoParagraphs,...t.importantParagraphs])expect(screen.getByText(text)).toBeInTheDocument();
 expect(screen.getByRole('button',{name:t.consent})).toBeEnabled();expect(document.querySelector('.is-playing')).toBeNull();
 expect(document.querySelector('.ads-cost')).toHaveTextContent(t.example+' '+t.maximum);
 expect(document.querySelectorAll('.ads-counter strong')).toHaveLength(2);expect(document.querySelectorAll('.ads-counter strong')[0]).toHaveTextContent('0');
 const demoParagraphs=document.getElementById('ads-demo-title')!.parentElement!.querySelectorAll('p');
 expect(Array.from(demoParagraphs,paragraph=>paragraph.textContent)).toEqual(t.demoParagraphs);
 expect(demoParagraphs).toHaveLength(3);
 if(lang==='ru')expect(demoParagraphs[2]).toHaveTextContent('Демонстрационные значения и счётчики используются для ознакомления с интерфейсом. Отдельные сведения об активности могут обрабатываться платформой для контроля ограничений и предотвращения злоупотреблений. Демонстрационный режим не предусматривает начисления реальных бонусов.');
 expect(document.getElementById('ads-important-title')!.parentElement!.querySelectorAll('p')).toHaveLength(5);
 expect(screen.getByRole('link',{name:t.activityLink})).toHaveAttribute('href','/activity-limits');expect(screen.getByRole('link',{name:t.termsLink})).toHaveAttribute('href','/terms');
 expect(screen.queryByText('Тестовые значения и счётчики сохраняются только в текущем браузере и используются исключительно для демонстрационных целей.')).not.toBeInTheDocument();
 if(lang!=='ru')expect(document.querySelector('.ads-page')!.textContent).not.toMatch(/[А-Яа-яЁё]/);
});
test('successful mocked quota acknowledgement increments only browser demo totals; end resets session but keeps day',async()=>{
 const old=process.env.REACT_APP_ACTIVITY_LIMITS;process.env.REACT_APP_ACTIVITY_LIMITS='true';Object.defineProperty(global,'crypto',{value:{randomUUID:()=> '00000000-0000-4000-8000-000000000002'},configurable:true});global.fetch=jest.fn().mockResolvedValue({ok:true});
 try{view();ready();expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:advertisingCopy.ru.consent}));tick(5000);await waitFor(()=>expect(amount()).toBe(3));expect(fetch).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/activity/demo/video'),expect.objectContaining({method:'POST',body:'{}'}));fireEvent.click(screen.getByRole('button',{name:'Завершить сессию'}));expect(amount()).toBe(0);expect(JSON.parse(localStorage.getItem('cashback_demo_ads_daily:999')!).total).toBe(3);expect(mockUser).toEqual({id:999,email_verified:true});}
 finally{if(old===undefined)delete process.env.REACT_APP_ACTIVITY_LIMITS;else process.env.REACT_APP_ACTIVITY_LIMITS=old;}
});
