'use strict';
// Local frontend-only activation. No SQL, migrations, backend restart or public ports.
const fs=require('node:fs'),cp=require('node:child_process'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dir='D:/Cashback+ archive/reports/content-review-20261023';
const docker=process.env.LOCALAPPDATA+'/Programs/DockerDesktop/resources/bin/docker.exe';
const d=args=>cp.execFileSync(docker,['--context','desktop-linux',...args],{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024}).trim();
const inspect=id=>JSON.parse(d(['inspect',id]))[0];
const stable=x=>({id:x.Id,image:x.Image,name:x.Name,started:x.State.StartedAt,running:x.State.Running,mounts:x.Mounts,networks:Object.keys(x.NetworkSettings.Networks).sort()});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const inventory=()=>d(['ps','-aq','--no-trunc']).split(/\r?\n/).map(id=>stable(inspect(id)));
const volumeInfo=()=>JSON.parse(d(['volume','inspect',...d(['volume','ls','-q']).split(/\r?\n/)])).map(v=>hash(JSON.stringify(v))).sort();
async function read(url){let last;for(let i=0;i<3;i++){try{const r=await fetch(url,{headers:{Connection:'close'},signal:AbortSignal.timeout(15000)});if(r.status!==200)throw Error('Unexpected HTTP '+r.status+' for '+url);return await r.text();}catch(e){last=e;await new Promise(r=>setTimeout(r,300));}}throw last;}
async function wait(url,status){for(let i=0;i<40;i++){try{if((await fetch(url,{headers:{Connection:'close'},signal:AbortSignal.timeout(15000)})).status===status)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error('HTTP verification failed: '+url);}
function create(name,data){return new Promise((resolve,reject)=>{const body=JSON.stringify(data);const req=http.request({socketPath:'//./pipe/dockerDesktopLinuxEngine',path:'/v1.47/containers/create?name='+encodeURIComponent(name),method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>res.statusCode===201?resolve(JSON.parse(text).Id):reject(Error('Frontend create failed: '+res.statusCode)));});req.on('error',reject);req.end(body);});}
async function main(){
 assert(process.argv.includes('--apply'));
 const test=JSON.parse(fs.readFileSync(dir+'/frontend-validation.json'));assert(test.success,'Frontend tests must pass first');
 const name='cashback-historical-03573b7-local-frontend-1',old=inspect(name),backend=stable(inspect('cashback-historical-03573b7-local-backend-1'));
 assert.equal(old.Id,'9c31dacd6df714b2ea3e67d3aa1d2e307d282e0ef428e97a18fa3254141e0a50');
 assert(old.State.Running);assert.equal(old.Mounts.length,0);assert.equal(old.HostConfig.Privileged,false);
 assert.deepEqual(old.HostConfig.PortBindings,{'3000/tcp':[{HostIp:'127.0.0.1',HostPort:'3004'}]});
 assert(old.HostConfig.CapDrop.includes('ALL'));assert(old.HostConfig.SecurityOpt.some(x=>x.startsWith('no-new-privileges')));
 assert.equal(inspect('cashback-historical-03573b7-local-historical-postgres-1').State.Health.Status,'healthy');
 const all=inventory(),volumes=volumeInfo(),policies=await read('http://127.0.0.1:3006/activity/policies');
 const tag='cashback-historical-demo-frontend:content-20261024';
 assert.equal(inspect('cashback-historical-demo-frontend:activity-20261023').Id,old.Image);
 if(!process.argv.includes('--reuse'))fs.writeFileSync(dir+'/frontend/Dockerfile','FROM cashback-historical-demo-frontend:activity-20261023\nCOPY build /app/build\n');
 const buildLog=process.argv.includes('--reuse')?'Reused already built verified content image.':cp.execFileSync(docker,['--context','desktop-linux','build','-t',tag,'-f',dir+'/frontend/Dockerfile',dir+'/frontend'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024});
 fs.writeFileSync(dir+'/docker-frontend-build.log',buildLog);
 const image=inspect(tag).Id,labels={...old.Config.Labels,'com.cashback.content-release':'content-20261024','com.docker.compose.image':image};
 const endpoints=Object.fromEntries(Object.entries(old.NetworkSettings.Networks).map(([key,n])=>[key,{Aliases:(n.Aliases||[]).filter(a=>a!==old.Id.slice(0,12))}]));
 const id=process.argv.includes('--reuse')?JSON.parse(fs.readFileSync(dir+'/local-release.json')).replacement:await create(name+'-content-candidate',{Image:image,Env:old.Config.Env,Cmd:old.Config.Cmd,Entrypoint:old.Config.Entrypoint,User:old.Config.User,WorkingDir:old.Config.WorkingDir,Labels:labels,ExposedPorts:old.Config.ExposedPorts,HostConfig:old.HostConfig,NetworkingConfig:{EndpointsConfig:endpoints}});
 const result={old:old.Id,replacement:id,image,oldImage:old.Image,backend,volumesPreserved:false,status:'created'};
 fs.writeFileSync(dir+'/local-release.json',JSON.stringify(result,null,2));
 try{
  d(['stop','--time','20',old.Id]);d(['rename',old.Id,name+'-rollback-content-20261024']);d(['rename',id,name]);d(['start',id]);
  for(const route of ['/','/about','/services','/faq','/privacy','/cookies','/terms','/contacts','/forum','/activity-limits'])await wait('http://127.0.0.1:3004'+route,200);
  await wait('http://127.0.0.1:3006/auth/profile',401);await wait('http://127.0.0.1:3006/activity/me',401);await wait('http://127.0.0.1:3006/finance',404);
  assert.deepEqual(stable(inspect(backend.id)),backend);assert.deepEqual(volumeInfo(),volumes);
  for(const x of all.filter(x=>x.id!==old.Id&&x.id!==id))assert.deepEqual(stable(inspect(x.id)),x);
  assert.equal(await read('http://127.0.0.1:3006/activity/policies'),policies);
  const html=await read('http://127.0.0.1:3004/'),bundle=html.match(/src="([^\"]+main\.[^\"]+\.js)"/)[1];
  assert.equal(hash(Buffer.from(await read('http://127.0.0.1:3004'+bundle))),hash(fs.readFileSync(dir+'/frontend/build'+bundle)));
  result.status='LOCAL_CONTENT_ACTIVE';result.bundle=bundle;result.volumesPreserved=true;result.unrelatedContainersPreserved=true;result.policiesUnchanged=true;
  fs.writeFileSync(dir+'/local-release.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }catch(error){
  try{if(inspect(id).State.Running)d(['stop','--time','10',id]);d(['rename',id,name+'-content-failed']);d(['rename',old.Id,name]);d(['start',old.Id]);await wait('http://localhost:3004/',200);result.status='RESTORED_PREVIOUS_FRONTEND';fs.writeFileSync(dir+'/local-release.json',JSON.stringify(result,null,2));}catch{throw Error('Frontend switch failed; recovery needs inspection');}
  throw error;
 }
}
main().catch(e=>{console.error(String(e.message).slice(0,250)+(e.cause?.code?' ['+e.cause.code+']':''));process.exitCode=1;});
