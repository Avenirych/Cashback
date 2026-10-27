import React from 'react';
import {createHash} from 'crypto';
import {fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import ModerationPolicy from './ModerationPolicy';
import content from '../content/moderationRules.json';
import forumContent from '../content/forumRules.json';
let mockLang='ru';
let mockAuth:any={user:null,token:null,loading:false};
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLang})}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>mockAuth}));
const originalDemo=process.env.REACT_APP_DEMO_ONLY;
const codes=['ru','en','de','fr'] as const;
beforeEach(()=>{mockLang='ru';mockAuth={user:null,token:null,loading:false};process.env.REACT_APP_DEMO_ONLY='true';global.fetch=jest.fn();});
afterEach(()=>{if(originalDemo===undefined)delete process.env.REACT_APP_DEMO_ONLY;else process.env.REACT_APP_DEMO_ONLY=originalDemo;});
function mount(){return render(<MemoryRouter initialEntries={['/forum/moderation']}><ModerationPolicy/></MemoryRouter>);}
const kind=(line:string)=>line.startsWith('### ')?'heading':line.startsWith('- ')?'list':'paragraph';
test.each(codes)('%s: all sixteen complete panels, four nested sanction headings, date, links and ARIA',lang=>{
 mockLang=lang;const view=mount();
 expect(screen.getByRole('heading',{name:content.titles[lang]})).toBeInTheDocument();
 expect(screen.getByText(content.effectiveDate[lang])).toBeInTheDocument();
 const panels=view.container.querySelectorAll('details');expect(panels).toHaveLength(16);
 panels.forEach((panel,index)=>{const [heading,body]=content.rules[lang][index],q=within(panel).getByRole('button');
  expect(q).toHaveTextContent(`${index+1}. ${heading}`);expect(panel.open).toBe(false);expect(q).toHaveAttribute('aria-expanded','false');
  const answer=document.getElementById(q.getAttribute('aria-controls')!)!;expect(answer).toHaveAttribute('aria-labelledby',q.id);expect(answer).not.toBeVisible();
  expect(Array.from(answer.querySelectorAll('p,li,h3')).map(n=>n.textContent)).toEqual(body.split('\n').map(l=>l.replace(/^(### |- )/,'')));
  expect(answer.querySelectorAll('li')).toHaveLength(body.split('\n').filter(l=>l.startsWith('- ')).length);
  expect(answer.querySelectorAll('h3')).toHaveLength(index===6?4:0);
  fireEvent.click(q);expect(panel.open).toBe(true);expect(q).toHaveAttribute('aria-expanded','true');expect(answer).toBeVisible();fireEvent.click(q);expect(panel.open).toBe(false);
 });
 const documentLinks=panels[15].querySelectorAll('a');expect(Array.from(documentLinks).map(a=>a.getAttribute('href'))).toEqual(['/terms','/forum/rules','/activity-limits','/privacy']);
 expect(screen.queryByTestId('technical-moderation')).not.toBeInTheDocument();expect(fetch).not.toHaveBeenCalled();
});
test('RU source preserved verbatim except the explicitly approved date; forum date unchanged',()=>{
 expect(content.rules.ru.map(s=>s[0])).toEqual('Назначение модерации|Как работает проверка материалов|Жалобы пользователей|Принципы принятия решений|Уведомления о решениях|Подтверждённые нарушения|Система санкций|Серьёзные нарушения|Форум и основной аккаунт Cashback+|Вознаграждения и форумные санкции|Апелляции|Рассмотрение апелляций|Сроки рассмотрения|Журнал решений|Независимость модерации|Важная информация'.split('|'));
 const body=content.rules.ru.flatMap(s=>s[1].split('\n').filter(l=>!l.startsWith('### '))).join('\n');
 expect(createHash('sha256').update(body).digest('hex')).toBe('38a618f4cb4ec39e4ce09ed7d8f55225de536ffda4a819f09b77d8746189630a');
 expect(content.effectiveDate.ru).toBe('Дата вступления в силу: 30 октября 2026 года');
 expect(forumContent.document.ru.effectiveDate).toBe('Дата вступления в силу: 30 сентября 2026 года');
 expect(content.rules.ru[6][1].match(/\d+/g)).toEqual(['30','180']);
 expect(content.rules.ru[12][1].match(/\d+/g)).toEqual(['14','30']);
 expect(content.rules.ru[6][1]).toContain('Иные ограничения не применяются.');
});
test.each(['en','de','fr'] as const)('%s: complete translation with every list, heading and numeric condition',lang=>{
 expect(content.rules[lang]).toHaveLength(16);
 content.rules[lang].forEach(([title,body],i)=>{expect(/[А-Яа-яЁё]/.test(title+body)).toBe(false);expect(body.split('\n').map(kind)).toEqual(content.rules.ru[i][1].split('\n').map(kind));expect(body.match(/\d+/g)).toEqual(content.rules.ru[i][1].match(/\d+/g));});
});
test('keyboard toggling preserves focus and multiple panels; language switch resets them',()=>{
 const view=mount(),q=view.container.querySelectorAll('summary');q[0].focus();fireEvent.keyDown(q[0],{key:'Enter'});fireEvent.keyDown(q[1],{key:' '});expect(view.container.querySelectorAll('details[open]')).toHaveLength(2);expect(document.activeElement).toBe(q[0]);fireEvent.keyDown(q[0],{key:' '});expect(view.container.querySelectorAll('details[open]')).toHaveLength(1);mockLang='de';view.rerender(<MemoryRouter><ModerationPolicy/></MemoryRouter>);expect(view.container.querySelectorAll('details[open]')).toHaveLength(0);
});
test.each(['true','false'])('authenticated policy links to relocated controls, demo=%s',demo=>{
 process.env.REACT_APP_DEMO_ONLY=demo;mockAuth={user:{id:1,email_verified:true},token:'fixture',loading:false};mount();
 expect(screen.getByRole('link',{name:'Моя активность'})).toHaveAttribute('href','/my-activity#my-activity-restrictions');
 expect(screen.queryByTestId('technical-moderation')).toBeNull();expect(fetch).not.toHaveBeenCalled();
});

test('auth loading never starts technical moderation',()=>{process.env.REACT_APP_DEMO_ONLY='false';mockAuth={user:{id:1},token:'fixture',loading:true};mount();expect(screen.queryByTestId('technical-moderation')).not.toBeInTheDocument();});
