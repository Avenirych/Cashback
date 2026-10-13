import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('synthetic-hash'), compare: jest.fn().mockResolvedValue(true) }));

describe('AuthService / UsersService internal contract', () => {
  const fixture = { id:101, email:'fixture@example.invalid', name:'Fixture', password:'synthetic-hash', balance:0, avatar_url:null, email_verified:false, email_token:'a'.repeat(64), email_token_expires_at:new Date(Date.now()+86400000), created_at:new Date() };
  const users={getByEmail:jest.fn(),create:jest.fn(),findByEmailToken:jest.fn(),update:jest.fn(),getById:jest.fn()};
  const mail={sendVerificationEmail:jest.fn().mockResolvedValue(null)};
  const jwt={sign:jest.fn().mockReturnValue('synthetic-jwt')};
  let auth:AuthService;
  beforeEach(()=>{jest.clearAllMocks();auth=new AuthService(users as unknown as UsersService,jwt as unknown as JwtService,mail as unknown as MailService);});
  it('registration still hashes and creates through internal UsersService',async()=>{
    users.getByEmail.mockResolvedValue(null);users.create.mockResolvedValue(fixture);
    const res=await auth.register('fixture@example.invalid','Synthetic1!','Fixture');
    expect(bcrypt.hash).toHaveBeenCalledWith('Synthetic1!',10);
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({password:'synthetic-hash',balance:0,email_verified:false}));
    expect(res.user).not.toHaveProperty('password');expect(res.user).not.toHaveProperty('email_token');
  });
  it('login still reads the internal hash and returns safe user',async()=>{
    users.getByEmail.mockResolvedValue(fixture);const res=await auth.login('fixture@example.invalid','synthetic-password');
    expect(bcrypt.compare).toHaveBeenCalledWith('synthetic-password','synthetic-hash');expect(res.user).not.toHaveProperty('password');
  });
  it('verification retains the internal sensitive-field update workflow',async()=>{
    users.findByEmailToken.mockResolvedValue(fixture);users.update.mockResolvedValue({...fixture,email_verified:true,email_token:null,email_token_expires_at:null});
    const res=await auth.verifyEmail('a'.repeat(64));
    expect(users.update).toHaveBeenCalledWith(101,{email_verified:true,email_token:null,email_token_expires_at:null});
    expect(res.user.email_verified).toBe(true);expect(res.user).not.toHaveProperty('email_token');
  });
});
