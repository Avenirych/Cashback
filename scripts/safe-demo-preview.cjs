'use strict';
// Temporary loopback-only visual preview. Never imports the backend, PG or credentials.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'');
if(!root.startsWith('D:\\Cashback+ archive\\')||!fs.existsSync(path.join(root,'index.html')))throw Error('EXPECTED_DISPOSABLE_D_BUILD');
const port=3014,events=[],requests=[];
const author={id:null,username:'DEMO — fictional participant',avatar_url:null,created_at:'2026-10-23T00:00:00Z'};
const topic={id:900001,title:'DEMO — Sample discussion / Пример обсуждения',created_at:'2026-10-23T00:00:00Z',author};
const script=`(()=>{window.addEventListener('error',e=>{if(e.message)fetch('/__preview/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'error',message:e.message})})});window.addEventListener('unhandledrejection',()=>fetch('/__preview/event',{method:'POST',body:JSON.stringify({type:'unhandledrejection'})}));document.addEventListener('click',e=>{const a=e.target.closest?.('a');if(!a)return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||/^\\/(register|login|profile|dashboard|verify-email|forum\\/(register|moderation|reviews\\/new))([/?#]|$)/.test(u.pathname)){e.preventDefault();e.stopImmediatePropagation();location.href='/__preview/disabled'}},true);document.addEventListener('submit',e=>{if(e.target.querySelector('input[type=password],input[type=email]')){e.preventDefault();e.stopImmediatePropagation();location.href='/__preview/disabled'}},true)})();`;
function send(res,code,type,body){res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"});res.end(body);}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+port),p=url.pathname;
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host))return send(res,403,'text/plain','Loopback preview only');
 if(p==='/__preview/event'&&req.method==='POST'){
  let body='';req.on('data',b=>{body+=b;if(body.length>2048)req.destroy();});req.on('end',()=>{try{const e=JSON.parse(body);if(events.length<100)events.push({type:String(e.type).slice(0,40),message:String(e.message||'').slice(0,300)});}catch{}send(res,204,'text/plain','');});return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){requests.push({method:req.method,path:p,result:'blocked'});return send(res,403,'application/json',JSON.stringify({message:'Read-only isolated demo: all business writes disabled'}));}
 if(p==='/__preview/status')return send(res,200,'application/json',JSON.stringify({mode:'isolated-fictional-read-only',database:false,events,requests}));
 if(p==='/__preview/client.js')return send(res,200,'text/javascript',script);
 if(p.startsWith('/__api/')){
  requests.push({method:req.method,path:p,result:'fixture-only'});
  const api=p.slice('/__api'.length);let data=[];
  if(api==='/forum/topics')data=[topic];
  else if(api==='/forum/topic/900001')data=topic;
  else if(api==='/forum/posts/900001')data=[{id:900002,content:'DEMO — Fictional reply for visual preview. No real account or database is used.',created_at:topic.created_at,author}];
  else if(api==='/forum/reviews/config')data={enabled:false};
  else if(api.startsWith('/auth/')||api==='/forum/status')return send(res,401,'application/json',JSON.stringify({message:'Authentication disabled in isolated preview'}));
  return send(res,200,'application/json',JSON.stringify(data));
 }
 if(p==='/__preview/disabled'||/^\/(register|login|profile|dashboard|verify-email|forum\/(register|moderation|reviews\/new))([/]|$)/.test(p))return send(res,200,'text/html; charset=utf-8','<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DEMO — запись отключена</title><h1>Изолированный DEMO preview</h1><p>Регистрация, вход, публикации и финансовые операции отключены. Реальные данные не используются.</p><a href="/">На главную</a> · <a href="/forum">Форум</a></html>');
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(p));}catch{return send(res,400,'text/plain','Invalid path');}
 if(file!==root&&!file.startsWith(root+path.sep))return send(res,403,'text/plain','Forbidden');
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'index.html');
 const ext=path.extname(file),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2','.mp4':'video/mp4'};
 let bytes=fs.readFileSync(file);
 if(ext==='.html')bytes=Buffer.from(bytes.toString().replace('<head>','<head><script src="/__preview/client.js"></script>').replace('<body>','<body><aside style="padding:12px;background:#fff2b3;color:#292000;text-align:center;font:16px sans-serif">DEMO preview — вымышленные примеры. Регистрация и запись отключены.</aside>'));
 send(res,200,types[ext]||'application/octet-stream',bytes);
});
server.listen(port,'127.0.0.1',()=>console.log('SAFE_DEMO_PREVIEW http://127.0.0.1:'+port));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
