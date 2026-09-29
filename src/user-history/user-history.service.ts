import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserHistory } from './user-history.entity';

@Injectable()
export class UserHistoryService {
  constructor(
    @InjectRepository(UserHistory)
    private readonly historyRepo: Repository<UserHistory>,
  ) {}

  async addHistory(
    userId: number,
    type: string,
    amount?: number,
    description?: string,
  ) {
    const entry = this.historyRepo.create({
      user: { id: userId } as any,
      type,
      amount,
      description,
    });

    return this.historyRepo.save(entry);
  }

  async getUserHistory(userId: number) {
    return this.historyRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
    });
  }
}
