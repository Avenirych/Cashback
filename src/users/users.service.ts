import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { normalizeEmail } from './email-normalization';
import { MarketingPreferences } from '../marketing-preferences/marketing-preferences.entity';
import { normalizePhone } from './phone-normalization';
import type { UpdateOwnUserDto } from './users.dto';

const ownProfileSelect = {
  id: true, email: true, name: true, avatar_url: true, balance: true,
  email_verified: true, created_at: true,
  phone_e164: true, phone_verified: true, phone_verified_at: true,
} as const;

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
      where: { email: normalizeEmail(email) },
    });
  }

  /** Call only behind owner authorization; generic lookups exclude phone. */
  async getOwnProfile(id: number): Promise<User | null> {
    try {
      return await this.userRepo.findOne({ where: { id }, select: ownProfileSelect });
    } catch {
      throw new ServiceUnavailableException('Profile service unavailable');
    }
  }

  async updateOwnProfile(id: number, data: UpdateOwnUserDto): Promise<User> {
    const phone = data.phone_e164 === undefined ? undefined : normalizePhone(data.phone_e164);
    try {
      return await this.userRepo.manager.transaction('READ COMMITTED', async manager => {
        const users = manager.getRepository(User);
        const user = await users.findOne({
          where: { id }, select: ownProfileSelect, lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new NotFoundException('User not found');
        if (data.name !== undefined) user.name = data.name;
        if (phone !== undefined && phone !== user.phone_e164) {
          const repo = manager.getRepository(MarketingPreferences);
          const rows = await repo.find({ where: { userId: id }, order: { id: 'ASC' }, take: 2 });
          if (rows.length > 1) throw new ConflictException('Duplicate marketing preferences');
          const prefs = rows[0];
          if (prefs?.smsMarketing) {
            prefs.smsMarketing = false;
            prefs.smsMarketingRevokedAt = new Date();
            await repo.save(prefs);
          }
          user.phone_e164 = phone;
          user.phone_verified = false;
          user.phone_verified_at = null;
        }
        return users.save(user);
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Profile service unavailable');
    }
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create({
      ...data,
      ...(typeof data.email === 'string' ? { email: normalizeEmail(data.email) } : {}),
    });
    return this.userRepo.save(user);
  }

  async update(
    id: number,
    data: Partial<User>,
  ): Promise<User> {
    if (['phone_e164', 'phone_verified', 'phone_verified_at'].some(key => Object.hasOwn(data, key))) {
      throw new BadRequestException('Phone changes require the owner profile operation');
    }
    await this.userRepo.update(id, {
      ...data,
      ...(typeof data.email === 'string' ? { email: normalizeEmail(data.email) } : {}),
    });

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
