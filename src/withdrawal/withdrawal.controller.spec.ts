import { GUARDS_METADATA } from '@nestjs/common/constants';
import { WithdrawalController } from './withdrawal.controller';
import { WithdrawalService } from './withdrawal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BonusEligibilityGuard } from '../onboarding/bonus-eligibility.guard';

describe('WithdrawalController', () => {
  it('uses JWT identity for withdrawal and history', async () => {
    const requestWithdrawal = jest.fn();
    const getUserWithdrawals = jest.fn();
    const controller = new WithdrawalController({
      requestWithdrawal, getUserWithdrawals,
    } as unknown as WithdrawalService);
    await controller.request({ user: { id: 7 } }, '10.00', 'request-key');
    await controller.getUserWithdrawals({ user: { id: 7 } });
    expect(requestWithdrawal).toHaveBeenCalledWith(7, '10.00', 'request-key');
    expect(getUserWithdrawals).toHaveBeenCalledWith(7);
  });

  it('requires authentication and enrollment and exposes no public approval/rejection', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, WithdrawalController))
      .toEqual([JwtAuthGuard, BonusEligibilityGuard]);
    expect(WithdrawalController.prototype).not.toHaveProperty('approve');
    expect(WithdrawalController.prototype).not.toHaveProperty('reject');
  });
});
