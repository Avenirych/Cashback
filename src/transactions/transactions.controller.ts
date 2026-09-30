import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from '../users/user.entity';
import { Click } from '../clicks/click.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Click)
    private readonly clickRepo: Repository<Click>,
  ) {}

  async createTransaction(userId: number, clickId: number, amount: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const click = await this.clickRepo.findOne({ where: { id: clickId } });

    const tx = this.txRepo.create({
      user,
      ...(click && { click }),
      amount,
    });

    return this.txRepo.save(tx);
  }

  async getUserTransactions(userId: number) {
    return this.txRepo.find({
      where: { user: { id: userId } },
      relations: { user: true, click: true },
      order: { createdAt: 'DESC' },
    });
  }
}
