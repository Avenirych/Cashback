import React from 'react';
import {createHash} from 'crypto';
import {fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {LanguageProvider} from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ForumRules,{forumRules,rulesLabels} from './ForumRules';
import ForumRegister from './ForumRegister';
import {useAuth} from '../context/AuthContext';
import content from '../content/forumRules.json';
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
const codes=['ru','en','de','fr'] as const;
beforeEach(()=>{localStorage.clear();(useAuth as jest.Mock).mockReturnValue({user:{id:1,email:'buyer@example.invalid',name:'Buyer',email_verified:true},forumLoading:false,registerForum:jest.fn(),checkForumStatus:jest.fn()});global.fetch=jest.fn();});
function mount(lang:string,registration=false){localStorage.setItem('lang',lang);return render(<LanguageProvider><MemoryRouter><LanguageSwitcher/>{registration?<ForumRegister/>:<ForumRules/>}</MemoryRouter></LanguageProvider>);}
function verify(container:HTMLElement,code:typeof codes[number]){
 const panels=container.querySelectorAll('details');expect(panels).toHaveLength(20);
 panels.forEach((panel,i)=>{const [heading,body]=forumRules[code][i],summary=within(panel).getByRole('button');
  expect(summary).toHaveAttribute('id',`forum-rule-${code}-${i}-heading`);
  expect(summary).toHaveAttribute('aria-controls',`forum-rule-${code}-${i}`);
  expect(summary).toHaveTextContent(`${i+1}. ${heading}`);expect(summary).toHaveAttribute('aria-expanded','false');expect(panel.open).toBe(false);
  const answer=document.getElementById(summary.getAttribute('aria-controls')!)!;
  expect(answer).toHaveAttribute('aria-labelledby',summary.id);expect(answer).not.toBeVisible();
  expect(Array.from(answer.querySelectorAll('p,li')).map(n=>n.textContent)).toEqual(body.split('\n').map(line=>line.replace(/^- /,'')));
  expect(answer.querySelectorAll('li')).toHaveLength(body.split('\n').filter(line=>line.startsWith('- ')).length);
  fireEvent.click(summary);expect(panel.open).toBe(true);expect(summary).toHaveAttribute('aria-expanded','true');expect(answer).toBeVisible();
  fireEvent.click(summary);expect(panel.open).toBe(false);
 });
}
test.each(codes)('%s: twenty complete closed panels, correct order, lists, effective date',code=>{const view=mount(code);expect(screen.getByRole('heading',{name:rulesLabels[code].title})).toBeInTheDocument();expect(screen.getByText(content.document[code].effectiveDate)).toBeInTheDocument();verify(view.container,code);expect(fetch).not.toHaveBeenCalled();});
test('RU source content and date are verbatim and headings match the approved list',()=>{
 expect(forumRules.ru.map(s=>s[0])).toEqual('Назначение форума|Общие правила поведения|Конфиденциальность и личность|Правила публикации материалов|Отзывы пользователей и достоверность|Запрещённый контент|Пользовательский контент|Независимость форума|Законодательство и предупреждения|Автоматизированная проверка|Модерация|Использование системы жалоб|Проверка публикаций|Подтверждённые нарушения и санкции|Апелляции|Удаление форумного аккаунта|Безвозвратное удаление темы|Локальные демонстрационные отзывы|Изменение Правил форума|Важная информация'.split('|'));
 expect(content.document.ru.effectiveDate).toBe('Дата вступления в силу: 30 сентября 2026 года');
 expect(content.sourceSha256).toBe('6ec5a00dbf1b8ac17550247f3d1e192adb46662d513cd9fa777d7ff3a41ecc71');
 const canonical=forumRules.ru.map(s=>s[1]).join('\n');expect(createHash('sha256').update(canonical).digest('hex')).toBe('2605cbabd42032d1f76d3b2cee711e5511dda3d2f5066acc119f05067cfda020');
 for(const phrase of ['1 календарный месяц','6 календарных месяцев','7 календарных дней'])expect(canonical).toContain(phrase);
});
test.each(['en','de','fr'] as const)('%s: full paragraph/list structure and no Russian fallback',code=>{expect(forumRules[code]).toHaveLength(20);forumRules[code].forEach(([h,b],i)=>{expect(/[А-Яа-яЁё]/.test(h+b)).toBe(false);expect(b.split('\n').map(line=>line.startsWith('- '))).toEqual(forumRules.ru[i][1].split('\n').map(line=>line.startsWith('- ')));});});
test('Enter/Space toggle independent panels, preserve focus, and language changes reset them',()=>{const view=mount('ru'),buttons=view.container.querySelectorAll('summary');buttons[0].focus();fireEvent.keyDown(buttons[0],{key:'Enter'});fireEvent.keyDown(buttons[1],{key:' '});expect(view.container.querySelectorAll('details[open]')).toHaveLength(2);expect(document.activeElement).toBe(buttons[0]);fireEvent.keyDown(buttons[0],{key:' '});expect(view.container.querySelectorAll('details[open]')).toHaveLength(1);fireEvent.change(screen.getByRole('combobox'),{target:{value:'de'}});expect(screen.getByRole('heading',{name:rulesLabels.de.title})).toBeInTheDocument();expect(view.container.querySelectorAll('details[open]')).toHaveLength(0);});
test.each(codes)('%s: registration reuses twenty panels and keeps consent required and OFF',code=>{const view=mount(code,true);verify(screen.getByRole('region',{name:rulesLabels[code].preview}),code);const consent=screen.getByRole('checkbox',{name:rulesLabels[code].agree});expect(consent).toBeRequired();expect(consent).not.toBeChecked();fireEvent.change(screen.getByRole('combobox'),{target:{value:codes[(codes.indexOf(code)+1)%4]}});expect(view.container.querySelectorAll('details[open]')).toHaveLength(0);expect(screen.getByRole('checkbox',{name:rulesLabels[codes[(codes.indexOf(code)+1)%4]].agree})).not.toBeChecked();expect((useAuth as jest.Mock).mock.results[0].value.registerForum).not.toHaveBeenCalled();});
test('unsupported language never silently substitutes a document',()=>{const view=mount('es');expect(view.container.querySelector('details')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'DE'}));expect(screen.getByRole('heading',{name:rulesLabels.de.title})).toBeInTheDocument();});
