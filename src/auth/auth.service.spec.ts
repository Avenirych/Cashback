import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OnboardingService } from '../onboarding/onboarding.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService minimal DTO', () => {
  const user = {
    id: 7,
    email: 'alice@example.com',
    name: 'Alice',
    avatar_url: null,
    balance: 0,
    created_at: new Date(),
    password: 'hash',
    accountNumber: '00123456',
    recipient: { ciphertext: 'private' },
    bonusEligible: true,
    unexpected: 'private',
  };
  let service: AuthService;
  let users: { getById: jest.Mock; getByEmail: jest.Mock; create: jest.Mock };
  const onboarding = { isEligible: jest.fn().mockResolvedValue(false) };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  beforeEach(() => {
    users = {
      getById: jest.fn().mockResolvedValue(user),
      getByEmail: jest.fn(),
      create: jest.fn().mockResolvedValue(user),
    };
    service = new AuthService(
      users as unknown as UsersService,
      jwt as unknown as JwtService,
      onboarding as unknown as OnboardingService,
    );
    jest.clearAllMocks();
  });
  const expected = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: null,
    balance: 0,
    created_at: user.created_at,
    bonusEligible: false,
  };

  it('profiles only allowlisted fields with eligibility fetched server-side', async () => {
    expect(await service.profile({ id: 7 })).toEqual(expected);
    expect(onboarding.isEligible).toHaveBeenCalledWith(7);
  });
  it('registers without exposing persistence fields or PII in JWTs', async () => {
    const result = await service.register(
      'ALICE@example.com',
      'password',
      'Alice',
    );
    expect(result).toEqual({ access_token: 'token', user: expected });
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 7 });
    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email }),
    );
  });
  it('login returns the same minimal DTO', async () => {
    users.getByEmail.mockResolvedValue({
      ...user,
      password: await bcrypt.hash('password', 4),
    });
    expect(await service.login('alice@example.com', 'password')).toEqual({
      access_token: 'token',
      user: expected,
    });
  });
  it('does not concatenate database error details into registration errors', async () => {
    users.create.mockRejectedValue(new Error('private database credentials'));
    await expect(
      service.register('alice@example.com', 'password', 'Alice'),
    ).rejects.toThrow('Registration failed');
    try {
      await service.register('alice@example.com', 'password', 'Alice');
    } catch (error) {
      expect(String(error)).not.toContain('private');
    }
  });
});
