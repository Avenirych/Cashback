import React from 'react';
import {render,screen,fireEvent,act,within,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import BonusAds from './BonusAds';
let mockUser:any, mockEligible=true, mockLoading=false;
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:mockUser,token:mockUser?'mock-token':null,loading:mockLoading})}));
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:'RU'})}));
jest.mock('../onboarding',()=>({useOnboarding:()=>({eligible:mockEligible})}));
const OriginalImage=global.Image;let images:any[],frames:Map<number,FrameRequestCallback>,frameId:number;
function Location(){return <p data-testid="location">{useLocation().pathname+useLocation().search}</p>}
function view(){return render(<MemoryRouter><BonusAds/><Location/></MemoryRouter>)}
function ready(){act(()=>images.forEach(x=>x.onload?.()));}
function tick(time:number){act(()=>{const work=[...frames.values()];frames.clear();work.forEach(fn=>fn(time));});}
function session(){return within(screen.getByRole('region',{name:'За текущую сессию'})).getAllByText('За текущую сессию')[0].parentElement!;}
function amount(){return Number(session().querySelector('strong')!.textContent)}
beforeEach(()=>{mockUser={id:999,email_verified:true};mockEligible=true;mockLoading=false;localStorage.clear();images=[];frames=new Map();frameId=0;jest.spyOn(Math,'random').mockReturnValue(.99);jest.spyOn(performance,'now').mockReturnValue(0);jest.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{frames.set(++frameId,fn);return frameId});jest.spyOn(window,'cancelAnimationFrame').mockImplementation(id=>{frames.delete(id)});Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});global.Image=class {onload:any;onerror:any;src='';constructor(){images.push(this)}} as any;});
afterEach(()=>{jest.restoreAllMocks();global.Image=OriginalImage;});
test('uses exact case-sensitive recovered assets and waits until both load',()=>{view();expect(images.map(x=>x.src)).toEqual(['/ads/background.png','/ads/Coin.png']);expect(screen.getByRole('button',{name:'Согласен смотреть рекламу'})).toBeDisabled();ready();expect(screen.getByRole('button',{name:'Согласен смотреть рекламу'})).toBeEnabled();expect(screen.getByText('За полный просмотр — 3 бонуса')).toBeInTheDocument();expect(screen.getByText(/не связан с бонусами обмена/)).toBeInTheDocument();});
test('consent starts animation, completion earns three once and refresh adds nothing',()=>{const v=view();ready();expect(frames.size).toBe(0);fireEvent.click(screen.getByRole('button',{name:'Согласен смотреть рекламу'}));expect(document.querySelector('.is-playing')).toBeInTheDocument();expect(amount()).toBe(0);tick(2500);expect(amount()).toBe(0);const callback=[...frames.values()][0];tick(5000);expect(amount()).toBe(3);act(()=>callback(6000));expect(amount()).toBe(3);const saved=localStorage.getItem('cashback_demo_ads_daily:999');expect(JSON.parse(saved!).total).toBe(3);v.unmount();view();ready();expect(amount()).toBe(0);expect(localStorage.getItem('cashback_demo_ads_daily:999')).toBe(saved);expect(frames.size).toBe(0);});
test('failed assets keep consent disabled and give understandable error',()=>{view();act(()=>images[1].onerror());expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить демонстрацию');expect(screen.getByRole('button',{name:'Согласен смотреть рекламу'})).toBeDisabled();expect(frames.size).toBe(0);});
test('ending early cancels playback without reward',()=>{view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен смотреть рекламу'}));tick(2000);fireEvent.click(screen.getByRole('button',{name:'Завершить сессию'}));tick(7000);expect(amount()).toBe(0);expect(localStorage.getItem('cashback_demo_ads_daily:999')).toBeNull();});
test('hidden page pauses animation and the time counter',()=>{view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен смотреть рекламу'}));tick(2000);act(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});expect(frames.size).toBe(0);expect(document.querySelector('.is-paused')).toBeInTheDocument();expect(amount()).toBe(0);});
test.each([null,{id:999,email_verified:false}])('anonymous or unverified user cannot start',user=>{mockUser=user;view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен смотреть рекламу'}));expect(screen.getByTestId('location')).toHaveTextContent('/register?next=%2Fbonuses%2Fads');expect(frames.size).toBe(0);});
test('incomplete onboarding preserves profile requirement',()=>{mockEligible=false;view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен смотреть рекламу'}));expect(screen.getByTestId('location')).toHaveTextContent('/profile');expect(frames.size).toBe(0);});


test('central demo quota is checked after completion before any browser-only credit; failure gives no credit',async()=>{
 const old=process.env.REACT_APP_ACTIVITY_LIMITS;process.env.REACT_APP_ACTIVITY_LIMITS='true';Object.defineProperty(global,'crypto',{value:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},configurable:true});global.fetch=jest.fn().mockResolvedValue({ok:false});
 try{view();ready();fireEvent.click(screen.getByRole('button',{name:'Согласен смотреть рекламу'}));expect(fetch).not.toHaveBeenCalled();tick(5000);await waitFor(()=>expect(screen.getByRole('alert')).toBeVisible());expect(amount()).toBe(0);expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/activity/demo/video'),expect.objectContaining({headers:expect.objectContaining({'Idempotency-Key':'00000000-0000-4000-8000-000000000001'}),body:'{}'}));}
 finally{if(old===undefined)delete process.env.REACT_APP_ACTIVITY_LIMITS;else process.env.REACT_APP_ACTIVITY_LIMITS=old;}
});
