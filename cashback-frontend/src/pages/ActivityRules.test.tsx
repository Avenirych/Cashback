import React from 'react';
import {createHash} from 'crypto';
import {fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import ActivityRules from './ActivityRules';
import {activityCopy} from '../components/ActivityLimits';
import content from '../content/activityRules.json';
import {BACKEND_URL} from '../backend';
let mockLang='ru';
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLang})}));
jest.mock('../components/Footer',()=>()=>null);
const codes=['ru','en','de','fr'] as const;
beforeEach(()=>{mockLang='ru';global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({limits:[{action:'video',period:'day',maximum:7},{action:'research',period:'month',maximum:null}]})});});
function mount(){return render(<MemoryRouter><ActivityRules/></MemoryRouter>);}
test.each(codes)('%s: sixteen complete closed sections, lists, ordering and all numeric limits',async lang=>{
 mockLang=lang;const view=mount(),t=activityCopy[lang];
 expect(screen.getByRole('heading',{name:t.rules})).toBeInTheDocument();
 await screen.findByText(`${t.video}: 7 ${t.day} · UTC`);
 expect(screen.getByText(`${t.research}: ${t.unlimited} ${t.month} · UTC`)).toBeInTheDocument();
 expect(screen.getByRole('link',{name:t.title})).toHaveAttribute('href','/profile');
 expect(screen.getByRole('link',{name:t.contact})).toHaveAttribute('href','/contacts');
 const panels=view.container.querySelectorAll('details');expect(panels).toHaveLength(16);
 panels.forEach((panel,i)=>{const section=content.rules[lang][i],summary=within(panel).getByRole('button');
  expect(summary).toHaveTextContent(`${i+1}. ${section.title}`);expect(summary).toHaveAttribute('aria-expanded','false');expect(panel.open).toBe(false);
  const body=document.getElementById(summary.getAttribute('aria-controls')!)!;
  expect(body).toHaveAttribute('aria-labelledby',summary.id);expect(body).not.toBeVisible();
  expect(Array.from(body.querySelectorAll('p,li')).map(n=>n.textContent)).toEqual(section.blocks.flatMap(b=>typeof b==='string'?[b]:b));
  expect(body.querySelectorAll('ul')).toHaveLength(section.blocks.filter(Array.isArray).length);
  fireEvent.click(summary);expect(panel.open).toBe(true);expect(summary).toHaveAttribute('aria-expanded','true');expect(body).toBeVisible();fireEvent.click(summary);expect(panel.open).toBe(false);
 });
 expect(fetch).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledWith(BACKEND_URL+'/activity/policies',{signal:expect.any(AbortSignal)});
 expect(view.container.textContent).not.toContain('[React App]');
});
test('RU wording matches owner source; translations preserve every block, list and number',()=>{
 expect(content.rules.ru.map(s=>s.title)).toEqual('Назначение правил|Кэшбэк|Бонусы|Подтверждение активности|Лимиты активности|Повторные действия|Передача бонусов|Резервирование бонусов|Запрещённая активность|Проверка начислений|Ошибочные начисления|Демонстрационные события|Журнал безопасности|Уровни доступа|Изменение правил|Важная информация'.split('|'));
 const flatten=(rules:typeof content.rules.ru)=>rules.flatMap(s=>s.blocks.flatMap(b=>typeof b==='string'?[b]:b)).join('\n');
 expect(createHash('sha256').update(flatten(content.rules.ru)).digest('hex')).toBe('9d013052a0e76bac9df10f624eb31187576970e6923d4cd675ef0c5d8e9cbdc4');
 for(const code of codes){expect(content.rules[code]).toHaveLength(16);content.rules[code].forEach((s,i)=>{expect(s.blocks.map(b=>typeof b==='string'?0:b.length)).toEqual(content.rules.ru[i].blocks.map(b=>typeof b==='string'?0:b.length));});expect(flatten(content.rules[code]).match(/\d+/g)).toEqual(flatten(content.rules.ru).match(/\d+/g));if(code!=='ru')expect(/[А-Яа-яЁё]/.test(flatten(content.rules[code]))).toBe(false);}
});
test('Enter and Space toggle independently; changing language closes all panels without refetch',async()=>{
 const view=mount();await screen.findByText('Видео: 7 сегодня · UTC');const q=view.container.querySelectorAll('summary');q[0].focus();fireEvent.keyDown(q[0],{key:'Enter'});fireEvent.keyDown(q[1],{key:' '});expect(view.container.querySelectorAll('details[open]')).toHaveLength(2);expect(document.activeElement).toBe(q[0]);fireEvent.keyDown(q[0],{key:' '});expect(view.container.querySelectorAll('details[open]')).toHaveLength(1);mockLang='de';view.rerender(<MemoryRouter><ActivityRules/></MemoryRouter>);expect(view.container.querySelectorAll('details[open]')).toHaveLength(0);expect(screen.getByRole('heading',{name:activityCopy.de.rules})).toBeInTheDocument();expect(fetch).toHaveBeenCalledTimes(1);
});
test.each(['http','network'])('%s error preserves the alert, rules and navigation',async kind=>{
 (fetch as jest.Mock)[kind==='http'?'mockResolvedValueOnce':'mockRejectedValueOnce'](kind==='http'?{ok:false}:new Error('offline'));
 const view=mount();expect(await screen.findByRole('alert')).toHaveTextContent(activityCopy.ru.error);expect(view.container.querySelectorAll('details')).toHaveLength(16);expect(screen.getByRole('link',{name:activityCopy.ru.contact})).toHaveAttribute('href','/contacts');
});
test('unmount aborts the original request',()=>{(fetch as jest.Mock).mockImplementation(()=>new Promise(()=>{}));const view=mount();const signal=(fetch as jest.Mock).mock.calls[0][1].signal;view.unmount();expect(signal.aborted).toBe(true);});
