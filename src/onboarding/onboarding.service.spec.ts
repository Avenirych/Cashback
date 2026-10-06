import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import {
  OnboardingService,
  NOTICE_VERSION,
  TERMS_VERSION,
} from './onboarding.service';
import { ProgrammeMembership } from './programme-membership.entity';
import { Recipient } from './recipient.entity';
import { RecipientEncryptionService } from './recipient-encryption.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let persisted: Map<unknown, any>;
  let failMembership: boolean;
  let users: { getById: jest.Mock };
  let accountLock: jest.Mock;
  let persistedRow: jest.Mock;
  let encryptionKey: string | undefined;
  const valid = {
    programmeOptIn: true,
    privacyAcknowledged: true,
    accuracyConfirmed: true,
    accountHolderName: 'Alice Example',
    sortCode: '00-12 34',
    accountNumber: '00123456',
  };
  const encryption = new RecipientEncryptionService({
    get: () => encryptionKey,
  } as unknown as ConfigService);

  beforeEach(() => {
    persisted = new Map();
    failMembership = false;
    encryptionKey = Buffer.alloc(32, 4).toString('base64');
    accountLock = jest.fn().mockResolvedValue({ id: 7 });
    persistedRow = jest.fn();
    users = {
      getById: jest
        .fn()
        .mockResolvedValue({ id: 7, email: 'authenticated@example.com' }),
    };
    const repo = (entity: unknown) => ({
      findOne: jest.fn(async ({ where }: any) =>
        persisted.get(entity)?.userId === where.userId
          ? persisted.get(entity)
          : null,
      ),
      existsBy: jest.fn(
        async ({ userId }: any) => persisted.get(entity)?.userId === userId,
      ),
    });
    const source = {
      transaction: jest.fn(async (callback) => {
        const staged = new Map(persisted);
        const result = await callback({
          getRepository: (entity: unknown) => ({
            findOne: async (options: any) =>
              entity === User
                ? accountLock(options)
                : staged.get(entity)?.userId === options.where.userId
                  ? staged.get(entity)
                  : null,
            save: async (row: any) => {
              if (entity === ProgrammeMembership && failMembership)
                throw new Error('database unavailable');
              staged.set(entity, row);
              persistedRow(entity, row);
              return row;
            },
          }),
        });
        persisted = staged;
        return result;
      }),
    };
    service = new OnboardingService(
      repo(ProgrammeMembership) as unknown as Repository<ProgrammeMembership>,
      repo(Recipient) as unknown as Repository<Recipient>,
      source as unknown as DataSource,
      encryption,
      users as unknown as UsersService,
    );
  });

  it('persists encrypted details and separate confirmations atomically, preserving leading zeros', async () => {
    expect(await service.isEligible(7)).toBe(false);
    const result = await service.save(7, {
      ...valid,
      email: 'attacker@example.com',
      userId: 99,
      noticeVersion: 'client',
    });
    const recipient = persisted.get(Recipient);
    expect(encryption.decrypt(7, recipient)).toEqual({
      accountHolderName: 'Alice Example',
      sortCode: '001234',
      accountNumber: '00123456',
    });
    expect(JSON.stringify(recipient)).not.toMatch(/Alice|00123456|attacker/);
    expect(persisted.get(ProgrammeMembership)).toMatchObject({
      userId: 7,
      programmeOptIn: true,
      privacyAcknowledged: true,
      accuracyConfirmed: true,
      noticeVersion: NOTICE_VERSION,
      termsVersion: TERMS_VERSION,
      completedAt: expect.any(Date),
      optedInAt: expect.any(Date),
      privacyAcknowledgedAt: expect.any(Date),
      accuracyConfirmedAt: expect.any(Date),
    });
    expect(users.getById).toHaveBeenCalledWith(7);
    expect(accountLock).toHaveBeenCalledWith({
      where: { id: 7 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(accountLock.mock.invocationCallOrder[0]).toBeLessThan(
      persistedRow.mock.invocationCallOrder[0],
    );
    expect(await service.isEligible(7)).toBe(true);
    expect(await service.isEligible(99)).toBe(false);
    expect(await service.get(7)).toEqual(result);
    expect(result.recipient).toEqual({
      accountHolderNameMasked: '********',
      sortCodeMasked: '**-**-**',
      accountNumberMasked: '****3456',
    });
    expect(JSON.stringify(result)).not.toMatch(/Alice|00123456|001234|email/);
  });

  it('never replaces a completed recipient or consent timestamps on repeat enrollment', async () => {
    const first = await service.save(7, valid);
    const recipient = persisted.get(Recipient);
    const membership = persisted.get(ProgrammeMembership);
    expect(await service.getRecipientId(7)).toBe(7);
    const repeated = await service.save(7, {
      ...valid,
      accountHolderName: 'Different Account',
      sortCode: '999999',
      accountNumber: '99999999',
    });
    expect(repeated).toEqual(first);
    expect(persisted.get(Recipient)).toBe(recipient);
    expect(persisted.get(ProgrammeMembership)).toBe(membership);
    expect(persistedRow).toHaveBeenCalledTimes(2);
    expect(accountLock).toHaveBeenCalledTimes(2);
    expect(await service.getRecipientId(7)).toBe(7);
  });

  it('rejects disappearance of the account while acquiring the enrollment lock', async () => {
    accountLock.mockResolvedValueOnce(null);
    await expect(service.save(7, valid)).rejects.toThrow('Account unavailable');
    expect(persistedRow).not.toHaveBeenCalled();
    expect(persisted.size).toBe(0);
  });

  it('fails closed without replacing completed recipients when encrypted storage is corrupted', async () => {
    await service.save(7, valid);
    const recipient = persisted.get(Recipient);
    recipient.authTag = Buffer.alloc(16).toString('base64');
    await expect(service.getRecipientId(7)).rejects.toThrow(
      'Recipient storage unavailable',
    );
    await expect(service.save(7, valid)).rejects.toThrow(
      'Recipient storage unavailable',
    );
    expect(persistedRow).toHaveBeenCalledTimes(2);
    persisted.delete(Recipient);
    await expect(service.save(7, valid)).rejects.toThrow(
      'Recipient storage unavailable',
    );
    await expect(service.getRecipientId(7)).rejects.toThrow(
      'Complete programme onboarding first',
    );
    expect(persistedRow).toHaveBeenCalledTimes(2);
  });

  it('does not expose payout recipient references when the encryption key is missing or invalid', async () => {
    await service.save(7, valid);
    expect(await service.getRecipientId(7)).toBe(7);
    encryptionKey = undefined;
    await expect(service.getRecipientId(7)).rejects.toThrow(
      'Recipient storage unavailable',
    );
    encryptionKey = 'invalid-key';
    await expect(service.getRecipientId(7)).rejects.toThrow(
      'Recipient storage unavailable',
    );
    expect(persistedRow).toHaveBeenCalledTimes(2);
  });
  it.each([
    { programmeOptIn: false },
    { privacyAcknowledged: 'true' },
    { accuracyConfirmed: false },
    { accountHolderName: '' },
    { accountHolderName: 'A\nB' },
    { sortCode: '12345' },
    { sortCode: '00/12/34' },
    { sortCode: 123456 },
    { accountNumber: '1234567' },
    { accountNumber: '12 345678' },
    { accountNumber: 12345678 },
  ])('rejects invalid input before persistence: %p', async (overrides) => {
    await expect(service.save(7, { ...valid, ...overrides })).rejects.toThrow();
    expect(persisted.size).toBe(0);
    expect(await service.isEligible(7)).toBe(false);
  });

  it('does not grant eligibility after a failed atomic save', async () => {
    failMembership = true;
    await expect(service.save(7, valid)).rejects.toThrow(
      'database unavailable',
    );
    expect(persisted.size).toBe(0);
    await expect(service.assertEligible(7)).rejects.toThrow(
      'Complete programme onboarding first',
    );
  });

  it('requires current versions, all confirmations, and a persisted recipient', async () => {
    await service.save(7, valid);
    persisted.get(ProgrammeMembership).termsVersion = 'old';
    expect(await service.isEligible(7)).toBe(false);
    persisted.get(ProgrammeMembership).termsVersion = TERMS_VERSION;
    persisted.get(ProgrammeMembership).accuracyConfirmed = false;
    expect(await service.isEligible(7)).toBe(false);
    persisted.get(ProgrammeMembership).accuracyConfirmed = true;
    persisted.delete(Recipient);
    expect(await service.isEligible(7)).toBe(false);
  });

  it('rejects missing accounts and fails closed before storing without a key', async () => {
    users.getById.mockResolvedValueOnce(null);
    await expect(service.save(7, valid)).rejects.toThrow('Account unavailable');
    jest.spyOn(encryption, 'encrypt').mockImplementationOnce(() => {
      throw new Error('missing key');
    });
    await expect(service.save(7, valid)).rejects.toThrow('missing key');
    expect(persisted.size).toBe(0);
  });
});
