import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { FORUM_RULES } from './forum-rules';
const document = JSON.parse(readFileSync('cashback-frontend/src/content/forumRules.json', 'utf8'));
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
// Pinned after comparison with the owner's approved attachment, not with the old API.
const approvedDigests = {
  "en": "5eef385d28c182920559d21de48eda3916fa39147341bbb6e6ed39a556478509",
  "ru": "27e6db540310e0856867dbf67345a1c7e97e77b46a84e5c7c3610c3ce5266250",
  "de": "f055c09957fa3ce8883823a54ba6ba493f9d8fa93c28babdc7adc680927c507d",
  "fr": "7eb41d6d2f20d9fc2c064e45d2f58e014d72a79b9b44364d6c82efb18626a7d5"
};
const codes = ['en','ru','de','fr'] as const;
test.each(codes)('%s: complete approved document, order and legacy string contract', lang => {
  expect(typeof FORUM_RULES[lang]).toBe('string');
  expect(digest(FORUM_RULES[lang])).toBe(approvedDigests[lang]);
  expect(document.backendDigests[lang]).toBe(approvedDigests[lang]);
  expect(FORUM_RULES[lang]).toBe(document.rules[lang].map((s: string[]) => s.join('\n')).join('\n\n'));
  const sections = document.rules[lang] as string[][];
  expect(sections).toHaveLength(20);
  expect(new Set(sections.map(s => s[0])).size).toBe(20);
  expect(new Set(sections.map(s => s[1])).size).toBe(20);
  let previous = -1;
  sections.forEach(([heading, body], index) => {
    expect(heading.length).toBeGreaterThan(5); expect(body.length).toBeGreaterThan(80);
    const offset = FORUM_RULES[lang].indexOf(heading+'\n');
    expect(offset).toBeGreaterThan(previous); previous=offset;
    expect(body.split('\n').map(line=>line.startsWith('- '))).toEqual(document.rules.ru[index][1].split('\n').map((line:string)=>line.startsWith('- ')));
    if(lang!=='ru')expect(/[А-Яа-яЁё]/.test(heading+body)).toBe(false);
  });
});
test('only the four existing language keys are exposed; no wire-format IDs are introduced',()=>{
  expect(Object.keys(FORUM_RULES).sort()).toEqual(['de','en','fr','ru']);
});
test('approved Russian source, effective date and complete body remain verbatim',()=>{
  expect(document.sourceSha256).toBe('6ec5a00dbf1b8ac17550247f3d1e192adb46662d513cd9fa777d7ff3a41ecc71');
  expect(digest(document.rules.ru.map((s:string[])=>s[1]).join('\n'))).toBe('2605cbabd42032d1f76d3b2cee711e5511dda3d2f5066acc119f05067cfda020');
  expect(document.document.ru.effectiveDate).toBe('Дата вступления в силу: 30 сентября 2026 года');
});
test('sanction and retention periods remain the approved calendar periods',()=>{
 for(const text of ['1 календарный месяц','6 календарных месяцев','7 календарных дней'])expect(FORUM_RULES.ru).toContain(text);
 for(const text of ['1 calendar month','6 calendar months','7 calendar days'])expect(FORUM_RULES.en).toContain(text);
 for(const text of ['1 Kalendermonat','6 Kalendermonate','7 Kalendertage'])expect(FORUM_RULES.de).toContain(text);
 for(const text of ['1 mois calendaire','6 mois calendaires','7 jours calendaires'])expect(FORUM_RULES.fr).toContain(text);
});
