import {AuthService} from './auth.service';
import {JwtStrategy} from './jwt.strategy';
import {UsersService} from '../users/users.service';
import {User} from '../users/user.entity';
import {rememberServerIdentity,serverAccountUuid} from '../users/server-account-identity';
jest.mock('bcrypt',()=>({hash:jest.fn().mockResolvedValue('synthetic-hash'),compare:jest.fn().mockResolvedValue(true)}));
const uuid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const user=(verified=true)=>({id:7,email:'synthetic@example.test',name:'Synthetic',password:'synthetic-hash',email_verified:verified} as User);
function setup(){const users:any={getByEmail:jest.fn(),create:jest.fn(),consumeEmailToken:jest.fn(),getById:jest.fn()};const jwt:any={sign:jest.fn().mockReturnValue('synthetic-jwt')};const mail:any={sendVerificationEmail:jest.fn().mockResolvedValue(null)};return{users,jwt,service:new AuthService(users,jwt,mail)}}
describe('UUID issuer bound to original server auth row',()=>{
 it('login signs UUID from password-verified row without rereading id',async()=>{const x=setup();const original=rememberServerIdentity(user(),uuid);x.users.getByEmail.mockResolvedValue(original);x.users.getById.mockResolvedValue(rememberServerIdentity(user(),other));await x.service.login('synthetic@example.test','password');expect(x.jwt.sign).toHaveBeenCalledWith({sub:7,email:original.email,name:original.name,account_uuid:uuid});expect(x.users.getById).not.toHaveBeenCalled()});
 it('does not accept a client/entity UUID property',async()=>{const x=setup(),u=user();(u as any).account_uuid=other;x.users.getByEmail.mockResolvedValue(u);await x.service.login(u.email,'password');expect(x.jwt.sign.mock.calls[0][0]).not.toHaveProperty('account_uuid')});
 it('pre-migration NULL retains legacy login without financial identity',async()=>{const x=setup();x.users.getByEmail.mockResolvedValue(rememberServerIdentity(user(),null));await x.service.login('synthetic@example.test','password');expect(x.jwt.sign.mock.calls[0][0]).not.toHaveProperty('account_uuid')});
 it('registration signs returned INSERT identity and ignores request UUID',async()=>{const x=setup();x.users.getByEmail.mockResolvedValue(null);x.users.create.mockResolvedValue(rememberServerIdentity(user(false),uuid));const r=await x.service.register('new@example.test','Synthetic1!','Synthetic',{firstName:'Synthetic',lastName:'Buyer',phone_e164:'+12025550123',account_uuid:other} as any);expect(x.jwt.sign.mock.calls[0][0].account_uuid).toBe(uuid);expect(x.users.create.mock.calls[0][0]).not.toHaveProperty('account_uuid');expect(r.user).not.toHaveProperty('account_uuid');expect(r.user).not.toHaveProperty('password')});
 it('verification signs consumed UPDATE identity, never a replacement account',async()=>{const x=setup();x.users.consumeEmailToken.mockResolvedValue(rememberServerIdentity(user(),uuid));x.users.getById.mockResolvedValue(rememberServerIdentity(user(),other));await x.service.verifyEmail('a'.repeat(64));expect(x.jwt.sign.mock.calls[0][0].account_uuid).toBe(uuid);expect(x.users.getById).not.toHaveBeenCalled()});
 it('missing/reused verification token does not issue any JWT',async()=>{const x=setup();x.users.consumeEmailToken.mockResolvedValue(null);await expect(x.service.verifyEmail('a'.repeat(64))).rejects.toThrow();expect(x.jwt.sign).not.toHaveBeenCalled()});
 it('rejects corrupt server UUID and changed bound id',()=>{expect(()=>rememberServerIdentity(user(),'bad')).toThrow('identity');const u=rememberServerIdentity(user(),uuid);u.id=8;expect(()=>serverAccountUuid(u)).toThrow('identity')});
});
describe('ordinary JWT transition and generation validation',()=>{
 const old=process.env.JWT_SECRET;beforeAll(()=>{process.env.JWT_SECRET='synthetic-uuid-transition-secret'});afterAll(()=>{if(old===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=old});
 function fixture(uuidValue:string|null){const users:any={getById:jest.fn().mockResolvedValue(rememberServerIdentity(user(),uuidValue))};return new JwtStrategy(users)}
 it('legacy JWT works before migration only',async()=>{await expect(fixture(null).validate({sub:7})).resolves.toEqual({id:7,email:'synthetic@example.test'})});
 it('requires fresh login for legacy JWT after identity enrollment',async()=>{await expect(fixture(uuid).validate({sub:7})).rejects.toMatchObject({status:401})});
 it('accepts signed matching UUID in server context',async()=>{await expect(fixture(uuid).validate({sub:7,account_uuid:uuid})).resolves.toMatchObject({id:7,account_uuid:uuid})});
 it.each([null,'bad',other])('rejects corrupt or wrong generation %#',async value=>{await expect(fixture(uuid).validate({sub:7,account_uuid:value})).rejects.toMatchObject({status:401})});
 it('migration absence never permits a UUID claim',async()=>{await expect(fixture(null).validate({sub:7,account_uuid:uuid})).rejects.toMatchObject({status:401})});
});
describe('repository captures UUID from a single statement',()=>{
 it('same-row raw projection is used with credentials',async()=>{const entity=user();const q:any={where:jest.fn().mockReturnThis(),addSelect:jest.fn().mockReturnThis(),getRawAndEntities:jest.fn().mockResolvedValue({entities:[entity],raw:[{u_id:7,auth_account_uuid:uuid}]})};const users=new UsersService({createQueryBuilder:()=>q} as any);const r=await users.getByEmail(entity.email);expect(serverAccountUuid(r!)).toBe(uuid);expect(q.addSelect).toHaveBeenCalledWith("to_jsonb(u)->>'account_uuid'",'auth_account_uuid');expect(q.getRawAndEntities).toHaveBeenCalledTimes(1)});
 it('ambiguous raw/entity mapping fails closed',async()=>{const q:any={where:()=>q,addSelect:()=>q,getRawAndEntities:async()=>({entities:[user()],raw:[{u_id:8,auth_account_uuid:uuid}]})};await expect(new UsersService({createQueryBuilder:()=>q} as any).getById(7)).rejects.toThrow('identity')});
});
