import React from 'react';
import {createHash} from 'crypto';
import {fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import PrivacyPolicy from './PrivacyPolicy';
import content from '../content/privacyPolicy.json';
jest.mock('../components/Footer',()=>()=>null);
const codes=['ru','en','de','fr'] as const;
function mount(lang:string){return render(<MemoryRouter><PrivacyPolicy lang={lang}/></MemoryRouter>);}
test.each(codes)('%s: eighteen closed panels, exact complete contents, lists, nested headings and links',lang=>{
 const view=mount(lang);expect(screen.getByRole('heading',{name:content.title[lang]})).toBeInTheDocument();expect(screen.getByText(content.effectiveDate[lang])).toBeInTheDocument();
 const panels=view.container.querySelectorAll('details');expect(panels).toHaveLength(18);
 panels.forEach((panel,index)=>{const [heading,body]=content.rules[lang][index],q=within(panel).getByRole('button');
  expect(q).toHaveTextContent(`${index+1}. ${heading}`);expect(q).toHaveAttribute('aria-expanded','false');expect(panel.open).toBe(false);
  const answer=document.getElementById(q.getAttribute('aria-controls')!)!;expect(answer).toHaveAttribute('aria-labelledby',q.id);expect(answer).not.toBeVisible();
  expect(Array.from(answer.querySelectorAll('p,li,h3')).map(n=>n.textContent)).toEqual(body.split('\n').map(l=>l.replace(/^(### |- )/,'')));
  expect(answer.querySelectorAll('li')).toHaveLength(body.split('\n').filter(l=>l.startsWith('- ')).length);
  expect(answer.querySelectorAll('h3')).toHaveLength(index===2?5:index===4?4:0);
  fireEvent.click(q);expect(panel.open).toBe(true);expect(q).toHaveAttribute('aria-expanded','true');expect(answer).toBeVisible();fireEvent.click(q);expect(panel.open).toBe(false);
 });
 const mail=view.container.querySelectorAll('a[href^="mailto:"]');expect(mail).toHaveLength(4);mail.forEach(a=>expect(a).toHaveAttribute('href','mailto:'+a.textContent));
 expect(screen.getByRole('link',{name:'https://ico.org.uk',hidden:true})).toHaveAttribute('href','https://ico.org.uk');
 expect(screen.getByRole('link',{name:'https://ico.org.uk',hidden:true})).toHaveAttribute('rel','noopener noreferrer');
 expect(screen.getByRole('link',{name:content.cookieLinkText[lang],hidden:true})).toHaveAttribute('href','/cookies');
});
test('RU body matches the supplied text verbatim, approved headings and September date',()=>{
 expect(content.rules.ru.map(s=>s[0])).toEqual('Кто мы|Контролёр персональных данных|Какие данные мы обрабатываем|Цели обработки данных|Правовые основания обработки|Передача данных третьим лицам|Международная передача данных|Сроки хранения данных|Защита данных|Права пользователей|Рассмотрение обращений|Жалобы в ICO|Автоматизированная обработка данных|Cookie и аналогичные технологии|Возрастные ограничения|Характер платформы и вознаграждений|Изменение Политики|Контакты'.split('|'));
 const body=content.rules.ru.flatMap(s=>s[1].split('\n').filter(l=>!l.startsWith('### '))).join('\n');expect(createHash('sha256').update(body).digest('hex')).toBe('069352fae89866e7b0ef1592fdd5eed1aa1f6b339160c8c1d98be601d80a16c7');
 expect(content.effectiveDate.ru).toBe('Дата вступления в силу: 30 сентября 2026 года');
 expect(content.rules.ru[2][1].split('\n').filter(l=>l.startsWith('### ')).map(l=>l.slice(4))).toEqual(['Данные учётной записи','Данные, связанные с вознаграждениями','Технические данные','Данные местоположения','Информация об исследованиях']);
 expect(content.rules.ru[4][1].split('\n').filter(l=>l.startsWith('### ')).map(l=>l.slice(4))).toEqual(['Исполнение договора','Законный интерес','Согласие пользователя','Юридические обязанности']);
});
test.each(['en','de','fr'] as const)('%s: all paragraphs, numeric values, contacts and nine subheadings translated',lang=>{
 const kind=(l:string)=>l.startsWith('### ')?'heading':l.startsWith('- ')?'list':'paragraph';
 content.rules[lang].forEach(([heading,body],i)=>{const ru=content.rules.ru[i][1];expect(/[А-Яа-яЁё]/.test(heading+body)).toBe(false);expect(body.split('\n').map(kind)).toEqual(ru.split('\n').map(kind));expect(body.match(/\d+/g)).toEqual(ru.match(/\d+/g));expect(body.match(/[\w.]+@cashbackplus\.uk|https:\/\/ico\.org\.uk/g)).toEqual(ru.match(/[\w.]+@cashbackplus\.uk|https:\/\/ico\.org\.uk/g));});
 expect(content.effectiveDate[lang]).toMatch(/30.*2026/);
});
test('Enter and Space keep panels independent, links do not toggle them, language change resets them',()=>{
 const view=mount('ru'),q=view.container.querySelectorAll('summary');q[0].focus();fireEvent.keyDown(q[0],{key:'Enter'});fireEvent.keyDown(q[1],{key:' '});expect(view.container.querySelectorAll('details[open]')).toHaveLength(2);expect(document.activeElement).toBe(q[0]);fireEvent.click(view.container.querySelector('a[href="mailto:privacy@cashbackplus.uk"]')!);expect(view.container.querySelectorAll('details[open]')).toHaveLength(2);fireEvent.keyDown(q[0],{key:' '});expect(view.container.querySelectorAll('details[open]')).toHaveLength(1);view.rerender(<MemoryRouter><PrivacyPolicy lang="de"/></MemoryRouter>);expect(view.container.querySelectorAll('details[open]')).toHaveLength(0);
});
