import React from 'react';
import {fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import Bonuses from './Bonuses';
import copy from '../content/bonusPrograms.json';
let mockLanguage='ru';
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLanguage})}));
const labels=Object.fromEntries(Object.entries(copy).map(([lang,t])=>[lang,[t.adsTitle,t.researchTitle]]));
function mount(){return render(<MemoryRouter initialEntries={['/bonuses']}><Routes>
 <Route path='/bonuses' element={<Bonuses/>}/><Route path='/bonuses/ads' element={<p>Existing ads route</p>}/><Route path='/bonuses/research' element={<p>Existing research route</p>}/>
 </Routes></MemoryRouter>);}
test.each(['ru','en','de','fr'] as const)('%s: complete copy, two original buttons, unchanged appearance and legal links',lang=>{
 mockLanguage=lang;const v=mount(),t=copy[lang];expect(screen.getByRole('heading',{level:1})).toHaveTextContent(t.title);expect(screen.getByText(t.description)).toBeInTheDocument();
 const cards=v.container.querySelectorAll('article');expect(cards).toHaveLength(2);expect(v.container.querySelectorAll('article h2')).toHaveLength(0);expect(within(cards[0] as HTMLElement).getByRole('button')).toHaveTextContent(t.adsTitle);expect(cards[0]).toHaveTextContent(t.adsDescription);expect(cards[1]).toHaveTextContent(t.researchTitle);expect(cards[1]).toHaveTextContent(t.researchDescription);
 const buttons=screen.getAllByRole('button');expect(buttons).toHaveLength(2);buttons.forEach((b,i)=>{expect(b).toHaveTextContent(labels[lang][i]);expect(b.closest('article')).toBe(cards[i]);expect(cards[i].firstElementChild).toBe(b);expect(cards[i].querySelectorAll('p')).toHaveLength(1);expect(b).toHaveAttribute('type','button');expect(b).toHaveStyle({padding:'16px 24px',borderRadius:'12px',fontSize:'18px',fontWeight:'600',background:i===0?'#0078ff':'#ff3b3b'});expect(b).not.toBeDisabled();});
 const info=v.container.querySelector('.bonuses-information')!;expect(info.querySelectorAll('p')).toHaveLength(4);expect(Array.from(info.querySelectorAll('p')).map(p=>p.textContent)).toEqual([...t.paragraphs,t.termsBefore+t.activityLink+t.termsBetween+t.termsLink+t.termsAfter]);expect(screen.getByRole('link',{name:t.activityLink})).toHaveAttribute('href','/activity-limits');expect(screen.getByRole('link',{name:t.termsLink})).toHaveAttribute('href','/terms');if(lang!=='ru')expect(v.container.textContent).not.toMatch(/[А-Яа-яЁё]/);
});
test.each(['ru','en','de','fr'] as const)('%s: both original button handlers keep their destination',lang=>{mockLanguage=lang;const v=mount();fireEvent.click(screen.getByRole('button',{name:labels[lang][0]}));expect(screen.getByText('Existing ads route')).toBeInTheDocument();v.unmount();mount();fireEvent.click(screen.getByRole('button',{name:labels[lang][1]}));expect(screen.getByText('Existing research route')).toBeInTheDocument();});
test('approved Russian wording is exact',()=>{
 expect(copy.ru.title).toBe('Бонусные программы Cashback+');expect(copy.ru.description).toBe('Выберите доступную программу участия. Начисление бонусов зависит от выполнения условий соответствующей программы и требований её организатора.');
 expect(copy.ru.adsTitle).toBe('Рекламные программы');expect(copy.ru.adsDescription).toBe('Участвуйте в доступных рекламных программах и получайте бонусы в соответствии с условиями конкретной кампании.');
 expect(copy.ru.researchTitle).toBe('Исследовательские программы');expect(copy.ru.researchDescription).toBe('Принимайте участие в исследованиях, опросах и тестированиях, проводимых независимыми организациями. Вознаграждения и условия участия определяются организаторами соответствующих программ.');
 expect(copy.ru.paragraphs).toEqual(['Бонусы являются частью программы потребительских вознаграждений Cashback+.','Начисление бонусов зависит от выполнения условий соответствующей программы, прохождения необходимых проверок и подтверждения активности партнёром, если такое подтверждение требуется.','Бонусы не являются денежными средствами, банковским вкладом, электронными деньгами или инвестиционным продуктом.']);
 expect(copy.ru.termsBefore+copy.ru.activityLink+copy.ru.termsBetween+copy.ru.termsLink+copy.ru.termsAfter).toBe('Подробные условия использования бонусов содержатся в Правилах активности и Условиях использования Cashback+.');
});
