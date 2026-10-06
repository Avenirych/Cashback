import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { BalanceOperation } from './balance.entity';
import { User } from '../users/user.entity';
import { fromPence, toPence } from './money';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceOperation)
    private readonly balanceRepo: Repository<BalanceOperation>,
  ) {}

  async availablePence(manager: EntityManager, userId: number): Promise<number> {
    const operations = await manager.find(BalanceOperation, {
      where: { user: { id: userId }, status: 'confirmed', currency: 'GBP' },
    });
    let available = 0;
    for (const operation of operations) {
      const amount = toPence(operation.amount);
      if (['cashback', 'bonus', 'unfreeze'].includes(operation.type)) available += amount;
      if (['withdraw', 'freeze'].includes(operation.type)) available -= amount;
    }
    return available;
  }

  async addOperation(
    userId: number,
    type: string,
    amount: number | string,
    description?: string,
    status: 'pending' | 'confirmed' | 'reversed' = 'pending',
  ) {
    if (!['cashback', 'bonus', 'withdraw', 'freeze', 'unfreeze'].includes(type)) {
      throw new BadRequestException('Invalid balance operation');
    }
    const pence = toPence(amount);
    if (pence === 0) throw new BadRequestException('Amount must be positive');
    return this.balanceRepo.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId }, lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new BadRequestException('User not found');
      const available = await this.availablePence(manager, userId);
      if (status === 'confirmed' && ['withdraw', 'freeze'].includes(type) && pence > available) {
        throw new BadRequestException('Insufficient confirmed balance');
      }
      const operation = await manager.save(BalanceOperation, manager.create(BalanceOperation, {
        user: { id: userId }, type, amount: fromPence(pence), description,
        status, currency: 'GBP',
      }));
      const updated = await this.availablePence(manager, userId);
      await manager.update(User, userId, { balance: fromPence(Math.max(0, updated)) });
      return operation;
    });
  }

  getUserBalanceHistory(userId: number) {
    return this.balanceRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }
}
