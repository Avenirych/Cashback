'use strict';
// Future separately approved provisioning only. No execution on import; never called by validation.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
async function generate(args) {
  if(process.platform!=='win32'||args.length!==3||args[0]!=='generate-after-separate-approval'||
    !['fingerprints','receipts','enrollment'].includes(args[1])||!/^[a-zA-Z0-9_-]{1,64}$/.test(args[2]))throw Error('BLOCKED');
  const directory=path.join('C:\\approved-registration-infrastructure',args[1]);
  // Owner/ACL/external-host review must precede this explicit command. Never initialise storage here.
  const stat=await fs.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('BLOCKED');
  const stem=path.join(directory,args[2]);
  const publicDirectory=path.join('C:\\approved-registration-infrastructure','public');
  const publicStat=await fs.lstat(publicDirectory);if(!publicStat.isDirectory()||publicStat.isSymbolicLink())throw Error('BLOCKED');
  const publicPath=path.join(publicDirectory,args[1]+'.'+args[2]+'.pem');
  for(const file of [stem+'.private.pem',publicPath]){
    try{await fs.lstat(file);throw Error('EXISTS');}catch(e){if(e.code!=='ENOENT')throw Error('BLOCKED');}
  }
  const pair=crypto.generateKeyPairSync('ed25519');
  const privateFile=await fs.open(stem+'.private.pem','wx',0o600);
  try{await privateFile.writeFile(pair.privateKey.export({type:'pkcs8',format:'pem'}));await privateFile.sync();}finally{await privateFile.close();}
  // Partial failure leaves material in place and STOPs. No automatic deletion, reuse or overwrite.
  const publicFile=await fs.open(publicPath,'wx',0o600);
  try{await publicFile.writeFile(pair.publicKey.export({type:'spki',format:'pem'}));await publicFile.sync();}finally{await publicFile.close();}
  process.stdout.write('Key files created outside Git. Public pin requires independent review; nothing activated.\n');
}
if(require.main===module)generate(process.argv.slice(2)).catch(()=>{process.stderr.write('REGISTRATION_KEY_PROVISIONING:STOP\n');process.exitCode=1;});
module.exports={generate};
