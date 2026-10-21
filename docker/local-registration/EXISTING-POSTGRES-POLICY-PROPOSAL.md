# Existing PostgreSQL baseline policy proposal

Proposal: `existing-postgres-baseline.policy.proposal.json`. It is deliberately an
unapproved envelope, not an AdmissionPolicy accepted by the CLI. No policy was
opened or modified. No Docker observation was obtained from restricted Codex.

| Required field | Evidence now | Independent review |
| --- | --- | --- |
| containerId | User-confirmed full ID in proposal | Refresh exact identity and approve |
| networkId | Missing; network name is known, not its ID | Full network ID |
| templateSha256 | Locally computed canonical JSON hash matches TEMPLATE_SHA256 | Full source template and this exact hash |
| effectiveComposeSha256 | Missing | Full normalized no-interpolation render |
| postgresSha256 | Missing | Exact registrationPeerFingerprint, including Config, HostConfig, Mounts and NIC names |
| networkSha256 | Missing | Exact registrationNetworkFingerprint: ID/name/driver/internal/IPAM/options/labels |
| volumeSha256 | Missing | Exact configDigest of full volume inspect object |

All hashes are lowercase hex without `sha256:`. Do not substitute Get-FileHash
(raw file bytes), image ID or a normal interpolated render for these definitions.
The container fingerprint includes environment values in memory; only its hash is
printed. No env file is read. A hash proves equality, not independent approval.

## Local read-only observation block

Run in ordinary local VS Code PowerShell. This block has NOT been run against
Docker by Codex. It writes no files, invokes no baseline/admission, and reads no
approved policy, registration.env, SQL, keys or credentials. Docker itself uses
its existing local context configuration. Never redirect raw inspect/config into
chat or a repository file. Output contains only sanitized metadata, fingerprints
and an explicitly unapproved candidate. On any failure, STOP; do not auto-repair.

