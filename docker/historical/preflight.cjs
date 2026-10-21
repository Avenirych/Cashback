'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const PREFIX='cashback-historical-03573b7-local';
function verifyInventory(expected,current){const eq=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());if(expected.context!==current.context||expected.daemon!==current.daemon||!['containers','networks','volumes'].every(k=>eq(expected[k],current[k])))throw Error('PROTECTED_INVENTORY_CHANGED');}
function verifyPorts(text){for(const line of text.split(/\r?\n/)){const p=line.trim().split(/\s+/);if(p[0]==='TCP'&&/:(3004|3006|8036)$/.test(p[1]))throw Error('HISTORICAL_HOST_PORT_OCCUPIED');}}
function main(executable){
 if(!path.isAbsolute(executable)||!fs.statSync(executable).isFile())throw Error('DOCKER_CLI_REQUIRED');
 const call=args=>cp.execFileSync(executable,args,{shell:false,timeout:10000,maxBuffer:2000000,stdio:['ignore','pipe','pipe']}).toString().trim();
 const docker=args=>call(['--context','desktop-linux',...args]);const lines=s=>s.split(/\r?\n/).filter(Boolean);
 const expected=JSON.parse(fs.readFileSync(path.join(__dirname,'protected-inventory.json'),'utf8').replace(/^\uFEFF/,''));
 const inventory=()=>({context:call(['context','show']),daemon:docker(['info','--format','{{.ID}}']),containers:lines(docker(['ps','-aq','--no-trunc'])),networks:lines(docker(['network','ls','-q','--no-trunc'])),volumes:lines(docker(['volume','ls','-q']))});
 verifyInventory(expected,inventory());
 for(const args of [['ps','-a','--format','{{.Names}}'],['network','ls','--format','{{.Name}}'],['volume','ls','--format','{{.Name}}']])if(lines(docker(args)).some(n=>n.startsWith(PREFIX)))throw Error('HISTORICAL_RESOURCES_ALREADY_EXIST');
 if(process.platform!=='win32')throw Error('WINDOWS_PORT_INSPECTION_REQUIRED');
 verifyPorts(cp.execFileSync(path.join(process.env.SystemRoot,'System32','netstat.exe'),['-ano','-p','tcp'],{shell:false,timeout:10000}).toString());
 for(const image of ['node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20','postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df','axllent/mailpit:v1.31.5@sha256:94f6b70c1436defae6799d9ac7ff0eeff9540465b842026d5cdb018f1c0234ea']){
  const identity=JSON.parse(docker(['image','inspect',image,'--format','{{json .}}']));
  if(identity.Os!=='linux'||identity.Architecture!=='amd64'||!/^sha256:[a-f0-9]{64}$/.test(identity.Id))throw Error('HISTORICAL_PINNED_IMAGE_MISMATCH');
 }
 verifyInventory(expected,inventory());console.log('HISTORICAL_READ_ONLY_PREFLIGHT_PASS');
}
module.exports={verifyInventory,verifyPorts};
if(require.main===module)try{main(process.argv[2]);}catch(e){console.error(e.code||(/^[A-Z_]+$/.test(e.message)?e.message:'HISTORICAL_PREFLIGHT_BLOCKED'));process.exitCode=1;}
