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
    console.log('🔐 Register attempt:', { email, name });

    if (!email || !password || !name) {
      throw new BadRequestException('Email, password, and name are required');
    }

    if (password.length < 3) {
      throw new BadRequestException('Password must be at least 3 characters');
    }

    if (name.trim().length < 2) {
      throw new BadRequestException('Name must be at least 2 characters');
    }

    const existing = await this.usersService.getByEmail(email);
    if (existing) {
      console.log('❌ User already exists:', email);
      throw new BadRequestException('User with this email already exists');
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      console.log('🔒 Password hashed');

      const userData = {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        password: passwordHash,
        avatar_url: null,
        balance: 0,
      };

      console.log('💾 Creating user with data:', { email: userData.email, name: userData.name });
      const user = await this.usersService.create(userData);
      console.log('✅ User created:', { id: user.id, email: user.email });

      const payload = { sub: user.id, email: user.email, name: user.name };
      const token = this.jwtService.sign(payload);
      console.log('🎫 Token generated for user:', user.id);

      return {
        access_token: token,
        user: this.safeUser(user),
      };
    } catch (error) {
      console.error('❌ Register error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Registration failed: ' + (error as any).message);
    }
  }

  async login(email: string, password: string) {
    console.log('🔐 Login attempt:', email);

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.usersService.getByEmail(email);
    if (!user) {
      console.log('❌ User not found:', email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password || '');
    if (!valid) {
      console.log('❌ Invalid password for user:', email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, name: user.name };
    const token = this.jwtService.sign(payload);
    console.log('✅ Login successful for:', email);

    return {
      access_token: token,
      user: this.safeUser(user),
    };
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
