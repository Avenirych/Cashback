import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import InformationPage from '../components/InformationPage';
import ProductOffers from './ProductOffers';
import BonusResearch from './BonusResearch';
import {LanguageProvider} from '../context/LanguageContext';
import {faqSections,labels,Locale} from '../content/siteContent';
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:null,token:null,loading:false})}));
jest.mock('../onboarding',()=>({useOnboarding:()=>({eligible:false})}));

test.each<Locale>(['en','ru','de','fr'])('FAQ in %s exposes conditions and supports keyboard use',lang=>{
 localStorage.setItem('lang',lang);
 render(<MemoryRouter><LanguageProvider><InformationPage page="faq"/></LanguageProvider></MemoryRouter>);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent(labels.faq[lang]);
 expect(faqSections.length).toBeGreaterThanOrEqual(30);
 expect(screen.getByText(labels.demo[lang],{selector:'aside p'})).toBeVisible();
 const q=screen.getAllByRole('button',{expanded:false})[0];
 fireEvent.click(q);expect(q).toHaveAttribute('aria-expanded','true');
 const answer=document.getElementById(q.getAttribute('aria-controls')!);
 expect(answer).toBeVisible();fireEvent.keyDown(q,{key:'Escape'});
 expect(answer).not.toBeVisible();expect(q).toHaveFocus();
 fireEvent.keyDown(q,{key:'ArrowDown'});expect(screen.getAllByRole('button',{expanded:false})[1]).toHaveFocus();
});
test.each<Locale>(['en','ru','de','fr'])('legal and contact pages in %s disclose unresolved identity',lang=>{
 localStorage.setItem('lang',lang);
 const view=render(<MemoryRouter><LanguageProvider><InformationPage page="privacy"/></LanguageProvider></MemoryRouter>);
 expect(screen.getByText(labels.draft[lang])).toBeVisible();
 expect(view.container.textContent).not.toMatch(/Cashback Plus Ltd|1234 5678|privacy@cashbackplus/);
 view.unmount();render(<MemoryRouter><LanguageProvider><InformationPage page="contacts"/></LanguageProvider></MemoryRouter>);
 expect(screen.getByRole('button',{name:labels.send[lang]})).toBeDisabled();
 expect(screen.getByRole('link',{name:labels.profile[lang]})).toHaveAttribute('href','/profile');
});
test('cookie controls can be reopened after the initial banner is dismissed',()=>{
 localStorage.setItem('lang','en');localStorage.setItem('cookiesAccepted','necessary');
 render(<MemoryRouter><LanguageProvider><InformationPage page="cookies"/></LanguageProvider></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Manage cookies'}));
 expect(screen.getByRole('dialog')).toBeVisible();
});
test.each<Locale>(['en','ru','de','fr'])('comparison screen in %s labels examples and does not promise invented prices',lang=>{
 localStorage.setItem('lang',lang);
 render(<LanguageProvider><ProductOffers/></LanguageProvider>);
 expect(screen.getByText(labels.demo[lang])).toBeVisible();
 const title={en:'Product comparison example',ru:'Образец продукта',de:'Produktvergleichsbeispiel',fr:'Exemple de comparaison de produits'}[lang];
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent(title);
 expect(screen.queryByText(/базовая цена 100–200/)).not.toBeInTheDocument();
});
test.each<Locale>(['en','ru','de','fr'])('research catalogue in %s has a localized introduction and no advertised income ranges',lang=>{
 localStorage.setItem('lang',lang);
 const view=render(<MemoryRouter><LanguageProvider><BonusResearch/></LanguageProvider></MemoryRouter>);
 expect(screen.getByText(labels.description[lang])).toBeVisible();
 expect(screen.getAllByText(labels.money[lang]).length).toBe(10);
 expect(view.container.textContent).not.toMatch(/£1000|£2000|Typical earnings|Заработок:/);
});
