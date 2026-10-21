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

  async getById(id: number, includePrivate = false): Promise<User | null> {
    if (includePrivate) return this.userRepo.createQueryBuilder('u').addSelect(['u.firstName','u.lastName','u.phone_e164']).where('u.id = :id', {id}).getOne();
    return this.userRepo.findOne({ where: { id } });
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.userRepo.createQueryBuilder('u').addSelect(['u.firstName','u.lastName','u.phone_e164']).where('u.email = :email', {email}).getOne();
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

  /** One conditional UPDATE consumes a token even under concurrent requests. */
  async consumeEmailToken(token: string): Promise<User | null> {
    const result = await this.userRepo.createQueryBuilder()
      .update(User)
      .set({ email_verified: true, email_token: null, email_token_expires_at: null })
      .where('email_token = :token AND email_verified = false AND email_token_expires_at > CURRENT_TIMESTAMP', { token })
      .returning('id').execute();
    const id = result.raw[0]?.id;
    return id ? this.getById(id, true) : null;
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