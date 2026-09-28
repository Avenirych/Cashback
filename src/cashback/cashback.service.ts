import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Transaction } from './transaction.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class CashbackService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly usersService: UsersService,
  ) {}

  async addCashback(userId: number, amount: number, description: string) {
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const tx = this.txRepo.create({
      amount,
      description,
      user,
    });

    await this.txRepo.save(tx);

    user.balance += amount;
    await this.usersService.update(user);

    return {
      message: 'Cashback added',
      balance: user.balance,
      transaction: tx,
    };
  }

  async getHistory(userId: number) {
    return this.txRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }
}
