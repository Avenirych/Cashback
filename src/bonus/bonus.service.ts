import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, LessThanOrEqual } from 'typeorm';
import type { EntityManager } from 'typeorm';

import { User } from '../users/user.entity';
import { ForumUser } from '../forum/forum-user.entity';
import { BonusItem } from './bonus-item.entity';
import { BonusTransfer } from './bonus-transfer.entity';

function toCents(value: string): number {
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) {
    throw new ConflictException('Invalid stored bonus amount');
  }

  const [whole, fraction = ''] = value.split('.');
  const cents =
    Number(whole) * 100 +
    Number(fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(cents)) {
    throw new ConflictException('Bonus amount is too large');
  }

  return cents;
}

@Injectable()
export class BonusService {
  constructor(private readonly dataSource: DataSource) {}

  private async verifiedUser(
    manager: EntityManager,
    userId: number,
  ): Promise<User> {
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new ForbiddenException('Invalid authenticated user');
    }

    const user = await manager.findOne(User, {
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.email_verified) {
      throw new ForbiddenException('Verify your email first');
    }

    return user;
  }

  private checkForumAccount(account: ForumUser | null): ForumUser {
    if (!account) {
      throw new ForbiddenException('Forum registration is required');
    }

    if (account.banned) {
      throw new ForbiddenException('Forum account is banned');
    }

    return account;
  }

  async getSnapshot(userId: number) {
    return this.dataSource.transaction(
      'REPEATABLE READ',
      async (manager) => {
        await this.verifiedUser(manager, userId);

        const items = await manager.find(BonusItem, {
          where: { userId },
          order: { expiresAt: 'ASC', id: 'ASC' },
        });

        const transfers = await manager.find(BonusTransfer, {
          where: [
            { fromUserId: userId },
            { toUserId: userId },
          ],
          order: { createdAt: 'DESC', id: 'DESC' },
          take: 100,
        });

        const now = new Date();

        const summary = {
          balance: 0,
          confirmed: 0,
          pending: 0,
          spent: 0,
          expired: 0,
          available: 0,
          lastUpdated: now.toISOString(),
        };

        for (const item of items) {
          const cents = toCents(item.amount);

          if (item.status === 'spent') {
            summary.spent += cents;
          } else if (item.status === 'expired') {
            summary.expired += cents;
          } else if (
            item.status === 'confirmed' ||
            item.status === 'pending'
          ) {
            if (item.isExpired(now)) {
              summary.expired += cents;
            } else if (item.status === 'pending') {
              summary.pending += cents;
            } else {
              summary.confirmed += cents;

              if (item.isAvailable(now)) {
                summary.available += cents;
              }
            }
          }
        }

        summary.balance = summary.available;

        return {
          summary: {
            balance: summary.balance / 100,
            confirmed: summary.confirmed / 100,
            pending: summary.pending / 100,
            spent: summary.spent / 100,
            expired: summary.expired / 100,
            available: summary.available / 100,
            lastUpdated: summary.lastUpdated,
          },
          items: items.map((item) => ({
            id: item.id,
            userId: item.userId,
            source: item.source,
            amount: toCents(item.amount) / 100,
            status: item.status,
            expiresAt: item.expiresAt.toISOString(),
            createdAt: item.createdAt.toISOString(),
            usedAt: item.usedAt?.toISOString() ?? null,
            isExpired: item.isExpired(now),
            referenceId: item.referenceId,
            orderId: item.orderId,
            transferMeta: item.transferMeta,
          })),
          transfers: transfers.map((entry) =>
            this.serializeTransfer(entry),
          ),
        };
      },
    );
  }

  async transferBonuses(
    fromUserId: number,
    toUsername: string,
    bonusIds: string[],
    idempotencyKey: string,
  ): Promise<BonusTransfer[]> {
    if (
      typeof toUsername !== 'string' ||
      !/^[A-Za-z0-9_]{3,30}$/.test(toUsername.trim())
    ) {
      throw new BadRequestException('Invalid recipient username');
    }

    if (
      !Array.isArray(bonusIds) ||
      bonusIds.length === 0 ||
      bonusIds.length > 100 ||
      bonusIds.some(
        (id) =>
          typeof id !== 'string' ||
          !/^[0-9a-f-]{36}$/i.test(id),
      )
    ) {
      throw new BadRequestException('Select valid bonus IDs');
    }

    const ids = [...new Set(bonusIds.map((id) => id.toLowerCase()))];
    if (ids.length !== bonusIds.length) {
      throw new BadRequestException('Duplicate bonus IDs');
    }

    if (
      typeof idempotencyKey !== 'string' ||
      !/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)
    ) {
      throw new BadRequestException('Invalid Idempotency-Key');
    }

