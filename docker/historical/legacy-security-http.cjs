'use strict';
// Explicit socket test: isolated Nest module, mock repositories, loopback port 0.
// Never imports AppModule, opens a database or changes active services.
const assert=require('node:assert/strict'),fs=require('node:fs');
const cp=require('node:child_process');for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=()=>{throw Error('TEST_CHILD_PROCESS_FORBIDDEN');};
const {Test}=require('@nestjs/testing'),{JwtService,JwtModule}=require('@nestjs/jwt'),{PassportModule}=require('@nestjs/passport'),{getRepositoryToken}=require('@nestjs/typeorm');
const {UsersController}=require('../../dist/users/users.controller'),{UsersService}=require('../../dist/users/users.service'),{JwtStrategy}=require('../../dist/auth/jwt.strategy');
const {TopicsController}=require('../../dist/topics.controller'),{PostsController}=require('../../dist/posts.controller'),{PostsService}=require('../../dist/posts.service'),{Topic}=require('../../dist/topics.entity');
const secret='synthetic-loopback-security-test-only-'+ 'x'.repeat(48),oldSecret=process.env.JWT_SECRET;
process.env.JWT_SECRET=secret;
let app;
(async()=>{
 const calls=[];const user={id:7,name:'Test Buyer',email:'buyer@example.invalid',balance:0,email_verified:true,password:'NEVER_RETURN',email_token:'NEVER_RETURN',created_at:new Date()};
 let active=true,lookupFailed=false;
 const users={getById:async id=>{calls.push('read');if(lookupFailed)throw Error('PRIVATE_DATABASE_FAILURE');return id===7&&active?user:id===8?{...user,id:8}:null;},update:async(id,body)=>{calls.push('write');return {...user,...body};}};
 const module=await Test.createTestingModule({
   imports:[PassportModule.register({defaultStrategy:'jwt'}),JwtModule.register({secret})],
   controllers:[UsersController,TopicsController,PostsController],
   providers:[JwtStrategy,{provide:UsersService,useValue:users},
     {provide:getRepositoryToken(Topic),useValue:{}},{provide:PostsService,useValue:{}}]
 }).compile();
 app=module.createNestApplication();app.useLogger(false);await app.listen(0,'127.0.0.1');
 const base=await app.getUrl();assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 const jwt=module.get(JwtService);const own=jwt.sign({sub:7,email:user.email},{expiresIn:'1m'}),other=jwt.sign({sub:8,email:'other@example.invalid'},{expiresIn:'1m'});
 const checks=[];
 async function check(title,path,status,token,method='GET',body){const response=await fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,status,title);checks.push(title);return response;}
 await check('anonymous private account rejected','/users/7',401);
 await check('invalid JWT rejected','/users/7',401,'invalid');
 await check('another owner rejected','/users/7',403,other);assert(!calls.includes('write'));
 const missing=jwt.sign({sub:2147483647},{expiresIn:'1m'});await check('missing account JWT rejected','/users/7',401,missing);
 const response=await check('owner receives safe profile','/users/7',200,own);const dto=await response.json();assert.equal(dto.id,7);assert(!('password' in dto));assert(!('email_token' in dto));assert(!('email_token_expires_at' in dto));
 await check('mass assignment denied','/users/7',400,own,'PATCH',{name:'Buyer',balance:999});assert(!calls.includes('write'));
 await check('owner allowlisted patch succeeds','/users/7',200,own,'PATCH',{name:' Buyer '});
 for(const [path,method] of [['/users','GET'],['/users','POST'],['/users/7/balance','POST'],['/topics','GET'],['/topics','POST'],['/posts','POST']])await check('legacy handler absent '+method+' '+path,path,404,own,method);
 active=false;await check('previously issued JWT rejected after account deletion','/users/7',401,own);active=true;
 lookupFailed=true;const failure=await check('account lookup failure closes access','/users/7',503,own);assert(!(await failure.text()).includes('PRIVATE_DATABASE_FAILURE'));lookupFailed=false;
 fs.writeFileSync('work/backend-regression-security-http.json',JSON.stringify({status:'LOOPBACK_SECURITY_PASS',checks,databaseConnected:false,activeServicesUsed:false},null,2));console.log(JSON.stringify({status:'LOOPBACK_SECURITY_PASS',checks:checks.length}));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{if(app)await app.close();if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;});
