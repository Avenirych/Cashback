'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {selectedPort, checkPort, identify, openBrowser, main, URL, IDENTITY} = require('./start-frontend.cjs');
// Every socket, process, browser and readiness operation is mocked.
function harness() {
  const probes=[], spawns=[], opened=[], errors=[], exits=[], child=new EventEmitter();
  child.kill=()=>assert.fail('Must never kill a process');
  const options={env:{}, probe:async (...a)=>{probes.push(a);}, exists:()=>true,
    spawnProcess:(...a)=>{spawns.push(a);return child;}, identifyFrontend:async()=>true,
    open:async url=>{opened.push(url);}, pause:async()=>{}, log:()=>{}, report:e=>errors.push(e), setExitCode:e=>exits.push(e), attempts:3};
  return {options,probes,spawns,opened,errors,exits,child};
}
test('canonical npm start remains Nest and does not activate the dormant 3003/3005 demo launcher',()=>{
  assert.equal(require('../package.json').scripts.start,'nest start');
  assert.equal(require('../cashback-frontend/package.json').scripts.start,'react-scripts start');
});
test('default and explicit port are only 3003',()=>{
  assert.equal(selectedPort({}),3003);assert.equal(selectedPort({PORT:'3003'}),3003);
  for(const PORT of ['3000','3002','3004','','03003'])assert.throws(()=>selectedPort({PORT}),/only PORT=3003/);
});
test('starts attached frontend with exact demo settings and disables CRA browser',async()=>{
  const h=harness();await main(h.options);
  assert.deepEqual(h.probes,[['127.0.0.1',3003],['::1',3003]]);assert.equal(h.spawns.length,1);
  const [exe,args,o]=h.spawns[0];assert.equal(exe,process.execPath);assert.equal(args[1],'start');assert.equal(o.stdio,'inherit');
  for(const [k,v] of Object.entries({PORT:'3003',HOST:'localhost',CI:'true',BROWSER:'none',REACT_APP_REGISTRATION_ISOLATED:'true',REACT_APP_API_BASE:'http://127.0.0.1:3005'}))assert.equal(o.env[k],v);
  assert.deepEqual(h.opened,[URL]);
});
for(const host of ['127.0.0.1','::1'])test(`existing Cashback on ${host} reused without dependency check`,async()=>{
  const h=harness();h.options.exists=()=>false;
  h.options.probe=async a=>{if(a===host)throw Object.assign(new Error('busy'),{code:'EADDRINUSE'});};
  assert.equal(await main(h.options),null);assert.equal(h.spawns.length,0);assert.deepEqual(h.opened,[URL]);
});
test('unknown service fails without opening or spawning',async()=>{
  const h=harness();h.options.probe=async()=>{throw Object.assign(new Error(),{code:'EADDRINUSE'});};h.options.identifyFrontend=async()=>false;
  await assert.rejects(main(h.options),/unidentified or incompatible/);assert.equal(h.spawns.length,0);assert.equal(h.opened.length,0);
});
test('browser waits for successful readiness',async()=>{
  const h=harness();let checks=0;h.options.identifyFrontend=async()=>{assert.equal(h.opened.length,0);return ++checks===3;};
  await main(h.options);assert.equal(checks,3);assert.deepEqual(h.opened,[URL]);
});
test('readiness timeout preserves process, never opens or retries spawn',async()=>{
  const h=harness();h.options.identifyFrontend=async()=>false;await assert.rejects(main(h.options),/readiness timed out/);assert.equal(h.opened.length,0);assert.equal(h.spawns.length,1);
});
for(const event of ['error','exit'])test(`startup ${event} prevents opening and reports failure`,async()=>{
  const h=harness();h.options.identifyFrontend=async()=>{h.child.emit(event,event==='error'?new Error('failed'):7);return true;};
  await assert.rejects(main(h.options),/exited before becoming ready/);assert.equal(h.opened.length,0);assert.equal(h.spawns.length,1);assert.deepEqual(h.exits,[event==='error'?1:7]);
});
test('missing dependencies and probe errors stop before spawning',async()=>{
  const h=harness();h.options.exists=()=>false;await assert.rejects(main(h.options),/dependencies are missing/);
  h.options.probe=async()=>{throw Object.assign(new Error('denied'),{code:'EACCES'});};await assert.rejects(main(h.options),/denied/);assert.equal(h.spawns.length,0);
});
function response(r){return {status:200,body:r==='/cashback-demo.json'?JSON.stringify({application:IDENTITY}):r==='/'?'<div id="root"></div><script src="/static/js/bundle.js"></script>':'const BACKEND_URL = ("http://127.0.0.1:3005"; route="Smart shopping with Cashback+"'};}
test('identity requires project marker, React HTML and correct demo bundle',async()=>{
  assert.equal(await identify(async r=>response(r)),true);
  for(const bad of ['/cashback-demo.json','/','/static/js/bundle.js']){
    assert.equal(await identify(async r=>r===bad?{status:200,body:'Unknown application'}:response(r)),false);
    assert.equal(await identify(async r=>r===bad?{status:302,body:response(r).body}:response(r)),false);
  }
  assert.equal(await identify(async()=>{throw Error('timeout');}),false);
});
test('Windows browser uses default handler without shell',async()=>{
  let invocation;await openBrowser(URL,(...a)=>{invocation=a;const c=new EventEmitter();queueMicrotask(()=>c.emit('exit',0));return c;},'win32');
  assert.match(invocation[0],/rundll32.exe$/);assert.deepEqual(invocation[1],['url.dll,FileProtocolHandler',URL]);assert.equal(invocation[2].shell,false);
});
test('browser failure reports error, preserves frontend',async()=>{
  const h=harness();h.options.open=async()=>{throw Error('Could not open the browser');};await assert.rejects(main(h.options),/Could not open/);assert.equal(h.spawns.length,1);
});
test('probe closes its temporary listener',async()=>{
  const s=new EventEmitter();let closed=false;s.listen=(o,cb)=>{assert.deepEqual(o,{host:'127.0.0.1',port:3003,exclusive:true});cb();};s.close=cb=>{closed=true;cb();};
  await checkPort('127.0.0.1',3003,()=>s);assert.equal(closed,true);
});

test('startup opens home and readiness has an elapsed-time deadline',async()=>{assert.equal(URL,'http://localhost:3003/');const h=harness();let clock=0,checks=0;h.options.now=()=>clock;h.options.readinessTimeout=1000;h.options.identifyFrontend=async()=>{checks++;clock+=1100;return true;};await assert.rejects(main(h.options),/readiness timed out/);assert.equal(checks,1);assert.equal(h.opened.length,0);});
