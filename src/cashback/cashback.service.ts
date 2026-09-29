import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Transaction } from './transaction.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class CashbackService {
  constructor(
    @InjectRepository(Transaction)
    private readonly cashbackRepo: Repository<Transaction>,
    private readonly usersService: UsersService,
  ) {}

  async addCashback(userId: number, amount: number) {
    const user = await this.usersService.getById(userId);
    if (!user) throw new BadRequestException('User not found');

    user.balance = Number(user.balance) + Number(amount);

    await this.usersService.updateBalance(user.id, user.balance);

    const cashback = this.cashbackRepo.create({
      user,
      amount,
    });

    return this.cashbackRepo.save(cashback);
  }
}
