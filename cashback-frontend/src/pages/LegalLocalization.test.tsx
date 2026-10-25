import React from 'react';
import {createHash} from 'crypto';
import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Terms from './TermsAndConditions';
import Cookies from './CookiePolicy';
import terms from '../content/termsPolicy.json';
import cookies from '../content/cookiePolicy.json';
let mockLang='ru';
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLang})}));
jest.mock('../components/Footer',()=>()=>null);
const codes=['ru','en','de','fr'] as const;
for(const [name,Component,data] of [['Terms',Terms,terms],['Cookies',Cookies,cookies]] as const){
 test.each(codes)(`${name} renders the complete %s document without language fallback`,lang=>{
  mockLang=lang;const view=render(<MemoryRouter><Component/></MemoryRouter>);
  const questions=view.container.querySelectorAll<HTMLButtonElement>('button[aria-controls]');expect(questions).toHaveLength(11);
  data.rules[lang].forEach((section,index)=>{const question=questions[index],answer=document.getElementById(question.getAttribute('aria-controls')!)!;expect(question).toHaveTextContent(section.title);expect(question).toHaveAttribute('aria-expanded','false');fireEvent.click(question);expect(question).toHaveAttribute('aria-expanded','true');
   const expected=section.blocks.flatMap((b:any)=>b.items||[b.text]).map((s:string)=>s.replace(/\*\*/g,''));expect(Array.from(answer.querySelectorAll('p,h3,li')).map(n=>n.textContent)).toEqual(expected);
  });
  if(lang==='de'||lang==='fr')expect(view.container.textContent).not.toContain('The platform');
  expect(screen.getByText(/2026/)).toBeInTheDocument();
 });
}
test('approved Russian legal wording is unchanged',()=>{
 expect(createHash('sha256').update(JSON.stringify(terms.rules.ru)).digest('hex')).toBe('9a720c577c3ea05f9fa8c3fb96c4d59bb721c2d55b12cd60ce61749e637780f8');
 expect(createHash('sha256').update(JSON.stringify(cookies.rules.ru)).digest('hex')).toBe('4c37bb4fedff52cc1719baef7beeb744a45579434b526800560009b8bac3c4da');
});
test.each(['en','de','fr'] as const)('%s translations preserve every block, list item and number',lang=>{for(const data of [terms,cookies])data.rules[lang].forEach((r,i)=>{const ru=data.rules.ru[i];expect(r.blocks.map(b=>b.type)).toEqual(ru.blocks.map(b=>b.type));const shape=(blocks:any[])=>blocks.map(b=>b.items?.length||0);expect(shape(r.blocks)).toEqual(shape(ru.blocks));expect(JSON.stringify(r).match(/\d+/g)).toEqual(JSON.stringify(ru).match(/\d+/g));});});
