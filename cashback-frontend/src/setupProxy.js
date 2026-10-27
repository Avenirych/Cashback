// Development only: fixed local historical backend, no production proxy.
const {createProxyMiddleware} = require('http-proxy-middleware');
module.exports = function setupDevelopmentProxy(app) {
 const proxy=createProxyMiddleware({target:'http://127.0.0.1:3006',changeOrigin:true,pathRewrite:{'^/api':''},proxyTimeout:15000,timeout:15000,logLevel:'silent'});
 app.use('/api',(req,res,next)=>{
  const host=req.headers.host||'',origin=req.headers.origin;
  const deny=()=>{res.statusCode=403;res.end('Request is unavailable in this development mode');};
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||(origin&&origin!=='http://'+host)){deny();return;}
  let u,path;
  try{u=new URL(req.originalUrl||req.url,'http://localhost');path=decodeURIComponent(u.pathname).replace(/\/+/g,'/').toLowerCase();}catch{deny();return;}
  if(/^\/api\/(?:api\/)?(?:bonus|balance|withdrawal|transactions|cashback)(?:\/|$)/.test(path)){
   const enabled=process.env.REACT_APP_BONUS_READ_ONLY==='true'&&process.env.REACT_APP_REGISTRATION_ISOLATED==='true'&&process.env.REACT_APP_DEMO_ONLY==='true'&&process.env.REACT_APP_API_BASE==='/api';
   const allowed=enabled&&['127.0.0.1:3005','localhost:3005'].includes(host)&&req.method==='GET'&&u.pathname==='/api/api/bonus/snapshot'&&!u.search&&!req.headers['transfer-encoding']&&(!req.headers['content-length']||req.headers['content-length']==='0');
   if(!allowed){deny();return;}
   delete req.headers.cookie;
   res.setHeader('Cache-Control','no-store');
  }
  proxy(req,res,next);
 });
};
