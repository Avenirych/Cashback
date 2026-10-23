'use strict';
// Production static frontend using the existing image's Express dependency.
const express=require('express'),path=require('node:path');
const app=express(),root=path.resolve(process.env.FRONTEND_BUILD_ROOT||'/app/build');
app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-cache');next();});
app.use(express.static(root,{dotfiles:'deny',index:'index.html',fallthrough:true}));
app.use((req,res)=>{
 if(['GET','HEAD'].includes(req.method)&&req.accepts('html')&&!path.extname(req.path))return res.sendFile(path.join(root,'index.html'));
 res.status(404).end();
});
const server=app.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log('Cashback static frontend ready'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
