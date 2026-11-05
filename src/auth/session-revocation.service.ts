import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../users/user.entity';
import { compareSessionVersion, isSessionVersion, planSessionVersionIncrement } from './session-version';

export function assertCurrentSession(claim: unknown, current: unknown): void {
  const result = compareSessionVersion(claim, current);
  if (result.valid) return;
  if (result.reason === 'unavailable') throw new ServiceUnavailableException('Session authority unavailable');
  throw new UnauthorizedException('Sign in again');
}

/** Reuse the established finance reader budgets; no retries or server-wide settings. */
async function budgets(m: EntityManager): Promise<void> {
  await m.query("SET LOCAL statement_timeout='5s'");
  await m.query("SET LOCAL lock_timeout='1s'");
}

/** Must run before business locks/writes and hold its row lock until the caller commits. */
export async function lockCurrentSession(m: EntityManager, id: number, sv: unknown): Promise<void> {
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647 || !isSessionVersion(sv))
    throw new UnauthorizedException('Sign in again');
  try {
    await budgets(m);
    const rows = await m.query('SELECT session_version FROM public.users WHERE id=$1 FOR SHARE', [id]);
    if (!Array.isArray(rows) || rows.length > 1) throw new ServiceUnavailableException('Session authority unavailable');
    if (!rows.length) throw new UnauthorizedException('Account unavailable');
    assertCurrentSession(sv, rows[0].session_version);
  } catch (e) {
    if (e instanceof UnauthorizedException || e instanceof ServiceUnavailableException) throw e;
    throw new ServiceUnavailableException('Session authority unavailable');
  }
}

export interface FinanceSessionAuthority {
  verifyFinance(id: number, accountUuid: string, sv: unknown): Promise<void>;
}

@Injectable()
export class SessionRevocationService implements FinanceSessionAuthority {
  constructor(private readonly db: DataSource) {}

  async verifyFinance(id: number, accountUuid: string, sv: unknown): Promise<void> {
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647 || !isSessionVersion(sv))
      throw new UnauthorizedException('Sign in again');
    try {
      await this.db.transaction(async m => {
        await m.query('SET TRANSACTION READ ONLY');
        await budgets(m);
        const rows = await m.query('SELECT id,account_uuid,session_version FROM public.users WHERE id=$1', [id]);
        if (!Array.isArray(rows) || rows.length > 1) throw new ServiceUnavailableException('Session authority unavailable');
        if (!rows.length || rows[0].id !== id || rows[0].account_uuid !== accountUuid)
          throw new UnauthorizedException('Account identity changed');
        assertCurrentSession(sv, rows[0].session_version);
      });
    } catch (e) {
      if (e instanceof UnauthorizedException || e instanceof ServiceUnavailableException) throw e;
      throw new ServiceUnavailableException('Session authority unavailable');
    }
  }

  async logoutAll(id: number, sv: unknown): Promise<void> {
    if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647 || !isSessionVersion(sv))
      throw new UnauthorizedException('Sign in again');
    let next: number;
    try { next = planSessionVersionIncrement(sv).next; }
    catch { throw new ServiceUnavailableException('Session revocation unavailable'); }
    try {
      await this.db.transaction(async m => {
        await budgets(m);
        // QueryBuilder returning avoids driver-specific raw UPDATE result tuple shapes.
        const result = await m.createQueryBuilder().update(User)
          .set({ sessionVersion: () => '"session_version" + 1' })
          .where('id = :id AND session_version = :sv AND session_version < 2147483647', { id, sv })
          .returning('session_version').execute();
        if (result.affected === 0) throw new UnauthorizedException('Sign in again');
        if (result.affected !== 1 || !Array.isArray(result.raw) || result.raw.length !== 1 || result.raw[0].session_version !== next)
          throw new ServiceUnavailableException('Session revocation unavailable');
      }); // Await commit: no success response on commit failure or uncertain outcome.
    } catch (e) {
      if (e instanceof UnauthorizedException || e instanceof ServiceUnavailableException) throw e;
      throw new ServiceUnavailableException('Session revocation unavailable');
    }
  }
}
