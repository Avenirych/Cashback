import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  getAll() {
    return this.userRepo.find();
  }

  getById(id: number) {
    return this.userRepo.findOne({ where: { id } });
  }

  getByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  create(data: Partial<User>) {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async update(id: number, data: Partial<User>) {
    await this.userRepo.update(id, data);
    return this.userRepo.findOne({ where: { id } });
  }

  async updateBalance(userId: number, newBalance: number) {
    const user = await this.getById(userId);
    if (!user) throw new Error('User not found');

    user.balance = Number(newBalance);
    return this.userRepo.save(user);
  }
}
