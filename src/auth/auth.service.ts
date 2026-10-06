import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { OnboardingService } from '../onboarding/onboarding.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly onboarding: OnboardingService,
  ) {}

  private normalizeEmail(email: string) {
    return (email || '').toLowerCase().trim();
  }

  async register(email: string, password: string, name: string) {
    if (
      typeof email !== 'string' ||
      !email ||
      typeof password !== 'string' ||
      !password ||
      typeof name !== 'string' ||
      !name
    ) {
      throw new BadRequestException('Email, password, and name are required');
    }

    if (password.length < 3) {
      throw new BadRequestException('Password must be at least 3 characters');
    }

    if (name.trim().length < 2) {
      throw new BadRequestException('Name must be at least 2 characters');
    }

    const normalizedEmail = this.normalizeEmail(email);

    const existing = await this.usersService.getByEmail(normalizedEmail);
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);

      const userData = {
        email: normalizedEmail,
        name: name.trim(),
        password: passwordHash,
        avatar_url: null,
        balance: 0,
      };

      const user = await this.usersService.create(userData);

      const payload = { sub: user.id };
      const token = this.jwtService.sign(payload);

      return {
        access_token: token,
        user: await this.safeUser(user),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Registration failed');
    }
  }

  async login(email: string, password: string) {
    if (
      typeof email !== 'string' ||
      !email ||
      typeof password !== 'string' ||
      !password
    ) {
      throw new BadRequestException('Email and password are required');
    }

    const normalizedEmail = this.normalizeEmail(email);

    const user = await this.usersService.getByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password || '');
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: await this.safeUser(user),
    };
  }

  async profile(user: { id: number }) {
    const dbUser = await this.usersService.getById(user.id);
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    return this.safeUser(dbUser);
  }

  private async safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      balance: user.balance,
      created_at: user.created_at,
      bonusEligible: await this.onboarding.isEligible(user.id),
    };
  }
}
