import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scope={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/content/siteContent.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:scope});
const routes = [
  ['/', 'Welcome'], ['/about', 'AboutUs'], ['/services', 'Services'],
  ['/shop', 'Shop'], ['/forum', 'TopicsPage'], ['/bonuses', 'Bonuses'],
  ['/bonuses/ads', 'BonusAds'], ['/bonuses/research', 'BonusResearch'],
  ['/cookies', 'CookiePolicy'], ['/faq', 'FAQ'], ['/contacts', 'Contacts'], ['/terms', 'TermsAndConditions'],
  ['/privacy', 'PrivacyPolicy'], ['/product-offers', 'ProductOffers'],
  ['/forum/rules', 'ForumRules'],
];
const titles = {
  '/': ['Главная', 'Home'], '/about': ['О нас', 'About us'],
  '/services': ['Как это работает', 'How it works'], '/shop': ['Магазин', 'Shop'],
  '/forum': ['Форум', 'Forum'], '/bonuses': ['Бонусы', 'Bonuses'],
  '/bonuses/ads': ['Реклама', 'Advertising bonuses'],
  '/bonuses/research': ['Исследования', 'Research'],
  '/faq': ['Вопросы и ответы', 'FAQ'], '/contacts': ['Контакты', 'Contacts'],
  '/terms': ['Условия использования', 'Terms'],
  '/cookies': ['Политика Cookies', 'Cookie Policy'],
  '/privacy': ['Конфиденциальность', 'Privacy'],
  '/product-offers': ['Предложения', 'Product offers'],
  '/forum/rules': ['Правила форума', 'Forum rules'],
};


function strings(value){return typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];}
routes.push(['/activity-limits','ActivityRules']);titles['/activity-limits']=['Правила активности','Activity rules'];
const index=routes.map(([url])=>{const page=scope.informationPages[url.slice(1)];const items=url==='/faq'?scope.faqSections:page?page.sections.map(id=>scope.sections[id]):Object.values(scope.sections);const text=[...strings(page?scope.labels[page.title]:titles[url]),...strings(items)].join(' ').replace(/\s+/g,' ').trim();return {path:url,title:titles[url][0],titleEn:titles[url][1],text};});
const output=path.join(root,'public/search-index.json');fs.writeFileSync(output,JSON.stringify(index,null,2)+'\n');console.log('Search index created: '+index.length+' reviewed public pages');
