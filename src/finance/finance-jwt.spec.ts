import {Test} from '@nestjs/testing';
import {JwtService} from '@nestjs/jwt';
import {FinanceReadModule} from './finance-read.module';
import {financeSessionClaims} from './finance-jwt';
import request from 'supertest';
const uuid='01234567-89ab-4cde-8fab-0123456789ab';
describe('isolated financial HTTP JWT boundary',()=>{
 let app:any;let old:string|undefined;let seen:any[];let identity:string;const secret='synthetic-finance-http-secret-only';
 beforeAll(async()=>{
  old=process.env.JWT_SECRET;process.env.JWT_SECRET=secret;
  const source:any={options:{name:'finance-readonly',username:'cashback_finance_ro',synchronize:false,migrationsRun:false}};
  source.createQueryRunner=()=>{const r:any={connect:async()=>{},startTransaction:async()=>{r.isTransactionActive=true},commitTransaction:async()=>{r.isTransactionActive=false},rollbackTransaction:async()=>{r.isTransactionActive=false},release:async()=>{},query:async(sql:string,args:any[])=>{
   if(sql.includes('FROM public.users'))return[{id:7,email_verified:true,account_uuid:identity}];
   if(sql.includes('finance_postings')){seen.push(args);return[];}
   return[];
  }};r.manager={query:r.query};return r;};
  const m=await Test.createTestingModule({imports:[FinanceReadModule.prepare(source)]}).compile();app=m.createNestApplication();await app.init();
 });
 beforeEach(()=>{seen=[];identity=uuid});
 afterAll(async()=>{await app?.close();if(old===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=old});
 const token=(claims:any,key=secret)=>new JwtService().sign(claims,{secret:key,expiresIn:'5m'});
 it('rejects missing JWT',async()=>{await request(app.getHttpServer()).get('/api/v1/my/bonus-data/history').expect(401)});
 it('rejects bad signature',async()=>{await request(app.getHttpServer()).get('/api/v1/my/bonus-data/history').auth(token(financeSessionClaims(7,uuid),'other-key'),{type:'bearer'}).expect(401)});
 it('rejects expired signed JWT',async()=>{const expired=new JwtService().sign({...financeSessionClaims(7,uuid),exp:1},{secret});await request(app.getHttpServer()).get('/api/v1/my/bonus-data/history').auth(expired,{type:'bearer'}).expect(401)});
 it('rejects old numeric-sub-only JWT',async()=>{await request(app.getHttpServer()).get('/api/v1/my/bonus-data/history').auth(token({sub:7}),{type:'bearer'}).expect(401)});
 it('rejects an old token after numeric id reassignment',async()=>{identity='ffffffff-ffff-4fff-8fff-ffffffffffff';await request(app.getHttpServer()).get('/api/v1/my/bonus-data/history').auth(token(financeSessionClaims(7,uuid)),{type:'bearer'}).expect(401);expect(seen).toEqual([])});
 it('rejects owner selector even with valid identity',async()=>{await request(app.getHttpServer()).get('/api/v1/my/bonus-data/history?owner=someone-else').auth(token(financeSessionClaims(7,uuid)),{type:'bearer'}).expect(400);expect(seen).toEqual([])});
 it('valid JWT reads only canonical own owner',async()=>{await request(app.getHttpServer()).get('/api/v1/my/bonus-data/history').auth(token(financeSessionClaims(7,uuid)),{type:'bearer'}).expect(200);expect(seen).toEqual([['cb:user:'+uuid]])});
 it('does not expose a financial write endpoint',async()=>{await request(app.getHttpServer()).post('/api/v1/my/bonus-data/history').auth(token(financeSessionClaims(7,uuid)),{type:'bearer'}).send({amount:100}).expect(404)});
});
