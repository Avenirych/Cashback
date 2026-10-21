import { Test } from '@nestjs/testing';
import { Logger, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
jest.mock('bcrypt', () => ({hash:jest.fn(),compare:jest.fn()}));

const fixture = { id:101,email:'fixture@example.invalid',name:'Fixture',password:'synthetic-hash',balance:0,email_verified:false,avatar_url:null,created_at:new Date(),email_token:'a'.repeat(64),email_token_expires_at:new Date(Date.now()+86400000) };
const message = 'If this account exists and requires verification, a verification email has been sent.';

describe('Public resend capability isolation',()=>{
 let app:INestApplication; let auth:AuthService; let logger:jest.SpyInstance;
 const oldMode=process.env.NODE_ENV;
 const users={getByEmail:jest.fn(),update:jest.fn(),findByEmailToken:jest.fn()};
 const mail={sendResendVerificationEmail:jest.fn()};
 const jwt={sign:jest.fn().mockReturnValue('synthetic-session-result')};
 beforeAll(async()=>{
  auth=new AuthService(users as unknown as UsersService,jwt as unknown as JwtService,mail as unknown as MailService);
  const module=await Test.createTestingModule({controllers:[AuthController],providers:[{provide:AuthService,useValue:auth}]}).compile();
  app=module.createNestApplication();await app.init();
 });
 afterAll(async()=>{await app.close();if(oldMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldMode;});
 beforeEach(()=>{jest.clearAllMocks();logger=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>{});users.getByEmail.mockResolvedValue({...fixture});users.update.mockResolvedValue({...fixture});mail.sendResendVerificationEmail.mockImplementation(async (_email,token)=>'https://fixture.invalid/verify-email?token='+token);});
 afterEach(()=>{logger.mockRestore();});

 const cases=['unverified','verified','absent','transport failure','lookup failure','update failure'] as const;
 for(const mode of ['development','production']){
  it.each(cases)(`${mode}: %s returns the same capability-free HTTP response`,async state=>{
   process.env.NODE_ENV=mode;
   if(state==='verified')users.getByEmail.mockResolvedValue({...fixture,email_verified:true});
   if(state==='absent')users.getByEmail.mockResolvedValue(null);
   if(state==='lookup failure')users.getByEmail.mockRejectedValue(new Error('synthetic lookup failure'));
   if(state==='update failure')users.update.mockRejectedValue(new Error('synthetic update failure'));
   if(state==='transport failure')mail.sendResendVerificationEmail.mockImplementation(async (_email,token)=>{throw new Error('synthetic transport capability '+token);});
   const response=await request(app.getHttpServer()).post('/auth/resend-verification').send({email:fixture.email}).expect(201);
   expect(response.body).toEqual({message});
   expect(JSON.stringify(response.body)).not.toContain(fixture.email);
   expect(JSON.stringify(response.headers)).not.toContain('fixture.invalid');
   expect(response.body).not.toHaveProperty('preview_url');
   if(state==='unverified'||state==='transport failure'){
    const generated=mail.sendResendVerificationEmail.mock.calls[0][1];
    expect(generated).toMatch(/^[a-f0-9]{64}$/);
    expect(users.update).toHaveBeenCalledWith(101,expect.objectContaining({email_token:generated,email_token_expires_at:expect.any(Date)}));
    expect(JSON.stringify(response.body)+JSON.stringify(response.headers)).not.toContain(generated);
    expect(JSON.stringify(logger.mock.calls)).not.toContain(generated);
   }
   if(state==='verified'||state==='absent'){expect(users.update).not.toHaveBeenCalled();expect(mail.sendResendVerificationEmail).not.toHaveBeenCalled();}
   expect(jwt.sign).not.toHaveBeenCalled();
  });
 }
 it('rejects invalid request without mail or secret payload',async()=>{
  const response=await request(app.getHttpServer()).post('/auth/resend-verification').send({}).expect(400);
  expect(Object.keys(response.body).sort()).toEqual(['error','message','statusCode']);expect(mail.sendResendVerificationEmail).not.toHaveBeenCalled();
 });
 it('preserves valid verification and session issuance after token validation',async()=>{
  users.findByEmailToken.mockResolvedValue({...fixture});users.update.mockResolvedValue({...fixture,email_verified:true,email_token:null,email_token_expires_at:null});
  const result=await auth.verifyEmail(fixture.email_token);
  expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({sub:101}));expect(result.user.email_verified).toBe(true);expect(result.user).not.toHaveProperty('email_token');expect(result.user).not.toHaveProperty('password');
 });
 it.each(['malformed','missing','expired'])('rejects %s verification before JWT issuance',async state=>{
  users.findByEmailToken.mockResolvedValue(state==='missing'?null:{...fixture,email_token_expires_at:new Date(0)});
  await expect(auth.verifyEmail(state==='malformed'?'invalid':fixture.email_token)).rejects.toThrow();
  expect(jwt.sign).not.toHaveBeenCalled();expect(users.update).not.toHaveBeenCalled();
 });
});
