import { Repository } from 'typeorm';
import { WithdrawalService } from './withdrawal.service';
import { Withdrawal } from './withdrawal.entity';
import { BalanceService } from '../balance/balance.service';
import { OnboardingService } from '../onboarding/onboarding.service';

describe('WithdrawalService validation', () => {
  const transaction = jest.fn();
  const assertEligible = jest.fn().mockRejectedValue(new Error('Not enrolled'));
  const service = new WithdrawalService(
    { manager: { transaction } } as unknown as Repository<Withdrawal>,
    {} as BalanceService,
    { assertEligible } as unknown as OnboardingService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects £9.99 before reserving money', async () => {
    await expect(service.requestWithdrawal(7, '9.99', 'irrelevant')).rejects.toThrow('Minimum');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects missing idempotency key', async () => {
    await expect(service.requestWithdrawal(7, '10.00', undefined)).rejects.toThrow('requestId');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an unenrolled customer before reserving money', async () => {
    await expect(service.requestWithdrawal(7, '10.00', '11111111-1111-4111-8111-111111111111'))
      .rejects.toThrow('Not enrolled');
    expect(assertEligible).toHaveBeenCalledWith(7);
    expect(transaction).not.toHaveBeenCalled();
  });
});
