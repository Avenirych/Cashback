import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

describe('JWT active account validation', () => {
  const users = { getById: jest.fn() };
  let strategy: JwtStrategy;
  beforeEach(() => { process.env.JWT_SECRET = 'synthetic-active-user-test-key'; strategy = new JwtStrategy(users as unknown as UsersService); users.getById.mockReset(); });
  it.each([false, true])('permits existing account, email_verified=%s, using current email', async email_verified => {
    users.getById.mockResolvedValue({ id: 7, email: 'current@example.test', email_verified });
    await expect(strategy.validate({ sub: 7, email: 'stale@example.test' })).resolves.toEqual({ id: 7, email: 'current@example.test' });
  });
  it.each([null, undefined, { id: 8 }])('denies deleted, missing or mismatched identity %p', async user => {
    users.getById.mockResolvedValue(user);
    await expect(strategy.validate({ sub: 7, email: 'a@example.test' })).rejects.toMatchObject({ status: 401 });
  });
  it.each([0, -1, NaN, 1.5, '7', null])('denies invalid subject %p before lookup', async sub => {
    await expect(strategy.validate({ sub: sub as number, email: '' })).rejects.toMatchObject({ status: 401 }); expect(users.getById).not.toHaveBeenCalled();
  });
  it('fails closed on lookup failure without exposing database details', async () => {
    users.getById.mockRejectedValue(Error('PRIVATE_DATABASE_DETAIL'));
    await expect(strategy.validate({ sub: 7, email: '' })).rejects.toMatchObject({ status: 503, message: 'Authentication temporarily unavailable' });
  });
});
