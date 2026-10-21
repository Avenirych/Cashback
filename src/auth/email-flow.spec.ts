import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
const token = 'a'.repeat(64);
const account = {id: 9, email: 'test@example.test', name: 'Buyer', email_verified: false} as User;
function setup() {
 const users = { consumeEmailToken: jest.fn(), getByEmail: jest.fn(), update: jest.fn().mockResolvedValue(account) };
 const mail = {sendResendVerificationEmail: jest.fn().mockResolvedValue(null)};
 const service = new AuthService(users as unknown as UsersService, {sign: jest.fn().mockReturnValue('signed-session')} as unknown as JwtService, mail as unknown as MailService);
 return {users,mail,service};
}
test('valid token returns server-verified session and never token fields', async()=>{
 const {users,service}=setup();users.consumeEmailToken.mockResolvedValue({...account,email_verified:true,email_token:null});
 const result=await service.verifyEmail(token);expect(result.user.email_verified).toBe(true);expect(result).not.toHaveProperty('email_token');expect(users.consumeEmailToken).toHaveBeenCalledWith(token);
});
test.each(['', 'invalid', 'x'.repeat(64)])('invalid token rejected without consuming: %s',async value=>{const {users,service}=setup();await expect(service.verifyEmail(value)).rejects.toThrow('Invalid or expired');expect(users.consumeEmailToken).not.toHaveBeenCalled();});
test.each(['expired','reused','unknown'])('%s token fails closed',async()=>{const {users,service}=setup();users.consumeEmailToken.mockResolvedValue(null);await expect(service.verifyEmail(token)).rejects.toThrow('Invalid or expired');});
test('single-use atomic update enforces expiry and removes token',async()=>{
 const query:any={update:jest.fn().mockReturnThis(),set:jest.fn().mockReturnThis(),where:jest.fn().mockReturnThis(),returning:jest.fn().mockReturnThis(),execute:jest.fn().mockResolvedValue({raw:[{id:9}]})};
 query.addSelect=jest.fn().mockReturnThis();query.getOne=jest.fn().mockResolvedValue({...account,email_verified:true});
 const repo:any={createQueryBuilder:()=>query,findOne:jest.fn().mockResolvedValue({...account,email_verified:true})};
 const users=new UsersService(repo);expect((await users.consumeEmailToken(token))?.email_verified).toBe(true);
 expect(query.where.mock.calls[0][0]).toContain('email_verified = false');expect(query.where.mock.calls[0][0]).toContain('email_token_expires_at > CURRENT_TIMESTAMP');expect(query.set).toHaveBeenCalledWith({email_verified:true,email_token:null,email_token_expires_at:null});
 query.execute.mockResolvedValue({raw:[]});expect(await users.consumeEmailToken(token)).toBeNull();
});
test('resend returns identical response for unknown, verified and pending accounts; bounded cooldown',async()=>{
 const {users,mail,service}=setup();users.getByEmail.mockResolvedValue(account);
 const pending=await service.resendVerificationEmail(account.email);expect(mail.sendResendVerificationEmail).toHaveBeenCalledTimes(1);
 expect(await service.resendVerificationEmail(account.email)).toEqual(pending);expect(mail.sendResendVerificationEmail).toHaveBeenCalledTimes(1);
 users.getByEmail.mockResolvedValue(null);expect(await service.resendVerificationEmail('missing@example.test')).toEqual(pending);
 users.getByEmail.mockResolvedValue({...account,email_verified:true});expect(await service.resendVerificationEmail('verified@example.test')).toEqual(pending);expect(pending).not.toHaveProperty('preview_url');
});
test('resend IP limit prevents address spraying without trusting forwarded headers',async()=>{const {service}=setup();const resend=jest.spyOn(service,'resendVerificationEmail').mockResolvedValue({message:'generic'});const controller=new AuthController(service);for(let n=0;n<10;n++)await controller.resendVerification({email:'test@example.test'},{ip:'127.0.0.1'});await expect(controller.resendVerification({email:'other@example.test'},{ip:'127.0.0.1'})).rejects.toThrow('Слишком много');expect(resend).toHaveBeenCalledTimes(10);});

test('database failure does not expose token or driver details',async()=>{const {users,service}=setup();users.consumeEmailToken.mockRejectedValue(new Error('driver parameters '+token));await expect(service.verifyEmail(token)).rejects.toThrow('temporarily unavailable');await expect(service.verifyEmail(token)).rejects.not.toThrow(token);});
