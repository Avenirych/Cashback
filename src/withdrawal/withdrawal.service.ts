import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Withdrawal } from './withdrawal.entity';
import { User } from '../users/user.entity';
import { BalanceOperation } from '../balance/balance.entity';
import { BalanceService } from '../balance/balance.service';
import { fromPence, toPence } from '../balance/money';
import { OnboardingService } from '../onboarding/onboarding.service';

@Injectable()
export class WithdrawalService {
  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
    private readonly balanceService: BalanceService,
    private readonly onboardingService: OnboardingService,
  ) {}

  async requestWithdrawal(userId: number, amount: unknown, requestId: unknown) {
    const pence = toPence(amount);
    if (pence < 1000) throw new BadRequestException('Minimum withdrawal is £10 in confirmed available rewards');
    if (typeof requestId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new BadRequestException('A UUID v4 requestId is required');
    }
    await this.onboardingService.assertEligible(userId);
    const recipientId = await this.onboardingService.getRecipientId(userId);
    return this.withdrawalRepo.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId }, lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new BadRequestException('User not found');
      const existing = await manager.findOne(Withdrawal, {
        where: { user: { id: userId }, requestId },
      });
      if (existing) {
        if (toPence(existing.amount) !== pence) {
          throw new BadRequestException('Request ID already used with a different amount');
        }
        return this.safeWithdrawal(existing);
      }
      const available = await this.balanceService.availablePence(manager, userId);
      if (available < pence) throw new BadRequestException('Insufficient confirmed available rewards');
      await manager.save(BalanceOperation, manager.create(BalanceOperation, {
        user: { id: userId }, type: 'withdraw', amount: fromPence(pence),
        status: 'confirmed', currency: 'GBP', description: 'Manual withdrawal reservation',
      }));
      await manager.update(User, userId, { balance: fromPence(available - pence) });
      const withdrawal = await manager.save(Withdrawal, manager.create(Withdrawal, {
        user: { id: userId }, amount: fromPence(pence), requestId, recipientId,
        currency: 'GBP', method: 'uk-bank-manual', status: 'pending',
      }));
      return this.safeWithdrawal(withdrawal);
    });
  }

  async getUserWithdrawals(userId: number) {
    const withdrawals = await this.withdrawalRepo.find({
      where: { user: { id: userId } }, order: { created_at: 'DESC' },
    });
    return withdrawals.map((withdrawal) => this.safeWithdrawal(withdrawal));
  }

  private safeWithdrawal(withdrawal: Withdrawal) {
    return {
      id: withdrawal.id, amount: withdrawal.amount, currency: withdrawal.currency,
      status: withdrawal.status, method: withdrawal.method,
      requestId: withdrawal.requestId, created_at: withdrawal.created_at,
    };
  }
}
