import 'reflect-metadata';
import { Controller, Post, Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FinancialWriteGuard, NonFinancialMutation, assertFinancialWritesAllowed, NON_FINANCIAL_MUTATION } from './financial-write-deny';
import { BonusController } from './bonus/bonus.controller';
import { BonusService } from './bonus/bonus.service';
import { BonusTransferController } from './bonus-transfer/bonus-transfer.controller';
import { BonusTransferService } from './bonus-transfer/bonus-transfer.service';
import { BalanceController } from './balance/balance.controller';
import { BalanceService } from './balance/balance.service';
import { WithdrawalController } from './withdrawal/withdrawal.controller';
import { WithdrawalService } from './withdrawal/withdrawal.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { UsersService } from './users/users.service';
import inventory from './financial-writer-inventory.json';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const modes=[{}, {NODE_ENV:'development'}, {NODE_ENV:'production'}, {CASHBACK_BACKEND_PROFILE:'staging'},
 {HISTORICAL_LOCAL:'true',HISTORICAL_CONTAINER:'true',CASHBACK_DEMO_ONLY:'true'},
 {CASHBACK_FINANCIAL_ADMISSION:'true',CASHBACK_FINANCIAL_API:'true',CASHBACK_FINANCIAL_WRITES:'true'},
 {CASHBACK_FINANCIAL_ADMISSION:'invalid'}, {CASHBACK_BACKEND_PROFILE:'production',CASHBACK_DEMO_ONLY:'false'}];
const previous=process.env;afterAll(()=>{process.env=previous});
describe.each(modes)('unmocked service denial, config %#',mode=>{
 beforeEach(()=>{process.env={...previous,...mode}});
 test.each(inventory)('$class.$method refuses before dependency/transaction access',async item=>{
  const C=require('./'+item.file.slice(4).replace(/\.ts$/,''))[item.class];let effects=0;
  const instance=new Proxy(Object.create(C.prototype),{get(target,key,receiver){if(key===item.method)return Reflect.get(target,key,receiver);effects++;throw Error('DEPENDENCY_TOUCHED')}});
  const invoke=()=>Reflect.apply(instance[item.method],instance,Array(item.parameters).fill(undefined));
  await expect(Promise.resolve().then(invoke)).rejects.toMatchObject({response:{code:'FINANCIAL_WRITES_DISABLED'},status:403});expect(effects).toBe(0);
 });
});
test('generic user updates and initial balance cannot bypass deny',async()=>{
 const repository={create:jest.fn(),update:jest.fn(),save:jest.fn()};const s=new UsersService(repository as any);
 await expect(s.update(1,{balance:1})).rejects.toMatchObject({status:403});
 await expect(s.create({balance:1})).rejects.toMatchObject({status:403});
 expect(repository.create).not.toHaveBeenCalled();expect(repository.update).not.toHaveBeenCalled();expect(repository.save).not.toHaveBeenCalled();
});
test('inventory entries have literal first-statement service denial',()=>{
 for(const item of inventory){const source=readFileSync(join(__dirname,item.file.slice(4)),'utf8');expect(source).toContain('assertFinancialWritesAllowed();');}
});
@Controller('nonfinancial-probe')
class NonFinancialProbe { @Post() @NonFinancialMutation() write(){return {ok:true};} }
@Controller('future-financial-alias')
class FutureWriter { @Post() write(){throw Error('HANDLER_MUST_NOT_RUN');} }
const calls=jest.fn(()=>{throw Error('SERVICE_MUST_NOT_RUN')});
const fake={transferBonuses:calls,spendBonusesOnPurchase:calls,transfer:calls,addOperation:calls,requestWithdrawal:calls,approve:calls,reject:calls};
const paths=['/api/bonus/transfer','/api/bonus/spend-on-purchase','/bonus-transfer','/balance/1','/withdrawal/1','/withdrawal/approve/1','/withdrawal/reject/1','/future-financial-alias'];
describe.each(['','/test-prefix'])('HTTP global deny with prefix %s',prefix=>{
 let app:any;
 beforeAll(async()=>{
  const m=await Test.createTestingModule({controllers:[BonusController,BonusTransferController,BalanceController,WithdrawalController,NonFinancialProbe,FutureWriter],providers:[{provide:APP_GUARD,useClass:FinancialWriteGuard},...([BonusService,BonusTransferService,BalanceService,WithdrawalService].map(provide=>({provide,useValue:fake})))]})
   .overrideGuard(JwtAuthGuard).useValue({canActivate:()=>true}).compile();
  app=m.createNestApplication();if(prefix)app.setGlobalPrefix(prefix.slice(1));
  app.use((req:any,_res:any,next:any)=>{if(req.headers['x-test-role']!=='anonymous')req.user={id:1,role:req.headers['x-test-role']};next();});
  await app.init();
 });
 afterAll(async()=>{await app?.close()});
 test.each(modes)('all financial URLs deny anonymous/user/admin in config %#',async mode=>{
  process.env={...previous,...mode};calls.mockClear();
  for(const role of ['anonymous','user','admin'])for(const path of paths){const r=await request(app.getHttpServer()).post(prefix+path).set('x-test-role',role).send({amount:1});expect(r.status).toBe(403);expect(r.body.code).toBe('FINANCIAL_WRITES_DISABLED');}
  expect(calls).not.toHaveBeenCalled();
 });
 test('classified nonfinancial mutation still executes',async()=>{const r=await request(app.getHttpServer()).post(prefix+'/nonfinancial-probe').send({});expect(r.status).toBe(201);expect(r.body).toEqual({ok:true});});
});
