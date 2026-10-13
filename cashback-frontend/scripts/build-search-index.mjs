import fs from 'node:fs';
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
  ['/faq', 'FAQ'], ['/contacts', 'Contacts'], ['/terms', 'TermsAndConditions'],
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
  '/privacy': ['Конфиденциальность', 'Privacy'],
  '/product-offers': ['Предложения', 'Product offers'],
  '/forum/rules': ['Правила форума', 'Forum rules'],
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
const sharedTranslations = extract(read(path.join(src, 'i18n.ts'))) + ' ' + extract(read(path.join(src, 'i18n', 'index.ts')));
const index = routes.map(([url, filename]) => {
  const candidates = ['.tsx', '.jsx'].map((extension) =>
    path.join(src, 'pages', `${filename}${extension}`),
  );
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) {
    throw new Error(`Missing page: ${candidates.join(' or ')}`);
  }
  return {
    path: url,
    title: titles[url][0],
    titleEn: titles[url][1],
    text: [extract(read(file)), ...(url === '/' || url === '/faq' ? [sharedTranslations] : [])].join(' ').slice(0, 22000),
  };
});
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log(`Search index created: ${index.length} public pages -> ${output}`);
