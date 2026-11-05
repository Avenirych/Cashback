import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { FinanceJwtStrategy } from '../finance/finance-jwt';

describe('mandatory session version on issuer and both strategies (source-only scenarios)', () => {
  const oldSecret = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = 'synthetic-session-contract-key-not-for-deployment'; });
  afterAll(() => { if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret; });
  const user = { id:7, email:'synthetic@example.test', name:'Synthetic', sessionVersion:0 };
  it('issues sv from the authenticated user snapshot and refuses missing authority', () => {
    const sign=jest.fn().mockReturnValue('synthetic-token');
    const auth=new AuthService({} as any,{sign} as any,{} as any);
    expect((auth as any).createAccessToken(user)).toBe('synthetic-token');
    expect(sign).toHaveBeenCalledWith(expect.objectContaining({sub:7,sv:0}));
    expect(()=> (auth as any).createAccessToken({...user,sessionVersion:undefined})).toThrow('Session authority unavailable');
  });
  it('main strategy rejects a missing claim before user lookup', async () => {
    const users={getById:jest.fn()};const strategy=new JwtStrategy(users as any);
    await expect(strategy.validate({sub:7})).rejects.toMatchObject({status:401});
    expect(users.getById).not.toHaveBeenCalled();
  });
  it('main strategy accepts only an exact current server version', async () => {
    const users={getById:jest.fn().mockResolvedValue(user)};const strategy=new JwtStrategy(users as any);
    await expect(strategy.validate({sub:7,sv:0})).resolves.toEqual({id:7,email:user.email,sv:0});
    users.getById.mockResolvedValue({...user,sessionVersion:1});
    await expect(strategy.validate({sub:7,sv:0})).rejects.toMatchObject({status:401});
    users.getById.mockResolvedValue({...user,sessionVersion:undefined});
    await expect(strategy.validate({sub:7,sv:0})).rejects.toMatchObject({status:503});
  });
  it('finance strategy rejects legacy claims without touching either authority', async () => {
    const source={createQueryRunner:jest.fn()};const authority={verifyFinance:jest.fn()};
    const strategy=new FinanceJwtStrategy(source as any,authority);
    await expect(strategy.validate({sub:7,account_uuid:'01234567-89ab-4cde-8fab-0123456789ab'})).rejects.toMatchObject({status:401});
    expect(authority.verifyFinance).not.toHaveBeenCalled();expect(source.createQueryRunner).not.toHaveBeenCalled();
  });
  it('finance authority failure is sanitized503 before ledger access', async () => {
    const source={createQueryRunner:jest.fn()};const authority={verifyFinance:jest.fn().mockRejectedValue(Error('PRIVATE_AUTHORITY_DETAIL'))};
    const strategy=new FinanceJwtStrategy(source as any,authority);
    await expect(strategy.validate({sub:7,account_uuid:'01234567-89ab-4cde-8fab-0123456789ab',sv:0}))
      .rejects.toMatchObject({status:503,message:'Session authority unavailable'});
    expect(source.createQueryRunner).not.toHaveBeenCalled();
  });

  it.each(['0',-1,0.5,null])('both strategies reject invalid sv %# before any authority lookup',async sv=>{
    const users={getById:jest.fn()};const main=new JwtStrategy(users as any);
    await expect(main.validate({sub:7,sv})).rejects.toMatchObject({status:401});expect(users.getById).not.toHaveBeenCalled();
    const source={createQueryRunner:jest.fn()},authority={verifyFinance:jest.fn()};
    await expect(new FinanceJwtStrategy(source as any,authority).validate({sub:7,account_uuid:'01234567-89ab-4cde-8fab-0123456789ab',sv}))
      .rejects.toMatchObject({status:401});
    expect(authority.verifyFinance).not.toHaveBeenCalled();expect(source.createQueryRunner).not.toHaveBeenCalled();
  });
});
