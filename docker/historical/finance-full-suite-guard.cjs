'use strict';
// Full source suite: no child processes, DB, internet or active-service access.
// HTTP tests may connect ONLY to an ephemeral loopback server this process owns.
const net=require('node:net'),connect=net.Socket.prototype.connect,listen=net.Server.prototype.listen;
require('./finance-offline-process-guard.cjs');
const ports=new Set();
net.Server.prototype.listen=function(...args){
 const raw=args[0],port=typeof raw==='object'?raw.port:raw;
 if(port!==0)throw Error('TEST_EPHEMERAL_LISTENER_REQUIRED');
 const callback=args.find(v=>typeof v==='function');
 this.once('listening',()=>{const address=this.address();if(address&&typeof address==='object')ports.add(address.port);});
 this.once('close',()=>{for(const port of [...ports])if(port===this.__testPort)ports.delete(port);});
 this.once('listening',()=>{this.__testPort=this.address().port;});
 return listen.call(this,{port:0,host:'127.0.0.1'},callback);
};
net.Socket.prototype.connect=function(...args){
 const raw=args[0],options=Array.isArray(raw)?raw[0]:raw;
 const port=typeof options==='object'?options.port:options;
 const host=typeof options==='object'?options.host:args[1];
 if(!ports.has(Number(port))||!['127.0.0.1','localhost','::ffff:127.0.0.1'].includes(host))throw Error('TEST_OWNED_LOOPBACK_ONLY');
 return connect.apply(this,args);
};
