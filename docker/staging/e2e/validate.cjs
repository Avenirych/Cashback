'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict'),path=require('path');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function validate(c,dir=__dirname){
const b=c.services.browser;a(Object.keys(c.services).length===1,'one temporary service only');
a(c.name==='cashback-browser-e2e');a(b.image==='sha256:a707919d613b7e7ed9a8714b51fe782704436b468144966c747318271dcf9203');
a(b.user==='1000:1000'&&b.read_only===true&&b.init===true);a(JSON.stringify(b.cap_drop)==='["ALL"]');
a(JSON.stringify(b.security_opt)===JSON.stringify(['no-new-privileges:true','seccomp=./staging/e2e/seccomp-chromium.json']));
a(!b.privileged&&!b.ports&&!b.devices&&!b.pid&&!b.ipc&&!b.network_mode&&!b.cap_add&&!b.build);
a(b.mem_limit==='768m'&&b.memswap_limit==='768m'&&b.cpus===0.5&&b.pids_limit===192&&b.shm_size==='128m');
a(b.restart==='no'&&b.pull_policy==='never');a(JSON.stringify(b.networks)==='["application"]');
a(c.networks.application.external===true&&c.networks.application.name==='cashback-staging-b02_application');
a(JSON.stringify(b.volumes)===JSON.stringify(['./staging/e2e:/tests:ro','${E2E_CLIENT_DIR:?tmpfs client directory required}:/tls:ro','${E2E_OUTPUT_DIR:?bounded output directory required}:/out']));
a(JSON.stringify(b.tmpfs)==='["/tmp:rw,nosuid,nodev,size=256m,mode=1777"]');
a(b.environment.HOME==='/tmp/home'&&b.environment.NODE_EXTRA_CA_CERTS==='/tls/ca.pem'&&Object.keys(b.environment).length===2);
a(JSON.stringify(b.entrypoint)===JSON.stringify(['sh','/tests/entrypoint.sh']));
for(const f of ['browser.cjs','functional-browser.cjs']){const source=fs.readFileSync(path.join(dir,f),'utf8');a(source.includes('chromiumSandbox:true')&&(source.includes('channel:"chromium"')||source.includes("channel:'chromium'")));a(!/ignoreHTTPSErrors|--no-sandbox|--insecure/.test(source));}
const raw=fs.readFileSync(path.join(dir,'seccomp-chromium.json'));a(hash(raw)==='d498998cef5b6ca744ed8118403241a4057b5316e9113cec9cb36969d4468a95');
const base=JSON.parse(fs.readFileSync(path.join(dir,'seccomp-baseline.json'))),p=JSON.parse(raw);
a(p.defaultAction===base.defaultAction);assert.deepEqual(p.syscalls.slice(0,base.syscalls.length),base.syscalls);
const extra=p.syscalls.slice(base.syscalls.length);assert.deepEqual(extra,[
{names:['unshare'],action:'SCMP_ACT_ALLOW',args:[{index:0,value:268435456,op:'SCMP_CMP_EQ'}]},
{names:['clone'],action:'SCMP_ACT_ALLOW',args:[{index:0,value:268435473,op:'SCMP_CMP_EQ'}]},
{names:['clone'],action:'SCMP_ACT_ALLOW',args:[{index:0,value:1879048209,op:'SCMP_CMP_EQ'}]},
{names:['chroot'],action:'SCMP_ACT_ALLOW'},
{names:['clone'],action:'SCMP_ACT_ALLOW',args:[{index:0,value:536870929,op:'SCMP_CMP_EQ'}]}]);
return true;
}
function a(v,m='E2E admission refused'){assert.ok(v,m)}
module.exports={validate};
if(require.main===module){const y=require('js-yaml');validate(y.load(fs.readFileSync(path.join(__dirname,'../../compose.staging.e2e.yaml'),'utf8')));console.log('E2E_STATIC_ADMISSION_PASS')}
