import {AuthController} from './auth.controller';
import {AuthService} from './auth.service';
import {MailService} from '../mail/mail.service';
import {verificationFrontendOrigin} from '../mail/verification-origin';
import {Logger} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as bcrypt from 'bcrypt';
jest.mock('nodemailer',()=>({createTransport:jest.fn()}));
jest.mock('bcrypt',()=>({hash:jest.fn(),compare:jest.fn()}));
const keys=['HISTORICAL_LOCAL','FRONTEND_URL','SMTP_HOST','NODE_ENV'];
let saved:Record<string,string|undefined>;
beforeEach(()=>{
 saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.HISTORICAL_LOCAL='true';process.env.FRONTEND_URL='http://localhost:3004';
 process.env.SMTP_HOST='mock.invalid';process.env.NODE_ENV='development';
 jest.spyOn(Logger.prototype,'log').mockImplementation(()=>{});
 (bcrypt.hash as jest.Mock).mockResolvedValue('mock-hash');
 (bcrypt.compare as jest.Mock).mockResolvedValue(true);
});
afterEach(()=>{jest.restoreAllMocks();for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}});
test.each(['http://127.0.0.1:3005','http://localhost:3005','http://localhost:3004'])('mock registration/mail/one-time verification/login retains %s',async origin=>{
 let account:any;
 const sent:any[]=[];
 (nodemailer.createTransport as jest.Mock).mockReturnValue({sendMail:jest.fn(async message=>{sent.push(message);return {};})});
 const users:any={
 getByEmail:jest.fn(async()=>account??null),
 create:jest.fn(async data=>account={id:42,...data}),
 update:jest.fn(async(_id,data)=>account={...account,...data}),
 consumeEmailToken:jest.fn(async token=>{
  if(!account.email_token||account.email_token!==token)return null;
  account={...account,email_verified:true,email_token:null};return account;
 })
 };
 const auth=new AuthService(users,{sign:()=> 'synthetic-session'} as any,new MailService());
 const c=new AuthController(auth);
 const registration=await c.register({firstName:'Fixture',lastName:'Buyer',name:'Fixture Buyer',email:'fixture@example.test',password:'Fixture8!',phone_e164:'+12025550123'},{headers:{origin}});
 expect(registration.verification_email_sent).toBe(true);
 const address=new URL(sent[0].html.match(/href="([^"]+)"/)[1]);
 expect(address.origin).toBe(origin);expect(address.pathname).toBe('/verify-email');
 const token=address.searchParams.get('token')!;
 expect(token).toMatch(/^[a-f0-9]{64}$/);
 expect(account.email_token_expires_at.getTime()-Date.now()).toBeGreaterThan(23*60*60*1000);
 expect((await c.verifyEmail(token)).user.email_verified).toBe(true);
 await expect(c.verifyEmail(token)).rejects.toThrow('Invalid or expired verification token');
 expect((await c.login({email:'fixture@example.test',password:'Fixture8!'})).user.email_verified).toBe(true);
 account.email_verified=false;
 await c.resendVerification({email:'fixture@example.test'},{headers:{origin}});
 expect(new URL(sent[1].html.match(/href="([^"]+)"/)[1]).origin).toBe(origin);
});
test.each(['https://evil.example','http://127.0.0.1:3005.evil.example','http://localhost:3005/redirect','null',undefined])('untrusted origin %# never selects a redirect',origin=>{
 expect(verificationFrontendOrigin(origin)).toBe('http://localhost:3004');
});
test('public production always uses configured URL even for local Origin headers',()=>{
 process.env.NODE_ENV='production';process.env.FRONTEND_URL='https://cashback.example';
 expect(verificationFrontendOrigin('http://127.0.0.1:3005')).toBe('https://cashback.example');
});
test('local origins require both explicit local isolation and the known local frontend config',()=>{
 delete process.env.HISTORICAL_LOCAL;
 expect(verificationFrontendOrigin('http://127.0.0.1:3005')).toBe('http://localhost:3004');
});

test('production ignores local origins even with historical flags accidentally retained',()=>{process.env.NODE_ENV='production';expect(verificationFrontendOrigin('http://127.0.0.1:3005')).toBe('http://localhost:3004');});
