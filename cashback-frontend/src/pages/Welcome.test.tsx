import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import Welcome from './Welcome';
import {translations} from '../i18n';
import reviews from '../content/reviewMessages.json';
import demos from '../content/demoReviews.json';

let mockLang='ru';
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLang})}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({token:null})}));
function Location(){return <output data-testid="location">{useLocation().pathname}</output>}
function mount(lang:string){mockLang=lang.toLowerCase();return render(<MemoryRouter><Welcome lang={lang}/><Location/></MemoryRouter>)}
beforeEach(()=>{delete process.env.REACT_APP_REVIEWS_MODE;delete process.env.REACT_APP_LOCAL_DEMO_REVIEWS;});

test.each(['RU','EN','DE','FR'] as const)('%s has the complete common home structure and localised disclosures',lang=>{
 const t=translations[lang],key=lang.toLowerCase() as keyof typeof reviews,v=mount(lang);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent(t.title);
 expect(screen.getByText(t.description)).toBeInTheDocument();
 expect(v.container.querySelector('.welcome-explanation')).toHaveTextContent(t.compensationExplanation);
 expect(v.container.querySelector('.welcome-actions')!.nextElementSibling).toHaveClass('welcome-explanation');
 expect(screen.getByText(t.everythingFine)).toBeInTheDocument();
 expect(screen.getByRole('img')).toHaveAttribute('src','/assets/Oduvanchiki.jpeg');
 expect(screen.getByRole('img')).toHaveAttribute('alt',t.welcomeImageAlt);
 expect(v.container.querySelectorAll('.review-card')).toHaveLength(10);
 expect(screen.getAllByText(reviews[key].demo)).toHaveLength(11);
 demos.forEach(d=>expect(screen.getByText(d.text[key])).toBeInTheDocument());
 expect(screen.getByRole('button',{name:reviews[key].previous})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:reviews[key].next})).toBeInTheDocument();
 const footer=v.container.querySelector('footer')!;
 expect(Array.from(footer.querySelectorAll('a'),a=>a.getAttribute('href'))).toEqual(['/privacy','/faq','/cookies','/activity-limits','/terms','/contacts']);
 expect(footer.querySelector('a[href="/terms"]')).toHaveTextContent(t.welcomeFooterLinks.terms);
 expect(footer.querySelector('a[href="/contacts"]')).toHaveTextContent(t.welcomeFooterLinks.contacts);
 if(lang!=='RU')expect(v.container.textContent).not.toMatch(/[А-Яа-яЁё]/);
 if(lang==='DE'||lang==='FR'){
  expect(v.container.textContent).not.toContain(translations.EN.description);
  expect(v.container.textContent).not.toContain(reviews.en.demo);
  expect(footer.querySelector('a[href="/terms"]')).not.toHaveTextContent(/^Terms$/);
 }
});

test('approved Russian home texts remain verbatim',()=>{
 const v=mount('RU');
 expect(screen.getByText('Получайте кэшбэк и дополнительные бонусы за участие в программах Cashback+.')).toBeInTheDocument();
 expect(screen.getByText('Размер компенсации зависит от условий конкретного предложения и может отличаться для разных пользователей.')).toBeInTheDocument();
 expect(v.container.querySelector('.reviews-carousel > p')!.textContent).toBe('Представленные ниже отзывы являются демонстрационными примерами интерфейса и созданы исключительно для иллюстрации работы платформы. Они не основаны на опыте реальных пользователей и не должны рассматриваться как рекомендации или подтверждение результатов использования Cashback+.');
});

test.each(['RU','EN','DE','FR'] as const)('%s preserves both public action routes without authentication',lang=>{
 mount(lang);fireEvent.click(screen.getByRole('button',{name:translations[lang].goShopping}));
 expect(screen.getByTestId('location')).toHaveTextContent('/shop');
 fireEvent.click(screen.getByRole('button',{name:translations[lang].getBonuses}));
 expect(screen.getByTestId('location')).toHaveTextContent('/bonuses');
});
