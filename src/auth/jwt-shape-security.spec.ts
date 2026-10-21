import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

describe('JWT payload shape and PostgreSQL identity bounds', () => {
  const users = { getById: jest.fn() };
  let strategy: JwtStrategy;
  const oldSecret = process.env.JWT_SECRET;
  beforeEach(() => {
    process.env.JWT_SECRET = 'synthetic-shape-test-key';
    users.getById.mockReset();
    strategy = new JwtStrategy(users as unknown as UsersService);
  });
  afterAll(() => { if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret; });
  it.each([null, undefined, [], [7], '7', 7, true, () => 7, {}, {sub:2147483648}, {sub:Infinity}, {sub:Number.MAX_SAFE_INTEGER}])('rejects malformed payload %# before querying users', async payload => {
    await expect(strategy.validate(payload)).rejects.toMatchObject({status:401});
    expect(users.getById).not.toHaveBeenCalled();
  });
  it('accepts maximum PostgreSQL int32 identity only when persisted identity matches', async () => {
    users.getById.mockResolvedValue({id:2147483647,email:'persisted@example.test',email_verified:false});
    await expect(strategy.validate({sub:2147483647,email:'claim@example.test'})).resolves.toEqual({id:2147483647,email:'persisted@example.test'});
    expect(users.getById).toHaveBeenCalledWith(2147483647);
  });
});
