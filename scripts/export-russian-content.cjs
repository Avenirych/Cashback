'use strict';
// Read-only source export. No database access; deterministic public initial state only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),front=path.join(root,'cashback-frontend'),deps=path.join(front,'node_modules');
const ts=require(path.join(deps,'typescript')),React=require(path.join(deps,'react'));
const {renderToStaticMarkup}=require(path.join(deps,'react-dom/server'));
const router=require(path.join(deps,'react-router-dom'));
const {JSDOM}=require(path.join(deps,'jsdom'));
// Match the local frontend build flags; do not export inactive review example branches.
Object.assign(process.env,{REACT_APP_API_BASE:'http://localhost:3006',REACT_APP_REVIEWS_MODE:'demo',REACT_APP_DEMO_ONLY:'true',REACT_APP_LOCAL_DEMO_REVIEWS:'true',REACT_APP_ACTIVITY_LIMITS:'true'});
const destination=process.argv[2];
if(!destination||!path.resolve(destination).toLowerCase().startsWith('d:\\cashback+ archive\\'))throw Error('Export must be on D archive');
const original=cp.execFileSync('git',['rev-parse','341fd6d^'],{cwd:root,encoding:'utf8'}).trim();
const source=(file,rev)=>rev?cp.execFileSync('git',['show',`${rev}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(root,file),'utf8');
global.localStorage={getItem:key=>key==='lang'?'ru':null,setItem(){},removeItem(){}};
global.window={location:{search:'',hash:'',pathname:'/'},localStorage:global.localStorage,matchMedia:()=>({matches:false})};
global.document=new JSDOM('').window.document;
Object.defineProperty(global.document,'visibilityState',{value:'visible'});
function loader(rev){
 const cache=new Map();
 function load(file){
  file=file.replace(/\\/g,'/');if(cache.has(file))return cache.get(file).exports;
  if(/\.(css|svg|png|jpe?g)$/.test(file))return {};
  if(file.endsWith('context/LanguageContext.tsx'))return {useLang:()=>({lang:'ru',setLang(){}})};
  if(file.endsWith('context/AuthContext.tsx'))return {useAuth:()=>({user:null,token:null,loading:false,forumUser:null})};
  if(file.endsWith('context/BonusesContext.tsx'))return {useBonuses:()=>({items:[],transfers:[],loading:false})};
  if(file.endsWith('/onboarding.ts'))return {useOnboarding:()=>({eligible:false,loading:false})};
  const text=source(file,rev);if(file.endsWith('.json'))return JSON.parse(text);
  const mod={exports:{}};cache.set(file,mod);
  function req(name){
   if(!name.startsWith('.'))return require(require.resolve(name,{paths:[front]}));
   const stem=path.posix.normalize(path.posix.join(path.posix.dirname(file),name));
   const candidates=[stem,...['.tsx','.ts','.jsx','.js','.json'].map(ext=>stem+ext)];
   const found=candidates.find(p=>fs.existsSync(path.join(root,p)))||candidates[1];
   return load(found);
  }
  const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function('require','module','exports','process',code)(req,mod,mod.exports,process);return mod.exports;
 }return load;
}
const pages=[
 ['Главная','/','Welcome.tsx'],['О проекте','/about','AboutUs.jsx'],['Услуги','/services','Services.jsx'],
 ['Покупки','/shop','Shop.tsx'],['Сравнение предложений','/product-offers','ProductOffers.tsx'],
 ['Бонусы','/bonuses','Bonuses.tsx'],['Видео','/bonuses/ads','BonusAds.tsx'],['Исследования','/bonuses/research','BonusResearch.tsx'],
 ['Форум','/forum','TopicsPage.tsx'],['FAQ','/faq','FAQ.tsx'],['Контакты','/contacts','Contacts.tsx'],
 ['Условия использования','/terms','TermsAndConditions.tsx'],['Конфиденциальность','/privacy','PrivacyPolicy.tsx'],
 ['Cookies','/cookies','CookiePolicy.tsx'],['Правила форума','/forum/rules','ForumRules.tsx'],['Правила активности','/activity-limits','ActivityRules.tsx'],
 ['Подключение партнёра','/partner-not-connected','PartnerNotConnected.tsx'],
];
const result={originalCommit:original,initialHead:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),pages:[]};
const oldLoad=loader(original),newLoad=loader(null);
function render(load,file,route,params){
 const component=load(file).default;
 const lowerCaseProp=/\/(AboutUs|Services|Contacts)\./.test(file);
 const element=React.createElement(component,{lang:lowerCaseProp?'ru':'RU',onLangChange(){}});
 const routed=React.createElement(router.MemoryRouter,{initialEntries:[route]},params?React.createElement(router.Routes,null,React.createElement(router.Route,{path:'/bonuses/research/:directionId',element})):element);
 const dom=new JSDOM(renderToStaticMarkup(routed));
 const doc=dom.window.document;
 doc.querySelectorAll('footer,nav,script,style,img').forEach(n=>n.remove());
 const texts=[];
 function walk(node){
  if(node.nodeType===3){const value=node.textContent;if(value.trim())texts.push(value);return;}
  if(node.nodeType!==1)return;
  if(node.tagName==='INPUT'||node.tagName==='TEXTAREA'){if(node.getAttribute('placeholder'))texts.push('\n'+node.getAttribute('placeholder')+'\n');}
  const block=/^(H[1-6]|P|LI|DIV|SECTION|ARTICLE|ASIDE|MAIN|SUMMARY|DT|DD|BUTTON|LABEL|TR|DETAILS|OL|UL)$/.test(node.tagName);
  if(block)texts.push('\n');node.childNodes.forEach(walk);if(block)texts.push('\n');
 }
 doc.body.childNodes.forEach(walk);
 return {text:texts.join('').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim(),h1:doc.querySelectorAll('h1').length};
}
const directions=newLoad('cashback-frontend/src/researchData.ts').directions;
for(const direction of directions)pages.push([direction.ru.title,'/bonuses/research/'+direction.id,'ResearchDirection.tsx',true]);
for(const [title,route,name,params]of pages){
 const file='cashback-frontend/src/pages/'+name;
 const entry={title,route,file,sourceCommit:cp.execFileSync('git',['log','-1','--format=%H',original,'--',file],{cwd:root,encoding:'utf8'}).trim()};
 for(const [key,load]of [['original',oldLoad],['revised',newLoad]]){
  try{entry[key]=render(load,file,route,params);}catch(error){entry[key]={error:error.message,text:'Достоверно извлечь текст этой страницы не удалось. Требуется проверка исходного файла.',h1:null};}
 }
 if(route==='/terms')entry.original={text:'Русская редакция до 341fd6d достоверно не найдена. Компонент TermsAndConditions.tsx в подтверждённом исходном состоянии содержит только английский текст. Перевод не выдаётся за авторский оригинал.',h1:null,missingRussianOriginal:true};
 result.pages.push(entry);
}
fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,'page-texts.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({pages:result.pages.length,errors:result.pages.flatMap(p=>['original','revised'].filter(k=>p[k].error).map(k=>({route:p.route,version:k,error:p[k].error}))),destination}));
