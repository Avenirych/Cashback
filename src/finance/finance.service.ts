import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { validatePostings, balanceAfter } from './ledger';
import type { Posting, Side } from './ledger';
@Injectable()
export class FinanceService {
  constructor(private readonly dataSource: DataSource) {}
  /** Explicit internal primitive only; no controllers, workers or automatic calls. */
  async post(eventKey: string, input: readonly Posting[]): Promise<{ journalId: string; replay: boolean }> {
    this.validateInput(eventKey, input);
    // Snapshot before awaiting the transaction: caller mutations cannot alter it.
    const lines = input.map(line => ({ ...line }));
    return this.dataSource.transaction(manager => this.postWithManager(manager, eventKey, lines));
  }

  /** Caller owns commit/rollback. A sealed journal is still provisional until outer commit. */
  async postWithManager(manager: EntityManager, eventKey: string, input: readonly Posting[]): Promise<{ journalId: string; replay: boolean }> {
    const runner = manager?.queryRunner;
    if (manager?.connection !== this.dataSource || !runner || runner.connection !== this.dataSource ||
        runner.manager !== manager || runner.isReleased || !runner.isTransactionActive) {
      throw new Error('An active transaction manager from this DataSource is required');
    }
    this.validateInput(eventKey, input);
    const lines = input.map(l => ({ accountId: l.accountId.toLowerCase(), side: l.side, amount: l.amount }));
    const canonical = lines.map(l => [l.accountId, l.side, l.amount.toString()]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const hash = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
      await manager.query('SELECT pg_advisory_xact_lock(726402, hashtext($1))', [eventKey]);
      const previous = await manager.query('SELECT id, "requestHash", sealed FROM finance_journals WHERE "eventKey"=$1', [eventKey]);
      if (previous.length) {
        if (previous[0].requestHash !== hash || !previous[0].sealed) throw new Error('Financial event conflict');
        return { journalId: previous[0].id, replay: true };
      }
      const ids = [...new Set(lines.map(l => l.accountId))].sort();
      const accounts = await manager.query('SELECT * FROM finance_accounts WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
      if (accounts.length !== ids.length) throw new Error('Unknown financial account');
      for (const account of accounts) {
        if (account.currency !== 'GBP') throw new Error('Wrong account currency');
        const delta = lines.filter(l => l.accountId === account.id).reduce((sum, l) => sum + (l.side === account.normalSide ? l.amount : -l.amount), 0n);
        balanceAfter(BigInt(account.balancePence), account.normalSide as Side, delta, account.nonnegative);
      }
      const id = randomUUID();
      await manager.query('INSERT INTO finance_journals(id,"eventKey","requestHash") VALUES($1,$2,$3)', [id, eventKey, hash]);
      for (const line of lines) await manager.query('INSERT INTO finance_postings(id,"journalId","accountId",side,"amountPence") VALUES($1,$2,$3,$4,$5)', [randomUUID(), id, line.accountId, line.side, line.amount.toString()]);
      await manager.query('UPDATE finance_journals SET sealed=true WHERE id=$1', [id]);
      return { journalId: id, replay: false };
  }

  private validateInput(eventKey: string, input: readonly Posting[]): void {
    if (typeof eventKey !== 'string' || !/^[A-Za-z0-9:_-]{8,160}$/.test(eventKey)) throw new Error('Invalid financial event key');
    validatePostings(input);
  }
}
