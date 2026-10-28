import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { normalizePhone } from '../users/phone-normalization';
import { User } from '../users/user.entity';
import {serverAccountUuid} from '../users/server-account-identity';
import { MailService } from '../mail/mail.service';

const EMAIL_REGEX = /^[a-zA-Z0-9._+\-]{1,64}@[a-zA-Z0-9.\-]{1,255}\.[a-zA-Z]{2,}$/;

function isValidEmailFormat(email: string): boolean {
  if (email.length > 320 || email.includes('..')) return false;
  if (!EMAIL_REGEX.test(email)) return false;
  const [local, domain] = email.split('@');
  return !(
    local.startsWith('.') ||
    local.endsWith('.') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.startsWith('-') ||
    domain.endsWith('-')
  );
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly resendCooldown = new Map<string, number>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  private get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private generateEmailToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getEmailTokenExpiration(): Date {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  private createAccessToken(user: User): string {
    const uuid = serverAccountUuid(user);
    return this.jwtService.sign({
      sub: user.id,
      ...(uuid ? {account_uuid: uuid} : {}),
      email: user.email,
      name: user.name,
    });
  }

  private safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      phone_e164: user.phone_e164 ?? null,
      avatar_url: user.avatar_url,
      balance: user.balance,
      email_verified: user.email_verified,
      created_at: user.created_at,
    };
  }

  async register(email: string, password: string, name: string, details?: { firstName?: unknown; lastName?: unknown; phone_e164?: unknown }, requestOrigin?: string) {
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof name !== 'string' ||
      !email.trim() ||
      !password ||
      !name.trim()
    ) {
      throw new BadRequestException('Email, password, and name are required');
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) throw new BadRequestException('Password must contain at least 8 characters, an uppercase letter, a lowercase letter, a digit, and a special character');
    if (typeof details?.firstName !== 'string' || typeof details.lastName !== 'string' || details.firstName.trim().length < 2 || details.lastName.trim().length < 2 || details.firstName.trim().length > 100 || details.lastName.trim().length > 100) throw new BadRequestException('First and last names are required (2–100 characters each)');
    const firstName = details.firstName.trim(), lastName = details.lastName.trim();
    const phone = normalizePhone(details.phone_e164);

    if (name.trim().length < 2) {
      throw new BadRequestException('Name must be at least 2 characters');
    }

    const normalizedEmail = this.normalizeEmail(email);

    if (!isValidEmailFormat(normalizedEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    const existing = await this.usersService.getByEmail(normalizedEmail);
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const emailToken = this.generateEmailToken();

    let user: User;
    try { user = await this.usersService.create({
      email: normalizedEmail,
      name: `${firstName} ${lastName}`,
      firstName, lastName, phone_e164: phone,
      password: passwordHash,
      avatar_url: null,
      balance: 0,
      email_verified: false,
      email_token: emailToken,
      email_token_expires_at: this.getEmailTokenExpiration(),
    }); } catch { throw new ServiceUnavailableException('Registration temporarily unavailable'); }

    let verificationEmailSent = false;
    let previewUrl: string | null = null;

    try {
      previewUrl = await this.mailService.sendVerificationEmail(
        user.email,
        emailToken,
        user.name,
        ...(requestOrigin ? [requestOrigin] : []),
      );
      verificationEmailSent = true;
    } catch (error) {
      this.logger.error(
        `Verification email delivery failed for user ID ${user.id}`,
      );
    }

    return {
      access_token: this.createAccessToken(user),
      user: this.safeUser(user),
      verification_email_sent: verificationEmailSent,

      message: verificationEmailSent
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Account created, but the verification email could not be sent. Please request another email.',
    };
  }

  async verifyEmail(token: string) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    let updatedUser: User | null;
    try { updatedUser = await this.usersService.consumeEmailToken(token); }
    catch { throw new ServiceUnavailableException('Verification temporarily unavailable. Check account status before retrying.'); }
    if (!updatedUser) throw new BadRequestException('Invalid or expired verification token');

    return {
      access_token: this.createAccessToken(updatedUser),
      user: this.safeUser(updatedUser),
      message: 'Email verified successfully!',
    };
  }

  async resendVerificationEmail(email: string, requestOrigin?: string) {
    if (typeof email !== 'string' || !email.trim() || email.length > 320) {
      throw new BadRequestException('Email is required');
    }

    const normalizedEmail = this.normalizeEmail(email);
    const now = Date.now();
    for (const [key, expiry] of this.resendCooldown) if (expiry <= now) this.resendCooldown.delete(key);
    const limited = this.resendCooldown.has(normalizedEmail) || this.resendCooldown.size >= 10000;
    if (!limited) this.resendCooldown.set(normalizedEmail, now + 60000);

    const response: { message: string; preview_url?: string | null } = {
      message:
        'If this account exists and requires verification, a verification email has been sent.',
    };

    if (limited) return response;
    const user = await this.usersService.getByEmail(normalizedEmail);
    if (!user || user.email_verified) {
      return response;
    }

    const emailToken = this.generateEmailToken();

    try { await this.usersService.update(user.id, {
      email_token: emailToken,
      email_token_expires_at: this.getEmailTokenExpiration(),
    }); } catch { this.logger.error('Verification resend update failed'); return response; }

    try {
      const previewUrl = await this.mailService.sendResendVerificationEmail(
        user.email,
        emailToken,
        user.name,
        ...(requestOrigin ? [requestOrigin] : []),
      );

    } catch (error) {
      this.logger.error(
        `Verification email resend failed for user ID ${user.id}`,
      );
    }

    return response;
  }

  async login(email: string, password: string) {
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      throw new BadRequestException('Email and password are required');
    }

    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.usersService.getByEmail(normalizedEmail);

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      access_token: this.createAccessToken(user),
      user: this.safeUser(user),
    };
  }

  async profile(user: { id: number; email: string; name?: string; account_uuid?: string }) {
    const dbUser = await this.usersService.getById(user.id, true);

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    const uuid = serverAccountUuid(dbUser);
    if (user.account_uuid !== undefined ? user.account_uuid !== uuid : !!uuid) throw new UnauthorizedException('Account identity changed');
    return this.safeUser(dbUser);
  }
}
