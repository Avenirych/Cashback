import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
import BonusResearch from './BonusResearch';
import copy from '../content/researchPrograms.json';
import rewards from '../content/researchRewards.json';

let mockLang='RU',mockUser:any=null,mockToken:string|null=null,mockLoading=false,mockEligible=false;
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLang})}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:mockUser,token:mockToken,loading:mockLoading})}));
jest.mock('../onboarding',()=>({useOnboarding:()=>({eligible:mockEligible})}));
const paths=['surveys','focus-groups','ux','mystery-shopping','health','b2b','diaries','communities','academic','experts'];
function Location(){const l=useLocation();return <output data-testid="location">{JSON.stringify({pathname:l.pathname,search:l.search,state:l.state})}</output>}
function location(){return JSON.parse(screen.getByTestId('location').textContent!)}
function mount(){return render(<MemoryRouter initialEntries={['/bonuses/research']}><BonusResearch/><Location/></MemoryRouter>)}
beforeEach(()=>{mockLang='RU';mockUser=null;mockToken=null;mockLoading=false;mockEligible=false;global.fetch=jest.fn();});

test.each(['RU','EN','DE','FR'] as const)('%s has ten complete cards, intact legal blocks and qualified example ranges',lang=>{
 mockLang=lang;const v=mount(),t=copy[lang],main=v.container.querySelector('main')!;
 expect(screen.getByRole('heading',{level:1})).toHaveTextContent(t.pageTitle);
 expect(screen.getByText(t.pageSubtitle)).toBeInTheDocument();
 const top=screen.getByRole('region',{name:t.importantTitle}),bottom=screen.getByRole('region',{name:t.rewardsTitle});
 expect(Array.from(top.querySelectorAll('p'),p=>p.textContent)).toEqual(t.importantParagraphs);
 expect(Array.from(bottom.querySelectorAll('p'),p=>p.textContent)).toEqual([...t.rewardsParagraphs,t.rewardsBefore+t.rulesLink+t.rewardsAfter,t.bonusNature]);
 expect(top.nextElementSibling).toHaveClass('research-range-disclaimer');
 expect(top.nextElementSibling!.textContent).toBe(rewards[lang].disclaimer);
 expect(top.nextElementSibling!.nextElementSibling).toHaveClass('research-catalog-grid');
 expect(bottom.previousElementSibling).toHaveClass('research-catalog-grid');
 const cards=main.querySelectorAll('article');expect(cards).toHaveLength(10);
 t.cards.forEach((card,i)=>{
  expect(card.id).toBe(i+1);
  expect(Array.from(cards[i].querySelectorAll('p'),p=>p.textContent)).toEqual([card.summary,card.goals,card.participants,card.conditions,rewards[lang].cards[i]]);
  expect(cards[i].querySelector('h2')!.textContent).toBe(card.title);
  expect(screen.getByRole('button',{name:t.participate+': '+card.title})).toBeEnabled();
 });
 expect(main.querySelectorAll('button')).toHaveLength(10);
 expect(screen.getByRole('link',{name:t.rulesLink})).toHaveAttribute('href','/activity-limits');
 expect(main.textContent).not.toMatch(/Заработок|earnings|High-value|profitable|Высокооплачиваемые|Премиальный сегмент/);
 if(lang!=='RU')expect(main.textContent).not.toMatch(/[А-Яа-яЁё]/);
 if(lang==='DE'||lang==='FR')expect(main.textContent).not.toContain(copy.EN.importantParagraphs[0]);
 expect(fetch).not.toHaveBeenCalled();
});

