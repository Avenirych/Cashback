import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { ProgrammeMembership } from './programme-membership.entity';
import { Recipient } from './recipient.entity';
import {
  RecipientDetails,
  RecipientEncryptionService,
} from './recipient-encryption.service';

export const NOTICE_VERSION = '2026-10-draft';
export const TERMS_VERSION = '2026-10-draft';

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(ProgrammeMembership)
    private readonly memberships: Repository<ProgrammeMembership>,
    @InjectRepository(Recipient)
    private readonly recipients: Repository<Recipient>,
    private readonly dataSource: DataSource,
    private readonly encryption: RecipientEncryptionService,
    private readonly users: UsersService,
  ) {}

  private validate(body: unknown): RecipientDetails {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Invalid onboarding details');
    }
    const data = body as Record<string, unknown>;
    if (
      data.programmeOptIn !== true ||
      data.privacyAcknowledged !== true ||
      data.accuracyConfirmed !== true
    ) {
      throw new BadRequestException('All programme confirmations are required');
    }
    if (
      typeof data.accountHolderName !== 'string' ||
      data.accountHolderName.trim().length < 2 ||
      data.accountHolderName.trim().length > 120 ||
      data.accountHolderName
        .split('')
        .some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ) ||
      typeof data.sortCode !== 'string' ||
      !/^[0-9 -]+$/.test(data.sortCode) ||
      typeof data.accountNumber !== 'string' ||
      !/^\d{8}$/.test(data.accountNumber)
    )
      throw new BadRequestException('Invalid recipient details');
    const sortCode = data.sortCode.replace(/[ -]/g, '');
    if (!/^\d{6}$/.test(sortCode))
      throw new BadRequestException('Invalid recipient details');
    return {
      accountHolderName: data.accountHolderName.trim(),
      sortCode,
      accountNumber: data.accountNumber,
    };
  }

  async save(userId: number, body: unknown) {
    const details = this.validate(body);
    const user = await this.users.getById(userId);
    if (!user) throw new UnauthorizedException('Account unavailable');
    return this.dataSource.transaction(async (manager) => {
      // Enrollment and withdrawals serialize on the same authenticated account.
      const lockedUser = await manager.getRepository(User).findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedUser) throw new UnauthorizedException('Account unavailable');
      const recipientRepo = manager.getRepository(Recipient);
      const membershipRepo = manager.getRepository(ProgrammeMembership);
      const membership = await membershipRepo.findOne({ where: { userId } });
      if (membership?.completedAt) {
        const recipient = await recipientRepo.findOne({ where: { userId } });
        if (!recipient)
          throw new ServiceUnavailableException(
            'Recipient storage unavailable',
          );
        return {
          bonusEligible: this.membershipCompleted(membership),
          recipient: this.mask(this.encryption.decrypt(userId, recipient)),
          noticeVersion: NOTICE_VERSION,
          termsVersion: TERMS_VERSION,
        };
      }
      const encrypted = this.encryption.encrypt(userId, details);
      const now = new Date();
      await recipientRepo.save({
        userId: user.id,
        ...encrypted,
        updatedAt: now,
      });
      await membershipRepo.save({
        userId: user.id,
        programmeOptIn: true,
        privacyAcknowledged: true,
        accuracyConfirmed: true,
        noticeVersion: NOTICE_VERSION,
        termsVersion: TERMS_VERSION,
        optedInAt: now,
        privacyAcknowledgedAt: now,
        accuracyConfirmedAt: now,
        completedAt: now,
      });
      return {
        bonusEligible: true,
        recipient: this.mask(details),
        noticeVersion: NOTICE_VERSION,
        termsVersion: TERMS_VERSION,
      };
    });
  }

  private mask(details: RecipientDetails) {
    return {
      accountHolderNameMasked: '********',
      sortCodeMasked: '**-**-**',
      accountNumberMasked: `****${details.accountNumber.slice(-4)}`,
    };
  }

  async get(userId: number) {
    const recipient = await this.recipients.findOne({ where: { userId } });
    return {
      bonusEligible: await this.isEligible(userId),
      ...(recipient
        ? { recipient: this.mask(this.encryption.decrypt(userId, recipient)) }
        : {}),
      noticeVersion: NOTICE_VERSION,
      termsVersion: TERMS_VERSION,
    };
  }

  async isEligible(userId: number): Promise<boolean> {
    const membership = await this.memberships.findOne({ where: { userId } });
    return (
      this.membershipCompleted(membership) &&
      (await this.recipients.existsBy({ userId }))
    );
  }

  private membershipCompleted(membership: ProgrammeMembership | null): boolean {
    return !!(
      membership?.programmeOptIn &&
      membership.privacyAcknowledged &&
      membership.accuracyConfirmed &&
      membership.completedAt &&
      membership.optedInAt &&
      membership.privacyAcknowledgedAt &&
      membership.accuracyConfirmedAt &&
      membership.noticeVersion === NOTICE_VERSION &&
      membership.termsVersion === TERMS_VERSION
    );
  }

  async assertEligible(userId: number): Promise<void> {
    if (!(await this.isEligible(userId))) {
      throw new ForbiddenException('Complete programme onboarding first');
    }
  }

  async getRecipientId(userId: number): Promise<number> {
    await this.assertEligible(userId);
    const recipient = await this.recipients.findOne({ where: { userId } });
    if (!recipient)
      throw new ServiceUnavailableException('Recipient storage unavailable');
    this.encryption.decrypt(userId, recipient);
    return recipient.userId;
  }
}
