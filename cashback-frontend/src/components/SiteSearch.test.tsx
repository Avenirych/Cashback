import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
import Header from './Header';
import SiteSearch from './SiteSearch';
let mockLanguage='ru';
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLanguage,setLang:jest.fn()})}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:null,forumUser:null,logout:jest.fn()})}));
const pages=[{path:'/faq',title:'Часто задаваемые вопросы',titleEn:'FAQ',text:'Кешбэк не появился. Свяжитесь со службой поддержки.'},{path:'/privacy',title:'Политика конфиденциальности',titleEn:'Privacy Policy',text:'Personal data retention and security'}];
function Location(){return <span data-testid="location">{useLocation().pathname+useLocation().search}</span>}
beforeEach(()=>{mockLanguage='ru';global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>pages});});
function setup(entry='/',header=false){return render(<MemoryRouter initialEntries={[entry]}>{header?<Header/>:<SiteSearch resultsPage/>}<Location/></MemoryRouter>)}
test.each(['button','enter'])('header %s submission navigates to editable search results',(method)=>{setup('/',true);const input=screen.getByPlaceholderText('Поиск по сайту');fireEvent.change(input,{target:{value:'кешбэк'}});if(method==='button')fireEvent.click(screen.getByRole('button',{name:'Найти'}));else fireEvent.submit(input.closest('form')!);expect(screen.getByTestId('location')).toHaveTextContent('/search?q=');expect(screen.getByRole('link',{name:'О нас'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Вход / Регистрация'})).toBeInTheDocument();});
test('English header labels',()=>{mockLanguage='en';setup('/',true);expect(screen.getByPlaceholderText('Search the site')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Search'})).toBeInTheDocument();});
test('direct search route displays indexed content excerpts and safe links',async()=>{setup('/search?q=retention');const link=await screen.findByRole('link',{name:/Privacy|Политика/});expect(link).toHaveAttribute('href','/privacy');expect(link).toHaveTextContent('retention');});
test('Russian content search and editing query',async()=>{setup('/search?q=Свяжитесь');expect(await screen.findByRole('link',{name:/Часто/})).toHaveAttribute('href','/faq');fireEvent.change(screen.getByRole('searchbox'),{target:{value:'zzzznomatch'}});expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();});
test('empty input does not navigate',()=>{setup('/',true);fireEvent.click(screen.getByRole('button',{name:'Найти'}));expect(screen.getByTestId('location')).toHaveTextContent('/');expect(screen.queryByText('Ничего не найдено')).not.toBeInTheDocument();});
test('index cannot inject external or private links',async()=>{(fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>[{path:'https://evil.test',title:'evil',titleEn:'evil',text:'secret'},{path:'/profile',title:'private',titleEn:'private',text:'secret'}]});setup('/search?q=secret');await waitFor(()=>expect(fetch).toHaveBeenCalled());expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();});
test('unmount aborts pending index request without unhandled rejection',()=>{let signal:AbortSignal;(fetch as jest.Mock).mockImplementation((_url,options)=>{signal=options.signal;return new Promise(()=>{});});const view=setup();view.unmount();expect(signal!.aborted).toBe(true);});
test('an abort-aware index request settles on unmount without logging a failure',async()=>{
 const warning=jest.spyOn(console,'warn').mockImplementation(()=>{});let settled=false;
 try {(fetch as jest.Mock).mockImplementation((_url,options)=>new Promise((_resolve,reject)=>{options.signal.addEventListener('abort',()=>{settled=true;reject(new DOMException('Aborted','AbortError'));},{once:true});}));
 const view=setup();view.unmount();await waitFor(()=>expect(settled).toBe(true));expect(warning).not.toHaveBeenCalled();
 } finally {warning.mockRestore();}
});