test('approved Russian legal disclosures remain verbatim',()=>{
 expect(copy.RU.importantParagraphs).toEqual([
  'Cashback+ предоставляет информацию об исследовательских программах независимых организаций.',
  'Cashback+ не является организатором исследований, работодателем, кадровым агентством или посредником по трудоустройству.',
  'Условия участия, критерии отбора и размеры вознаграждений определяются организаторами соответствующих исследований.',
  'Участие в исследовании не гарантирует получение приглашения, прохождение отбора или определённого размера вознаграждения.'
 ]);
 expect(copy.RU.rewardsParagraphs).toEqual(['Некоторые исследовательские организации осуществляют выплаты напрямую участникам.','Такие выплаты не проходят через Cashback+ и регулируются условиями соответствующей организации.']);
 expect(copy.RU.rewardsBefore+copy.RU.rulesLink+copy.RU.rewardsAfter).toBe('В отдельных случаях Cashback+ может получать партнёрское вознаграждение за привлечение участника и начислять пользователю дополнительные бонусы в соответствии с Правилами активности платформы.');
 expect(copy.RU.bonusNature).toBe('Бонусы Cashback+ являются частью программы потребительских вознаграждений и не являются денежными средствами, электронными деньгами, банковским вкладом или инвестиционным продуктом.');
 expect(rewards.RU.disclaimer).toBe('Приведённые диапазоны являются ориентировочными примерами, а не подтверждённой статистикой выплат. Фактическое наличие вознаграждения, его размер и условия определяются организатором конкретного исследования.');
});

test.each(['RU','EN','DE','FR'] as const)('%s preserves the exact original currency ranges per card, including two non-numeric cards',lang=>{
 const expected=[['£0.5–£20'],['£30–£300','£500–£1000'],['£5–£100'],[],['£50–£2000+'],['£50–£500'],['£50–£500'],[],['£6–£20'],['£100–£1000+']];
 expect(rewards[lang].cards).toHaveLength(10);
 rewards[lang].cards.forEach((text,i)=>expect(text.match(/£\d+(?:\.\d+)?–£\d+(?:\.\d+)?\+?/g)||[]).toEqual(expected[i]));
 [0,1,2,4,5,6,8,9].forEach(i=>expect(rewards.RU.cards[i]).toMatch(/^Типичный диапазон вознаграждений, который может встречаться в подобных программах:/));
});

test.each(['RU','EN','DE','FR'] as const)('%s keeps all ten authorised direction routes and all ten guest return paths',lang=>{
 mockLang=lang;const t=copy[lang];mockUser={id:7,email_verified:true};mockToken='test';mockEligible=true;const v=mount();
 paths.forEach((path,i)=>{fireEvent.click(screen.getByRole('button',{name:t.participate+': '+t.cards[i].title}));expect(location().pathname).toBe('/bonuses/research/'+path)});
 v.unmount();mockUser=null;mockToken=null;mount();
 paths.forEach((path,i)=>{fireEvent.click(screen.getByRole('button',{name:t.participate+': '+t.cards[i].title}));expect(location()).toMatchObject({pathname:'/register',search:'?next='+encodeURIComponent('/bonuses/research/'+path)})});
 expect(fetch).not.toHaveBeenCalled();
});
test.each([{user:{id:7,email_verified:false},token:'test'},{user:{id:7,email_verified:true},token:null}])('email and token requirements remain enforced',({user,token})=>{
 mockUser=user;mockToken=token;mockEligible=true;mount();fireEvent.click(screen.getByRole('button',{name:copy.RU.participate+': '+copy.RU.cards[0].title}));expect(location().pathname).toBe('/register');
});
test('incomplete onboarding keeps its state and intended direction',()=>{
 mockUser={id:7,email_verified:true};mockToken='test';mount();
 paths.forEach((path,i)=>{fireEvent.click(screen.getByRole('button',{name:copy.RU.participate+': '+copy.RU.cards[i].title}));expect(location()).toMatchObject({pathname:'/profile',state:{bonusOnboardingRequired:true,next:'/bonuses/research/'+path}})});
});
test.each(['RU','EN','DE','FR'] as const)('%s loading disables every participation button without navigation',lang=>{
 mockLang=lang;mockLoading=true;const v=mount();expect(screen.getAllByRole('button')).toHaveLength(10);
 screen.getAllByRole('button').forEach(button=>{expect(button).toBeDisabled();expect(button).toHaveTextContent(copy[lang].waiting);fireEvent.click(button)});
 expect(v.container.querySelector('output')).toHaveTextContent('"pathname":"/bonuses/research"');expect(fetch).not.toHaveBeenCalled();
});
