import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  Logger,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { normalizeEmail } from '../users/email-normalization';
import { assertLocalDemoRecipient } from '../mail/local-demo-mailpit';
import { normalizePhone } from '../users/phone-normalization';
import { ownProfileDto } from '../users/users.dto';
import { RegistrationReadiness } from './registration-readiness';

const EMAIL_CONFLICT_MESSAGE = 'Registration with this email is unavailable';

function isEmailUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('driverError' in error)) return false;
  const driver = error.driverError;
  return !!driver && typeof driver === 'object' &&
    'code' in driver && driver.code === '23505' &&
    'constraint' in driver && driver.constraint === 'UQ_users_email';
}

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

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @Optional() private readonly registrationReadiness?: RegistrationReadiness,
  ) {}


  private normalizeEmail(email: string): string {
    return normalizeEmail(email);
  }

  private generateEmailToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getEmailTokenExpiration(): Date {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  private createAccessToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
  }

  private safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      balance: user.balance,
      email_verified: user.email_verified,
      created_at: user.created_at,
    };
  }

  async register(email: string, password: string, name: string, phone_e164: string) {
    await (this.registrationReadiness ?? new RegistrationReadiness()).assertReady();
    const normalizedPhone = normalizePhone(phone_e164);
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

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      throw new BadRequestException(
        'Password must contain at least 8 characters, an uppercase letter, a lowercase letter, a digit, and a special character',
      );
    }

    if (name.trim().length < 2) {
      throw new BadRequestException('Name must be at least 2 characters');
    }

    const normalizedEmail = this.normalizeEmail(email);

    if (!isValidEmailFormat(normalizedEmail)) {
      throw new BadRequestException('Invalid email format');
    }

    assertLocalDemoRecipient(normalizedEmail);

    const existing = await this.usersService.getByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException(EMAIL_CONFLICT_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const emailToken = this.generateEmailToken();

    let user: User;
    try {
      user = await this.usersService.create({
        email: normalizedEmail,
        name: name.trim(),
        phone_e164: normalizedPhone,
        phone_verified: false,
        phone_verified_at: null,
        password: passwordHash,
        avatar_url: null,
        balance: 0,
        email_verified: false,
        email_token: emailToken,
        email_token_expires_at: this.getEmailTokenExpiration(),
      });
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        throw new ConflictException(EMAIL_CONFLICT_MESSAGE);
      }
      // Repository errors may contain INSERT parameters, including the phone.
      throw new ServiceUnavailableException('Registration service unavailable');
    }

    let verificationEmailSent = false;


    try {
      await this.mailService.sendVerificationEmail(
        user.email,
        emailToken,
        user.name,
      );
      verificationEmailSent = true;
    } catch {
      this.logger.error('Verification email delivery failed');
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

    const user = await this.usersService.findByEmailToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const expiresAt = user.email_token_expires_at;

    if (
      !expiresAt ||
      !Number.isFinite(new Date(expiresAt).getTime()) ||
      new Date(expiresAt).getTime() <= Date.now()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const updatedUser = await this.usersService.update(user.id, {
      email_verified: true,
      email_token: null,
      email_token_expires_at: null,
    });

    return {
      access_token: this.createAccessToken(updatedUser),
      user: this.safeUser(updatedUser),
      message: 'Email verified successfully!',
    };
  }

  async resendVerificationEmail(email: string) {
    if (typeof email !== 'string' || !email.trim()) {
      throw new BadRequestException('Email is required');
    }

    const response = {
      message:
        'If this account exists and requires verification, a verification email has been sent.',
    };

    // A public resend response must never contain a verification capability,
    // including in local preview mode or transport/repository failure paths.
    try {
      const normalizedEmail = this.normalizeEmail(email);
      // Keep the same public response for rejected recipients and unknown users.
      // Reject before any user lookup, token rotation or mail transport action.
      assertLocalDemoRecipient(normalizedEmail);
      const user = await this.usersService.getByEmail(normalizedEmail);
      if (!user || user.email_verified) return response;

      const emailToken = this.generateEmailToken();
      await this.usersService.update(user.id, {
        email_token: emailToken,
        email_token_expires_at: this.getEmailTokenExpiration(),
      });
      // Deliberately discard the mail transport's optional preview URL.
      await this.mailService.sendResendVerificationEmail(
        user.email,
        emailToken,
        user.name,
      );
    } catch {
      // Transport errors can contain recipient addresses or verification URLs.
      this.logger.error('Verification email resend failed');
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

  async profile(user: { id: number; email: string; name?: string }) {
    const dbUser = await this.usersService.getOwnProfile(user.id);

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    return ownProfileDto(dbUser);
  }
}

