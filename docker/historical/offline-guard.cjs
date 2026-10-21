'use strict';
const cp=require('node:child_process');const net=require('node:net');
function blocked(){throw new Error('HISTORICAL_OFFLINE_PROCESS_OR_NETWORK_FORBIDDEN');}
for(const k of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[k]=blocked;
cp.ChildProcess.prototype.spawn=blocked;net.connect=blocked;net.createConnection=blocked;net.Socket.prototype.connect=blocked;
net.Server.prototype.listen=blocked;global.fetch=blocked;require('node:module').syncBuiltinESMExports();