```powershell
Set-Location -LiteralPath 'C:\Users\serge\cashback+'
$dockerCli = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
if (-not (Test-Path -LiteralPath $dockerCli -PathType Leaf)) { throw 'STOP: Docker CLI unavailable' }
@'
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const {COMPOSE_FILE,TEMPLATE_SHA256,configDigest:hash}=require('./docker/local-registration/admission');
const {normalizeCompose}=require('./docker/local-registration/collector');
const {REGISTRATION_PHONE_EXPECTED:E,registrationPeerFingerprint:cf,registrationNetworkFingerprint:nf}=require('./src/docker-phone-registration-target');
const executable=process.argv[2];
const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].flatMap(k=>process.env[k]===undefined?[]:[[k,process.env[k]]]));
env.COMPOSE_DISABLE_ENV_FILE='1';
const assert=(condition)=>{if(!condition)throw Error('STOP');};
const call=(args)=>execFileSync(executable,args,{cwd:process.cwd(),env,shell:false,windowsHide:true,timeout:10000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).toString();
const d=(args)=>call(['--context',E.context,...args]);
const inspect=(kind,id)=>{const a=JSON.parse(d([kind,'inspect',id]));assert(Array.isArray(a)&&a.length===1);return a[0];};
const checkDaemon=()=>{
  assert(call(['context','show']).trim()===E.context);
  const i=JSON.parse(d(['info','--format','{"id":{{json .ID}},"os":{{json .OSType}},"arch":{{json .Architecture}}}']));
  assert(i.id===E.daemonId&&i.os==='linux'&&['amd64','x86_64'].includes(i.arch));
};
const inventory=()=>{
  const label='"project":{{json (.Label "com.docker.compose.project")}}';
  const list=(args)=>d(args).split(/\r?\n/).filter(Boolean).map(JSON.parse).sort((a,b)=>a.name.localeCompare(b.name));
  const containers=list(['ps','--all','--no-trunc','--format',`{"id":{{json .ID}},"name":{{json .Names}},${label}}`]);
  const networks=list(['network','ls','--no-trunc','--format',`{"id":{{json .ID}},"name":{{json .Name}},${label}}`]);
  const volumes=list(['volume','ls','--format',`{"name":{{json .Name}},${label}}`]);
  for(const group of [containers,networks,volumes])assert(new Set(group.map(v=>v.name)).size===group.length&&group.every(v=>typeof v.name==='string'&&typeof v.project==='string'));
  assert([...containers,...networks].every(v=>/^[a-f0-9]{64}$/.test(v.id)));
  for(const [group,name] of [[containers,E.container],[networks,E.network],[volumes,E.volume]]){
    const scoped=group.filter(v=>v.project===E.project||v.name.startsWith(E.project));
    assert(scoped.length===1&&scoped[0].name===name&&scoped[0].project===E.project);
  }
  assert(containers.find(v=>v.name===E.container).id===E.containerId);
  return {containers,networks,volumes};
};
try {
  const began=Date.now();checkDaemon();const before=inventory();
  const template=JSON.parse(fs.readFileSync(COMPOSE_FILE,'utf8'));assert(hash(template)===TEMPLATE_SHA256);
  const render=()=>normalizeCompose(JSON.parse(d(['compose','--env-file','NUL','--project-name',E.project,'--file',COMPOSE_FILE,'--profile','*','config','--format','json','--no-interpolate','--no-normalize','--no-path-resolution'])));
  const effective=render();
  const c=inspect('container',E.containerId),image=inspect('image',E.image),v=inspect('volume',E.volume),n=inspect('network',E.network);
  assert(c.Id===E.containerId&&c.Name==='/'+E.container&&c.Config.Image===E.image);
  assert(c.Config.Labels['com.docker.compose.project']===E.project&&c.Config.Labels['com.docker.compose.service']==='postgres-test');
  assert(c.State.Status==='running'&&c.State.Health.Status==='healthy');
  assert(image.Id===c.Image&&/^sha256:[a-f0-9]{64}$/.test(image.Id)&&image.Descriptor.digest===E.image.split('@')[1]);
  assert(image.Os==='linux'&&image.Architecture==='amd64');
  if(image.Descriptor.platform)assert(image.Descriptor.platform.os==='linux'&&image.Descriptor.platform.architecture==='amd64');
  assert(c.HostConfig.PublishAllPorts===false&&Object.keys(c.HostConfig.PortBindings||{}).length===0);
  assert(Object.values(c.NetworkSettings.Ports||{}).every(x=>x===null||(Array.isArray(x)&&x.length===0)));
  assert(c.Mounts.length===1&&c.Mounts[0].Type==='volume'&&c.Mounts[0].Name===E.volume&&c.Mounts[0].Destination==='/var/lib/postgresql/data');
  assert(v.Name===E.volume&&v.Driver==='local'&&Object.keys(v.Options||{}).length===0&&c.Mounts[0].Source===v.Mountpoint&&v.Labels['com.docker.compose.project']===E.project);
  assert(/^[a-f0-9]{64}$/.test(n.Id)&&n.Name===E.network&&n.Driver==='bridge'&&n.Internal===true&&n.Labels['com.docker.compose.project']===E.project);
  assert(before.networks.find(x=>x.name===E.network).id===n.Id);
  assert(Object.keys(c.NetworkSettings.Networks).join(',')===E.network&&c.NetworkSettings.Networks[E.network].NetworkID===n.Id);
  assert(Object.keys(n.Containers||{}).join(',')===E.containerId&&c.NetworkSettings.Networks[E.network].IPAddress);
  assert(n.Containers[E.containerId].IPv4Address.split('/')[0]===c.NetworkSettings.Networks[E.network].IPAddress);
  const checks=[['container',E.containerId,c],['image',E.image,image],['volume',E.volume,v],['network',n.Id,n]];
  const stable=(kind,x)=>kind==='container'?{config:cf(x),state:x.State.Status,health:x.State.Health.Status,networks:x.NetworkSettings.Networks,ports:x.NetworkSettings.Ports}:x;
  for(const [kind,id,x] of checks)assert(hash(stable(kind,x))===hash(stable(kind,inspect(kind,id))));
  assert(hash(before)===hash(inventory())&&hash(template)===hash(JSON.parse(fs.readFileSync(COMPOSE_FILE,'utf8')))&&hash(effective)===hash(render()));
  checkDaemon();assert(Date.now()-began<=30000);
  console.log(JSON.stringify({status:'OBSERVED_NOT_APPROVED',observedAt:new Date().toISOString(),
    counts:Object.fromEntries(Object.entries(before).map(([k,a])=>[k,a.length])),
    checks:{identity:true,labels:true,mounts:true,singlePostgresPeer:true,noPublishedPorts:true,effectiveComposeStable:true},
    existingPostgresBaseline:{containerId:E.containerId,networkId:n.Id,templateSha256:hash(template),effectiveComposeSha256:hash(effective),postgresSha256:cf(c),networkSha256:nf(n),volumeSha256:hash(v)},
    SERVICE_ADMITTED:false,APPLY_ELIGIBLE:false,creation:'CREATION_AUTHORITY_NOT_PROVISIONED'},null,2));
} catch {
  console.log(JSON.stringify({status:'BLOCKED',reason:'OBSERVATION_FAILED_OR_PRECONDITION_MISMATCH',action:'STOP_NO_APPROVAL_NO_RETRY_NO_MUTATION'}));process.exitCode=1;
}
'@ | node --use-system-ca -r ts-node/register - "$dockerCli"
if ($LASTEXITCODE -ne 0) { throw 'STOP: local observation failed' }
```

This is proposal evidence, NOT baseline verification. It does not inspect protected
projects' detailed configuration and cannot attest their historical immutability;
it only lists them and confirms inventory stability. The existing baseline CLI
performs its own protected-resource fingerprint comparison after policy approval.
Inventory totals are observations, not an allowlist permitting extra project
resources. The reported 9/4/9 counts must be reconciled if different; never force
the observed totals to match historical values.

## Approval boundary and STOP

An independent owner must review the **actual configuration**, not just approve a
hash because this command printed it. Review image provenance/platform, container
security options/capabilities, labels, exact mount and volume configuration,
network isolation/IPAM/options/peers and the full repository Compose template.
Do not print container Config.Env while reviewing. The full Compose render here
contains placeholders by design, not evidence that runtime credentials are valid.
Use existing protected review channels for sensitive configurations; no new
authority, signer or receipt is created by this package.

All seven baseline assertions and unchanged four top-level owner fields require
independent approval as one exact, scoped policy. Updating the actual protected
owner policy requires separate explicit permission and the existing approval
process. Do not automatically merge the observed output or this envelope into it.
This task neither performs nor authorizes that update. Baseline CLI must not run
automatically after this block. Later read-only baseline execution is separate;
no SQL cluster-identifier claim, service creation authority or migration eligibility
is granted by either observation or baseline verification.
