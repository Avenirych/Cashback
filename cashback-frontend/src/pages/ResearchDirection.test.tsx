import React from 'react';
import {render,screen} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import ResearchDirection from './ResearchDirection';
import PartnerNotConnected from './PartnerNotConnected';
import {directions,studies,getDirectionText,getResearchMessages} from '../researchData';
import catalogue from '../content/researchPrograms.json';
import {formatResearchBonus} from '../researchBonusText';

let mockLang='RU';
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLang})}));
const cases=(['RU','EN','DE','FR'] as const).flatMap(lang=>directions.map((direction,index)=>({lang,direction,index})));
test.each(cases)('$lang: $direction.id has localised copy, ten unchanged studies and partner links',({lang,direction,index})=>{
 mockLang=lang;const t=getResearchMessages(lang),text=getDirectionText(direction,lang);
 const v=render(<MemoryRouter initialEntries={['/bonuses/research/'+direction.id]}><Routes><Route path="/bonuses/research/:directionId" element={<ResearchDirection/>}/></Routes></MemoryRouter>);
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent(catalogue[lang].cards[index].title.replace(/^\d+\)\s*/,''));
 [text.summary,text.goals,text.participants,text.conditions,t.bonusRange,t.rangeCaveat,t.rangeDemo,...t.demoParagraphs,...t.importantParagraphs,...t.roleParagraphs].forEach(value=>expect(screen.getByText(value)).toBeInTheDocument());
 expect(Array.from(v.container.querySelectorAll('dt'),e=>e.textContent)).toEqual([t.goals,t.participants,t.conditions,t.expected]);
 expect(screen.getByRole('link',{name:'← '+t.back})).toHaveAttribute('href','/bonuses/research');
 const rows=studies.filter(s=>s.directionId===direction.id).sort((a,b)=>a.id-b.id);
 expect(v.container.querySelectorAll('.research-study')).toHaveLength(10);
 rows.forEach(s=>expect(screen.getByRole('link',{name:t.participate+': '+t.studyName(s.id)})).toHaveAttribute('href','/partner-not-connected'));
 expect(Array.from(v.container.querySelectorAll('.research-study-bonuses'),e=>e.textContent)).toEqual(rows.map(s=>t.possibleReward+': '+formatResearchBonus(s.expectedBonuses,lang)));
 const demo=screen.getByRole('region',{name:t.demoTitle}),important=screen.getByRole('region',{name:t.importantTitle});
 expect(Array.from(demo.querySelectorAll('p'),e=>e.textContent)).toEqual(t.demoParagraphs);
 expect(Array.from(important.querySelectorAll('p'),e=>e.textContent)).toEqual(t.importantParagraphs);
 expect(demo.previousElementSibling).toHaveClass('research-details');
 expect(demo.nextElementSibling).toBe(important);
 expect(important.nextElementSibling).toHaveClass('research-direct-payments');
 expect(important.nextElementSibling!.nextElementSibling).toHaveClass('research-list-title');
 expect(screen.getByRole('link',{name:t.roleLink})).toHaveAttribute('href','/activity-limits');
 expect(v.container.querySelector('.research-direct-payments p:last-child')!.textContent).toBe(t.roleBefore+t.roleLink+t.roleAfter);
 expect(v.container.querySelectorAll('.research-study-image')).toHaveLength(10);
 if(lang!=='RU')expect(v.container.querySelector('main')!.textContent).not.toMatch(/[А-Яа-яЁё]/);
 if(lang==='DE'||lang==='FR')expect(v.container.textContent).not.toContain(getResearchMessages('EN').demoParagraphs[0]);
 if(lang==='RU')expect(v.container.textContent).not.toContain('Ожидаемые бонусы');
});
test.each(['RU','EN','DE','FR'])('%s localises missing categories and the disconnected-partner message including alt text',lang=>{
 mockLang=lang;const t=getResearchMessages(lang);
 const v=render(<MemoryRouter initialEntries={['/bonuses/research/unknown']}><Routes><Route path="/bonuses/research/:directionId" element={<ResearchDirection/>}/></Routes></MemoryRouter>);
 expect(screen.getByRole('heading')).toHaveTextContent(t.notFound);v.unmount();
 render(<PartnerNotConnected/>);expect(screen.getByText(t.partnerNotConnected)).toBeInTheDocument();
 expect(screen.getByRole('img')).toHaveAttribute('alt',t.partnerNotConnected);
 expect(getResearchMessages(lang.toLowerCase()).demoTitle).toBe(t.demoTitle);
});

test('approved Russian surveys text and common legal disclosures remain verbatim',()=>{
 const t=getResearchMessages('RU'),text=getDirectionText(directions[0],'RU');
 expect(text).toEqual({title:'Маркетинговые опросы',summary:'Анкеты о покупках, привычках, предпочтениях и отношении к товарам и услугам.',goals:'Изучение мнения потребителей и получение обратной связи для совершенствования товаров, услуг и рекламных материалов.',participants:'Пользователи, соответствующие критериям конкретного исследования.',conditions:'Для отдельных программ может потребоваться предварительный отбор и успешное прохождение квалификационных вопросов.'});
 expect([t.goals,t.participants,t.conditions,t.expected,t.bonusRange,t.rangeCaveat]).toEqual(['Цель исследований','Кто может участвовать','Условия участия','Типичный диапазон бонусных вознаграждений','От 5 до 50 бонусов за исследование.','Фактический размер вознаграждения зависит от условий конкретной программы и результатов проверки участия.']);
 expect(t.demoParagraphs).toEqual(['В настоящее время отображается демонстрационный каталог исследований.','Партнёрские исследовательские программы пока не подключены.','Показанные значения используются исключительно для демонстрации интерфейса.','Бонусы в демонстрационном режиме не начисляются и не влияют на баланс пользователя.']);
 expect(t.importantParagraphs).toEqual(['Cashback+ предоставляет информацию об исследовательских программах независимых организаций.','Cashback+ не является работодателем, кадровым агентством или организатором исследований.','Участие в исследовании не гарантирует прохождение отбора, получение приглашения или начисление определённого размера вознаграждения.','Бонусы Cashback+ являются частью программы потребительских вознаграждений и не являются денежными средствами, электронными деньгами, банковским вкладом или инвестиционным продуктом.']);
 expect(t.roleParagraphs).toEqual(['Платформа предоставляет информацию о доступных возможностях участия и может начислять бонусы в соответствии с условиями партнёрских программ.','Условия участия, критерии отбора и порядок проведения исследований определяются организаторами соответствующих программ.','Некоторые исследовательские организации могут выплачивать вознаграждение участникам напрямую.','Такие выплаты не проходят через Cashback+ и регулируются условиями соответствующей организации.']);
 expect(t.roleBefore+t.roleLink+t.roleAfter).toBe('Дополнительные бонусы Cashback+, если они предусмотрены программой, начисляются отдельно и регулируются Правилами активности.');
});
test('demo study identities, allocation and bonuses stay deterministic',()=>{
 expect(studies).toHaveLength(100);expect(new Set(studies.map(s=>s.id)).size).toBe(100);
 directions.forEach(d=>expect(studies.filter(s=>s.directionId===d.id)).toHaveLength(10));
 expect(studies.every(s=>s.expectedBonuses>=5&&s.expectedBonuses<=50)).toBe(true);
 expect(getDirectionText(directions[0],'id')).toBe(directions[0].en);
});
