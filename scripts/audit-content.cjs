'use strict';
// Reproducible read-only content inventory and solicitor handover export. No credentials.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ts=require('../cashback-frontend/node_modules/typescript');
const root=path.resolve(__dirname,'..'),front=path.join(root,'cashback-frontend/src');
const destination=process.argv[2];
if(!destination||!path.resolve(destination).toLowerCase().startsWith('d:\\cashback+ archive\\'))throw Error('Use the approved D archive');
fs.mkdirSync(destination,{recursive:true});
function loadContent(){const out={};const text=fs.readFileSync(path.join(front,'content/siteContent.ts'),'utf8');const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('exports',js)(out);return out;}
const content=loadContent(),routes=[],seen=new Set(),files=[],strings=[];
const app=fs.readFileSync(path.join(front,'App.tsx'),'utf8');
function routeWalk(node,prefix=''){
 if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)){
  const opening=ts.isJsxElement(node)?node.openingElement:node;
  if(opening.tagName.getText()==='Route'){
   const attr=opening.attributes.properties.find(x=>x.name?.getText()==='path'),index=opening.attributes.properties.some(x=>x.name?.getText()==='index');
   const value=attr?.initializer&&ts.isStringLiteral(attr.initializer)?attr.initializer.text:null;
   const resolved=value?(value.startsWith('/')||value==='*'?value:prefix.replace(/\/$/,'')+'/'+value):prefix;
   if(value||index){routes.push({route:resolved,access:/profile|dashboard|forum\/register|bonuses\/research\/:/.test(resolved)?'authenticated / eligibility guarded':'public or action guarded',element:opening.attributes.properties.find(x=>x.name?.getText()==='element')?.getText()||'nested route',status:'reviewed; existing route retained'});}
   if(ts.isJsxElement(node))node.children.forEach(x=>routeWalk(x,resolved));return;
  }
 }
 ts.forEachChild(node,x=>routeWalk(x,prefix));
}
routeWalk(ts.createSourceFile('App.tsx',app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX));
function visit(file){if(seen.has(file)||!fs.existsSync(file))return;seen.add(file);const text=fs.readFileSync(file,'utf8'),relative=path.relative(root,file),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,/jsx?$/.test(file)?ts.ScriptKind.JSX:ts.ScriptKind.TSX);files.push(relative);
 function walk(n){if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text.startsWith('.')){const stem=path.resolve(path.dirname(file),n.moduleSpecifier.text);const next=[stem,...['.tsx','.ts','.jsx','.js','.json','/index.tsx','/index.ts'].map(s=>stem+s)].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());if(next&&/\.(tsx?|jsx?)$/.test(next))visit(next);}
  if(ts.isJsxText(n)&&n.getText(ast).trim())strings.push({file:relative,line:ast.getLineAndCharacterOfPosition(n.pos).line+1,kind:'JSX text',text:n.getText(ast).trim()});
  if(ts.isStringLiteral(n)&&n.text.length>3&&!ts.isImportDeclaration(n.parent)&&!/^(\.\.?\/|https?:|#)/.test(n.text))strings.push({file:relative,line:ast.getLineAndCharacterOfPosition(n.pos).line+1,kind:'literal; runtime reachability needs review',text:n.text});
  ts.forEachChild(n,walk);
 }walk(ast);
}
visit(path.join(front,'App.tsx'));
const uniqueRoutes=[...new Map(routes.map(r=>[r.route,r])).values()];
fs.writeFileSync(path.join(destination,'A-route-and-text-inventory.json'),JSON.stringify({routes:uniqueRoutes,reachableModules:files,texts:strings},null,2));
fs.writeFileSync(path.join(destination,'A-pages.md'),'# Route inventory\n\n'+uniqueRoutes.map(r=>`- ${r.route}: ${r.access}; ${r.status}.`).join('\n')+'\n\nNested/parameter routes are counted as patterns, not fictional records. Non-imported legacy pages are not public routes. Raw literals include disabled branches and internal keys and are not falsely labelled as rendered text.\n');
for(const l of ['en','ru','de','fr']){
 let out=`# Cashback+ — ${l.toUpperCase()} review text\n\nReview date: 2026-10-24. Draft for solicitor review; no language is assigned precedence.\n\n${content.labels.draft[l]}\n`;
 for(const [id,p]of Object.entries(content.informationPages)){out+=`\n# /${id}: ${content.labels[p.title][l]}\n`;for(const key of p.sections){const s=content.sections[key];out+=`\n## ${s.title[l]}\n\n${s.body[l]}\n`;}}
 out+='\n# FAQ\n';for(const s of content.faqSections)out+=`\n## ${s.title[l]}\n\n${s.body[l]}\n`;
 fs.writeFileSync(path.join(destination,`D-full-drafts-${l.toUpperCase()}.md`),out);
}
fs.writeFileSync(path.join(destination,'E-language-alignment.json'),JSON.stringify({languages:['en','ru','de','fr'],faqCount:content.faqSections.length,sections:Object.entries(content.sections).map(([id,s])=>({id,missing:['en','ru','de','fr'].filter(l=>!s.title[l]||!s.body[l])})),terms:{reward:['reward','вознаграждение','Vergütung','récompense'],cashback:['cashback','cashback','Cashback','cashback'],pending:['pending confirmation','ожидает подтверждения','Bestätigung ausstehend','en attente de confirmation'],demo:['demonstration','демонстрация','Demonstration','démonstration'],appeal:['appeal','обращение о пересмотре','Einspruch','recours']},noLanguagePrecedenceClaimed:true},null,2));
fs.writeFileSync(path.join(destination,'F-changed-files.txt'),cp.execFileSync('git',['diff','--name-only'],{cwd:root,encoding:'utf8'}));
console.log(JSON.stringify({routePatterns:uniqueRoutes.length,reachableModules:files.length,textEntries:strings.length,faqCount:content.faqSections.length,destination}));
