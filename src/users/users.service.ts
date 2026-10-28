import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from './user.entity';
import { rememberServerIdentity } from './server-account-identity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Capture UUID from the same row; absent pre-migration JSON key is NULL. */
  private async identityRow(query: SelectQueryBuilder<User>): Promise<User | null> {
    const { entities, raw } = await query.addSelect("to_jsonb(u)->>'account_uuid'", 'auth_account_uuid').getRawAndEntities();
    if (!entities.length && !raw.length) return null;
    if (entities.length !== 1 || raw.length !== 1 || raw[0].u_id !== entities[0].id) throw new ServiceUnavailableException('Account identity unavailable');
    return rememberServerIdentity(entities[0], raw[0].auth_account_uuid);
  }

  /** Map only existing entity columns; UUID stays in private server evidence. */
  private returnedUser(raw: any): User | null {
    if (!raw) return null;
    const user = this.userRepo.create();
    for (const column of this.userRepo.metadata.columns) {
      if (Object.prototype.hasOwnProperty.call(raw, column.databaseName)) column.setEntityValue(user, this.userRepo.manager.connection.driver.prepareHydratedValue(raw[column.databaseName], column));
    }
    return rememberServerIdentity(user, raw.account_uuid);
  }

  async getAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  async getById(id: number, includePrivate = false): Promise<User | null> {
    const query = this.userRepo.createQueryBuilder('u').where('u.id = :id', {id});
    if (includePrivate) query.addSelect(['u.firstName','u.lastName','u.phone_e164']);
    return this.identityRow(query);
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.identityRow(this.userRepo.createQueryBuilder('u').addSelect(['u.firstName','u.lastName','u.phone_e164']).where('u.email = :email', {email}));
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    const result = await this.userRepo.createQueryBuilder().insert().into(User).values(user).returning('*').execute();
    if (result.raw.length !== 1) throw new ServiceUnavailableException('Account creation unavailable');
    return this.returnedUser(result.raw[0])!;
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
      .returning('*').execute();
    if (result.raw.length > 1) throw new ServiceUnavailableException('Account identity unavailable');
    return this.returnedUser(result.raw[0]);
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
