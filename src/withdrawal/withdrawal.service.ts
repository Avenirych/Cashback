import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Withdrawal } from './withdrawal.entity';
import { UsersService } from '../users/users.service';
import { BalanceService } from '../balance/balance.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WithdrawalService {
  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
    private readonly usersService: UsersService,
    private readonly balanceService: BalanceService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async requestWithdrawal(userId: number, amount: number, method: string, details: string) {
    const user = await this.usersService.getById(userId);
    if (!user) throw new BadRequestException('User not found');

    if (Number(user.balance) < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    await this.balanceService.addOperation(
      userId,
      'withdraw',
      amount,
      `Withdrawal request via ${method}`,
    );

    const withdrawal = this.withdrawalRepo.create({
      user,
      amount,
      method,
      details,
      status: 'pending',
    });

    const saved = await this.withdrawalRepo.save(withdrawal);

    await this.notificationsService.send(
      userId,
      'withdrawal',
      'Withdrawal request created',
      `Your withdrawal request for £${amount} is pending`,
    );

    return saved;
  }

  async approve(id: number) {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id } });
    if (!withdrawal) throw new BadRequestException('Withdrawal not found');

    withdrawal.status = 'approved';
    return this.withdrawalRepo.save(withdrawal);
  }

  async reject(id: number) {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id } });
    if (!withdrawal) throw new BadRequestException('Withdrawal not found');

    await this.balanceService.addOperation(
      withdrawal.user.id,
      'unfreeze',
      withdrawal.amount,
      'Withdrawal rejected',
    );

    withdrawal.status = 'rejected';
    return this.withdrawalRepo.save(withdrawal);
  }

  getUserWithdrawals(userId: number) {
    return this.withdrawalRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }
}
