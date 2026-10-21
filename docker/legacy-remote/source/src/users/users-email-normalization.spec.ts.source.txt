import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { normalizeEmail } from './email-normalization';

describe('Internal UsersService email normalization', () => {
  const email = 'first.last+alias@example.test';
  const fixture = { id: 42, email };
  const repo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() };
  let service: UsersService;
  beforeEach(() => {
    jest.resetAllMocks();
    repo.findOne.mockResolvedValue(fixture);
    repo.create.mockImplementation(data => data);
    repo.save.mockImplementation(async data => data);
    service = new UsersService(repo as unknown as Repository<User>);
  });
  it.each(['FIRST.LAST+ALIAS@EXAMPLE.TEST', '\t First.Last+Alias@Example.Test\n', '\u00a0First.Last+Alias@Example.Test\u00a0'])('normalizes lookup, create and internal email update: case %#', async value => {
    expect(normalizeEmail(value)).toBe(email);
    await service.getByEmail(value);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { email } });
    const data = Object.freeze({ email: value, name: 'Synthetic' });
    await service.create(data);
    expect(repo.create).toHaveBeenCalledWith({ email, name: data.name });
    await service.update(42, data);
    expect(repo.update).toHaveBeenCalledWith(42, { email, name: data.name });
    expect(data.email).toBe(value);
  });
  it('does not add email to unrelated updates or alter verification fields', async () => {
    const data = { email_verified: true, email_token: null, email_token_expires_at: null };
    await service.update(42, data);
    expect(repo.update).toHaveBeenCalledWith(42, data);
  });
  it('does not alter the email-token lookup', async () => {
    const token = 'synthetic-token';
    await service.findByEmailToken(token);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { email_token: token } });
  });
  it('propagates repository create failures without saving a second account', async () => {
    const failure = { driverError: { code: '23505', constraint: 'UQ_users_email' } };
    repo.save.mockRejectedValue(failure);
    await expect(service.create({ email })).rejects.toBe(failure);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