    const username = toUsername.trim().toLowerCase();
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ toUsername: username, bonusIds: ids }))
      .digest('hex');

    return this.dataSource.transaction(
      'READ COMMITTED',
      async (manager) => {
        await manager.query(
          'SELECT pg_advisory_xact_lock($1, $2)',
          [726401, 1],
        );

        await this.verifiedUser(manager, fromUserId);

        const sender = this.checkForumAccount(
          await manager
            .getRepository(ForumUser)
            .createQueryBuilder('forum')
            .where('forum.user_id = :userId', { userId: fromUserId })
            .setLock('pessimistic_write')
            .getOne(),
        );

        const existing = await manager.find(BonusTransfer, {
          where: { fromUserId, idempotencyKey },
        });

        if (existing.length > 0) {
          const sameRequest = existing.every(
            (entry) => entry.requestHash === requestHash,
          );

          if (!sameRequest) {
            throw new ConflictException(
              'Idempotency-Key was already used for another request',
            );
          }

          return existing;
        }

        const recipient = await manager
          .getRepository(ForumUser)
          .createQueryBuilder('forum')
          .where('LOWER(forum.username) = :username', { username })
          .setLock('pessimistic_write')
          .getOne();

        if (!recipient) {
          throw new NotFoundException('Recipient not found');
        }

        this.checkForumAccount(recipient);

        if (recipient.user_id === fromUserId) {
          throw new BadRequestException('Cannot transfer to yourself');
        }

        const bonuses = await manager
          .getRepository(BonusItem)
          .createQueryBuilder('bonus')
          .where('bonus.userId = :userId', { userId: fromUserId })
          .andWhere('bonus.id IN (:...ids)', { ids })
          .orderBy('bonus.id', 'ASC')
          .setLock('pessimistic_write')
          .getMany();

        if (bonuses.length !== ids.length) {
          throw new BadRequestException(
            'Some bonuses are missing or belong to another user',
          );
        }

        const now = new Date();

        for (const bonus of bonuses) {
          if (!bonus.isAvailable(now)) {
            throw new ConflictException(
              `Bonus ${bonus.id} is expired, used, or not confirmed`,
            );
          }
        }

        const result: BonusTransfer[] = [];

        for (const bonus of bonuses) {
          bonus.status = 'spent';
          bonus.usedAt = now;
          await manager.save(BonusItem, bonus);

          const received = manager.create(BonusItem, {
            userId: recipient.user_id,
            source: 'transfer',
            amount: bonus.amount,
            status: 'confirmed',
            expiresAt: bonus.expiresAt,
            usedAt: null,
            referenceId: bonus.id,
            orderId: null,
            transferMeta: {
              fromUserId,
              toUserId: recipient.user_id,
              fromUsername: sender.username,
              toUsername: recipient.username,
            },
          });

          await manager.save(BonusItem, received);

          const entry = manager.create(BonusTransfer, {
            fromUserId,
            toUserId: recipient.user_id,
            fromUsername: sender.username,
            toUsername: recipient.username,
            amount: bonus.amount,
            expiresAt: bonus.expiresAt,
            status: 'completed',
            idempotencyKey,
            requestHash,
            sourceBonusId: bonus.id,
          });

          result.push(await manager.save(BonusTransfer, entry));
        }

        return result;
      },
    );
  }

  serializeTransfer(entry: BonusTransfer) {
    return {
      id: entry.id,
      fromUserId: entry.fromUserId,
      toUserId: entry.toUserId,
      fromUsername: entry.fromUsername,
      toUsername: entry.toUsername,
      amount: toCents(entry.amount) / 100,
      createdAt: entry.createdAt.toISOString(),
      expiresAt: entry.expiresAt.toISOString(),
      status: entry.status,
    };
  }

  async spendBonusesOnPurchase(): Promise<never> {
    throw new NotImplementedException(
      'Purchases are disabled until server-side orders and trusted pricing are implemented',
    );
  }

  async expireOldBonuses(): Promise<number> {
    const result = await this.dataSource
      .getRepository(BonusItem)
      .update(
        {
          status: 'confirmed',
          expiresAt: LessThanOrEqual(new Date()),
        },
        { status: 'expired' },
      );

    return result.affected ?? 0;
  }
}