import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Footer from '../components/Footer';
import {AppRoutes} from '../App';
jest.mock('../components/Header',()=>()=>null);
jest.mock('../components/CookieConsent',()=>()=>null);
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:'ru',setLang:jest.fn()})}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:null,loading:false}),AuthProvider:({children}:any)=>children}));
jest.mock('../context/BonusesContext',()=>({useBonuses:()=>({items:[],transfers:[],loading:false}),BonusesProvider:({children}:any)=>children}));
test.each([['RU','Информация','Политика конфиденциальности','Часто задаваемые вопросы'],['EN','Information','Privacy Policy','Frequently Asked Questions']])('footer links in %s preserve existing content',(lang,title,privacy,faq)=>{
 render(<MemoryRouter><Footer lang={lang}/></MemoryRouter>);
 expect(screen.getByRole('heading',{name:title})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:privacy})).toHaveAttribute('href','/privacy');
 expect(screen.getByRole('link',{name:faq})).toHaveAttribute('href','/faq');
 expect(screen.getByRole('link',{name:/Terms/})).toHaveAttribute('href','/terms');
 expect(screen.getByRole('link',{name:'Contacts'})).toHaveAttribute('href','/contacts');
 expect(screen.getByText('© 2026 Cashback+')).toBeInTheDocument();
});
test.each(['/privacy','/faq','/cookies'])('direct public route %s renders existing page rather than home',(route)=>{
 render(<MemoryRouter initialEntries={[route]}><AppRoutes/></MemoryRouter>);
 expect(screen.getByRole('heading',{level:1})).toBeInTheDocument();
 expect(screen.queryByText('Smart shopping with Cashback+')).not.toBeInTheDocument();
});
test('clicking footer FAQ navigates to the real FAQ and opens an answer',()=>{
 render(<MemoryRouter initialEntries={['/privacy']}><AppRoutes/></MemoryRouter>);
 fireEvent.click(screen.getByRole('link',{name:'Часто задаваемые вопросы'}));
 const question=screen.getAllByRole('button',{expanded:false})[0];
 fireEvent.click(question);
 expect(question).toHaveAttribute('aria-expanded','true');
});
