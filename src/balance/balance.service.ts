import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BalanceOperation } from './balance.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceOperation)
    private readonly balanceRepo: Repository<BalanceOperation>,
    private readonly usersService: UsersService,
  ) {}

  async addOperation(userId: number, type: string, amount: number, description?: string) {
    const user = await this.usersService.getById(userId);
    if (!user) throw new Error('User not found');

    const op = this.balanceRepo.create({
      user,
      type,
      amount,
      description,
    });

    await this.balanceRepo.save(op);

    // Обновляем баланс пользователя
    if (type === 'cashback' || type === 'bonus' || type === 'unfreeze') {
      user.balance = Number(user.balance) + Number(amount);
    }

    if (type === 'withdraw' || type === 'freeze') {
      user.balance = Number(user.balance) - Number(amount);
    }

    await this.usersService.updateBalance(userId, user.balance);

    return op;
  }

  getUserBalanceHistory(userId: number) {
    return this.balanceRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }
}
