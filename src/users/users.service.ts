import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  async getById(id: number): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
    });
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
    });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async update(
    id: number,
    data: Partial<User>,
  ): Promise<User> {
    await this.userRepo.update(id, data);

    const user = await this.getById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateBalance(
    userId: number,
    newBalance: number,
  ): Promise<User> {
    const user = await this.getById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.balance = Number(newBalance);

    return this.userRepo.save(user);
  }

  async findByEmailToken(
    token: string,
  ): Promise<User | null> {
    if (typeof token !== 'string' || !token.trim()) {
      return null;
    }

    return this.userRepo.findOne({
      where: { email_token: token },
    });
  }
}