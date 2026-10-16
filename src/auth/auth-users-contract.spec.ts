import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('synthetic-hash'), compare: jest.fn().mockResolvedValue(true) }));

describe('AuthService / UsersService internal contract', () => {
  const fixture = { id:101, email:'fixture@example.invalid', name:'Fixture', password:'synthetic-hash', balance:0, avatar_url:null, email_verified:false, email_token:'a'.repeat(64), email_token_expires_at:new Date(Date.now()+86400000), created_at:new Date() };
  const users={getByEmail:jest.fn(),create:jest.fn(),findByEmailToken:jest.fn(),update:jest.fn(),getById:jest.fn(),getOwnProfile:jest.fn()};
  const mail={sendVerificationEmail:jest.fn().mockResolvedValue(null)};
  const jwt={sign:jest.fn().mockReturnValue('synthetic-jwt')};
  let auth:AuthService;
  const demoKeys = ['LOCAL_DEMO_MAILPIT', 'LOCAL_DEMO_SCENARIO', 'SMTP_HOST'] as const;
  const savedDemoEnvironment: Partial<Record<typeof demoKeys[number], string>> = {};
  beforeEach(() => {
    for (const key of demoKeys) {
      const value = process.env[key];
      if (value === undefined) delete savedDemoEnvironment[key];
      else savedDemoEnvironment[key] = value;
    }
    // Explicit non-demo policy, with no real MailService/SMTP construction.
    // Empty strings left by a Windows/.NET null reset are deliberately invalid.
    process.env.LOCAL_DEMO_MAILPIT = 'false';
    delete process.env.LOCAL_DEMO_SCENARIO;
    delete process.env.SMTP_HOST;
  });
  afterEach(() => {
    for (const key of demoKeys) {
      const value = savedDemoEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  beforeEach(()=>{jest.clearAllMocks();auth=new AuthService(users as unknown as UsersService,jwt as unknown as JwtService,mail as unknown as MailService);});
  it('registration still hashes and creates through internal UsersService',async()=>{
    users.getByEmail.mockResolvedValue(null);users.create.mockResolvedValue(fixture);
    const res=await auth.register('fixture@example.invalid','Synthetic1!','Fixture','+12025550123');
    expect(bcrypt.hash).toHaveBeenCalledWith('Synthetic1!',10);
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({password:'synthetic-hash',balance:0,email_verified:false}));
    expect(res.user).not.toHaveProperty('password');expect(res.user).not.toHaveProperty('email_token');
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({phone_e164:'+12025550123',phone_verified:false,phone_verified_at:null}));
    expect(res.user).not.toHaveProperty('phone_e164');
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
  it('old accounts with no phone still log in; only authenticated profile exposes nullable fields', async () => {
    users.getByEmail.mockResolvedValue(fixture);
    const login = await auth.login(fixture.email, 'synthetic-password');
    expect(login.user).not.toHaveProperty('phone_e164');
    expect(jwt.sign).toHaveBeenCalledWith({sub:fixture.id,email:fixture.email,name:fixture.name});
    users.getOwnProfile.mockResolvedValue({...fixture,phone_e164:null,phone_verified:false,phone_verified_at:null});
    expect(await auth.profile({id:fixture.id,email:fixture.email})).toMatchObject({phone_e164:null,phone_verified:false,phone_verified_at:null});
    expect(users.getOwnProfile).toHaveBeenCalledWith(fixture.id);
  });
  it('accepts duplicate unverified phone numbers for different new accounts', async () => {
    users.getByEmail.mockResolvedValue(null);users.create.mockResolvedValue(fixture);
    await auth.register('first@example.test','Synthetic1!','First','+12025550123');
    await auth.register('second@example.test','Synthetic1!','Second','+12025550123');
    expect(users.create).toHaveBeenCalledTimes(2);
    for (const [data] of users.create.mock.calls) {
      expect(data).toMatchObject({phone_e164:'+12025550123',phone_verified:false});
    }
  });
});
