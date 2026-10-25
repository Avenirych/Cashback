import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const output = path.join(root, 'public', 'search-index.json');

// Only public, non-personal pages. Routes are taken from src/App.tsx.
const routes = [
  ['/', 'Welcome'], ['/about', 'AboutUs'], ['/services', 'Services'],
  ['/shop', 'Shop'], ['/forum', 'TopicsPage'], ['/bonuses', 'Bonuses'],
  ['/bonuses/ads', 'BonusAds'], ['/bonuses/research', 'BonusResearch'],
  ['/cookies', 'CookiePolicy'], ['/faq', 'FAQ'], ['/contacts', 'Contacts'], ['/terms', 'TermsAndConditions'],
  ['/privacy', 'PrivacyPolicy'], ['/product-offers', 'ProductOffers'],
  ['/forum/rules', 'ForumRules'],
  ['/activity-limits', 'ActivityRules'], ['/forum/moderation', 'ModerationPolicy'],
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
  '/activity-limits': ['Правила активности', 'Activity rules'],
  '/forum/moderation': ['Модерация, уведомления и апелляции', 'Moderation, notices and appeals'],
};
const publicDocuments = {
  '/forum/rules': 'forumRules.json', '/activity-limits': 'activityRules.json',
  '/forum/moderation': 'moderationRules.json', '/privacy': 'privacyPolicy.json',
  '/terms': 'termsPolicy.json', '/cookies': 'cookiePolicy.json',
};

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
function stripCode(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\n)\s*\/\/[^\n]*/g, ' ')
    .replace(/\b(?:import|export)\s+[^;]*?\s+from\s+['"][^'"]+['"];?/g, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
}
function extract(code) {
  const clean = stripCode(code);
  const fragments = [];
  // Static text between JSX tags.
  for (const match of clean.matchAll(/>([^<>{}\n][^<>{}]*?)</g)) fragments.push(match[1]);
  // String values in translation dictionaries, attributes, and page copy.
  for (const match of clean.matchAll(/(?:\b(?:title|description|question|answer|label|placeholder|text|heading|subtitle)\b\s*[:=]\s*)["'`]([^"'`]{3,300})["'`]/g)) fragments.push(match[1]);
  return fragments.join(' ').replace(/&(?:amp|nbsp|quot|lt|gt);/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 16000);
}

// Parse only reviewed public source files. Never execute a page or inspect APIs.
const scope = {};
vm.runInNewContext(ts.transpileModule(read(path.join(src,'i18n.ts')), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports:scope});
function strings(value) { return typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []; }
const index = routes.map(([url, filename]) => {
  const file = ['.tsx','.jsx','.ts','.js'].map(ext=>path.join(src,'pages',filename+ext)).find(fs.existsSync);
  if (!file) throw Error('Missing public page: '+filename);
  const code=read(file), tree=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX), fragments=[];
  function visit(node) {
    if(ts.isJsxText(node)) fragments.push(node.text);
    // Existing pages also keep their public copy in inline RU/EN dictionaries.
    if(ts.isObjectLiteralExpression(node) && node.properties.some(p=>p.name && ['ru','en','RU','EN'].includes(p.name.getText(tree).replace(/["']/g,'')))) {
      const collect=n=>{if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)) fragments.push(n.text);ts.forEachChild(n,collect);};
      collect(node);
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);
  if (publicDocuments[url]) fragments.push(...strings(JSON.parse(read(path.join(src, 'content', publicDocuments[url]))).rules));
  const keys=new Set(Array.from(code.matchAll(/\bt\.([A-Za-z0-9_]+)/g),m=>m[1]));
  for(const dict of Object.values(scope.translations)) for(const [key,value] of Object.entries(dict)) {
    if(keys.has(key)||(url==='/faq'&&key.startsWith('faq'))) fragments.push(...strings(value));
  }
  return {path:url,title:titles[url][0],titleEn:titles[url][1],text:fragments.join(' ').replace(/\s+/g,' ').trim().slice(0,80000)};
});
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(index,null,2)+'\n');
console.log('Search index created: '+index.length+' public pages');
