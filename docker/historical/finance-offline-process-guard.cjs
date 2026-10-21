'use strict';
// Loaded before test modules: imported production helpers cannot spawn diagnostics.
const cp=require('node:child_process');
function blocked(){const error=new Error('OFFLINE_CHILD_PROCESS_FORBIDDEN');error.code='OFFLINE_CHILD_PROCESS_FORBIDDEN';throw error;}
for(const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[name]=blocked;
// Also refuse direct ChildProcess construction, including saved wrappers.
cp.ChildProcess.prototype.spawn=blocked;
require('node:module').syncBuiltinESMExports();
// This suite is mock-only: also refuse accidental real database/HTTP connections.
const net=require('node:net');
net.Socket.prototype.connect=function(){throw new Error('OFFLINE_NETWORK_FORBIDDEN');};
globalThis.fetch=async function(){throw new Error('OFFLINE_NETWORK_FORBIDDEN');};
