import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name: string) {
    if (!email || !password || !name) {
      throw new BadRequestException('Email, password, and name are required');
    }

    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    try {
      const existing = await this.usersService.getByEmail(email);
      if (existing) {
        throw new BadRequestException('User with this email already exists');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await this.usersService.create({
        email,
        name,
        password: passwordHash,
        avatar_url: null,
        balance: 0,
      });

      const payload = { sub: user.id, email: user.email, name: user.name };
      const token = this.jwtService.sign(payload);

      return {
        access_token: token,
        user: this.safeUser(user),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Register error:', error);
      throw new BadRequestException('Registration failed: ' + (error as any).message);
    }
  }

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    try {
      const user = await this.usersService.getByEmail(email);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const valid = await bcrypt.compare(password, user.password || '');
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = { sub: user.id, email: user.email, name: user.name };
      const token = this.jwtService.sign(payload);

      return {
        access_token: token,
        user: this.safeUser(user),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Login error:', error);
      throw new BadRequestException('Login failed');
    }
  }

  async profile(user: { id: number; email: string; name?: string }) {
    const dbUser = await this.usersService.getById(user.id);
    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    return this.safeUser(dbUser);
  }

  private safeUser(user: any) {
    const { password, ...safeUser } = user;
    return safeUser;
  }
}
