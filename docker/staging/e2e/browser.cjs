const fs=require('fs'),crypto=require('crypto'),{chromium}=require('/e2e/node_modules/playwright');
const origin='https://cashback-staging.test:8443',state='/tmp/browser-state.json';
let failures=0,active;
function emit(s,status,detail){console.log(JSON.stringify({scenario:s,status,detail}));if(status==='FAIL')failures++}
async function step(name,fn){try{const detail=await fn();emit(name,'PASS',detail)}catch(e){emit(name,'FAIL',{error:e.name||'Error',reason:e.safeReason||'DOM/assertion failed (sensitive arguments suppressed)'})}}
function assert(v,reason){if(!v){const e=Error();e.safeReason=reason;throw e}}
(async()=>{
 const phase=process.argv[2];let st=fs.existsSync(state)?JSON.parse(fs.readFileSync(state)):{};
 if(phase==='email'){process.stdout.write(st.email||'');return;}
 const b=active=await chromium.launch({headless:true,channel:"chromium",chromiumSandbox:true});
 const c=await b.newContext({viewport:{width:1280,height:900},clientCertificates:[{origin,certPath:'/tls/client.pem',keyPath:'/tls/client.key'}],...(st.storage&&phase!=='flows'?{storageState:st.storage}:{})});
 await c.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===origin?r.continue():r.abort('blockedbyclient')});
 const p=await c.newPage();p.setDefaultTimeout(20000);p.setDefaultNavigationTimeout(30000);
 const selectLang=()=>p.locator('select:has(option[value="fr"])').first();
 if(phase==='initial'){
 await step('homepage real DOM',async()=>{await p.goto(origin);await p.locator('main h1,h1').first().waitFor();assert((await p.locator('#root').innerText()).length>100,'React DOM not rendered');return {title:await p.title(),main:await p.locator('main').count()}});
 await selectLang().selectOption('en');
 const reject=p.getByRole('button',{name:'Reject optional',exact:true});if(await reject.count())await reject.click();
 await p.goto(origin+'/forum/rules');
 for(const code of ['ru','en','de','fr'])await step('language '+code+' real switch and rules',async()=>{await selectLang().selectOption(code);await p.waitForFunction(x=>localStorage.getItem('lang')===x,code);const section=p.locator('.forum-rule-sections');await section.waitFor();assert(await section.getAttribute('lang')===code,'Rendered language mismatch');assert(await p.locator('details.forum-rule-panel').count()===20,'Expected20rule panels');const title=await p.locator('main h1').innerText();await p.locator('summary').first().click();assert(await p.locator('details[open]').count()===1,'Rule panel did not open');await p.screenshot({path:'/out/language-'+code+'.png'});return {title,panels:20}});
 await selectLang().selectOption('en');await p.goto(origin+'/register');
 await step('registration form consent defaults',async()=>{assert(await p.locator('form.register-form').count()===1,'Registration form absent');for(const id of ['age-confirmed','terms','privacy-acknowledged','marketing-requested'])assert(!await p.locator('#'+id).isChecked(),'Consent default must be off');assert(await p.locator('form.register-form button[type="submit"]').isDisabled(),'Empty form must not submit');return 'required/optional consent defaults verified'});
 st.email='browser-'+Date.now()+'@example.invalid';st.password='Browser!1'+crypto.randomBytes(20).toString('hex');fs.writeFileSync(state,JSON.stringify(st),{mode:0o600});
 await step('synthetic registration via UI',async()=>{await p.locator('#firstName').fill('Synthetic');await p.locator('#lastName').fill('Browser');await p.locator('#email').fill(st.email);await p.locator('#phone').fill('+44 20 7946 0958');await p.locator('#password').fill(st.password);for(const id of ['age-confirmed','terms','privacy-acknowledged'])await p.locator('#'+id).check();const submit=p.locator('form.register-form button[type="submit"]');assert(await submit.isEnabled(),'Valid synthetic form still disabled');const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/register'&&r.request().method()==='POST');await submit.click();const r=await response;assert(r.status()===201,'Registration API did not return201');await p.getByText(/We sent a verification link/i).waitFor();return {http:r.status(),confirmationMessageVisible:true}});
 }
 if(phase==='verify'){
 const mail=JSON.parse(fs.readFileSync(0,'utf8'));const link=((mail.Text||'')+' '+(mail.HTML||'')).match(/https:\/\/cashback-staging\.test:8443[^\s"<>]*[?&]token=([^\s"<>&]+)/);
 await step('email verification through real page',async()=>{assert(!!link,'Expected local Mailpit verification URL missing');await p.goto(origin+'/verify-email?token='+encodeURIComponent(decodeURIComponent(link[1])));await p.getByRole('heading',{name:'Email verified!'}).waitFor();assert(!p.url().includes('token='),'Verification token retained in URL');return 'success heading visible; token removed from URL'});
 }
 if(phase==='flows'){
 await p.goto(origin+'/login');await selectLang().selectOption('en');const reject=p.getByRole('button',{name:'Reject optional',exact:true});if(await reject.count())await reject.click();
 await step('login via form',async()=>{await p.locator('#email').fill(st.email);await p.locator('#password').fill(st.password);await p.locator('main form button[type="submit"]').click();await p.waitForURL(u=>!u.pathname.startsWith('/login'));assert(!!await p.evaluate(()=>localStorage.getItem('cashback_token')),'Session token missing');return {route:new URL(p.url()).pathname}});
 await step('logout via visible UI',async()=>{let out=p.getByRole('button',{name:'Logout',exact:true});if(!await out.isVisible()){const profile=p.getByRole('button',{name:/^Profile:/}).first();await profile.click();}await out.click();assert(!await p.evaluate(()=>localStorage.getItem('cashback_token')),'Logout retained session token');await p.goto(origin+'/profile');await p.waitForURL(/\/register/);return 'Session removed; protected route redirects to registration as ProtectedGuard specifies'});
 await p.goto(origin+'/login');await p.locator('#email').fill(st.email);await p.locator('#password').fill(st.password);await p.locator('main form button[type="submit"]').click();await p.waitForURL(u=>!u.pathname.startsWith('/login'));
 for(const [name,path] of [['forum registration UI','/forum/register'],['review publication UI','/forum/reviews/new']])await step(name,async()=>{await p.goto(origin+path);const text=await p.locator('main').innerText();await p.screenshot({path:'/out/'+name.replaceAll(' ','-')+'.png'});assert(!text.includes('currently closed')&&!text.includes('Demonstration mode'),'Frontend demo build closes this workflow');assert(await p.locator('main form').count()>0,'Workflow form absent');return 'form present (publication not yet submitted)'});
 await step('moderation real controls',async()=>{await p.goto(origin+'/forum/moderation');assert(await p.locator('button').filter({hasText:/publish|approve/i}).count()>0,'Route exposes moderation policy, not moderator decision controls');return 'moderation action controls present'});
 await step('financial writes unavailable in browser session',async()=>{const status=await p.evaluate(async()=>{const t=localStorage.getItem('cashback_token');return(await fetch('/api/api/bonus/transfer',{method:'POST',headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:'{}'})).status});assert(status===403,'Financial write not refused');return {http:status,realOperation:false}});
 }
 st.storage=await c.storageState();fs.writeFileSync(state,JSON.stringify(st),{mode:0o600});await b.close();if(failures)process.exitCode=1;
})().catch(e=>{console.log(JSON.stringify({scenario:'browser runner',status:'FAIL',detail:e.safeReason||e.name||'Error'}));process.exitCode=1}).finally(async()=>{if(active&&active.isConnected())await active.close()});
process.on('SIGTERM',async()=>{if(active)await active.close();process.exit(124)});
