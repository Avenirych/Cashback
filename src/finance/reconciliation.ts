import { balanceAfter, validatePostings } from './ledger';
import type { Side } from './ledger';

export interface ReconciliationAccount {
  id: string; normalSide: Side; nonnegative: boolean; cachedPence: bigint;
}
export interface ReconciliationPosting {
  id: string; journalId: string; accountId: string; side: Side; amount: bigint;
}
/** Read-only check over the COMPLETE committed history of zero-initialized finance
 * accounts. A caller must obtain one consistent DB snapshot. Does not repair data,
 * certify external bank evidence or import legacy balances.
 */
export function reconcileAccounts(accounts: readonly ReconciliationAccount[], postings: readonly ReconciliationPosting[]) {
  const indexed = new Map<string, ReconciliationAccount>();
  const totals = new Map<string, bigint>();
  for (const account of accounts) {
    if (indexed.has(account.id)) throw new Error('Duplicate account');
    indexed.set(account.id, account); totals.set(account.id, 0n);
  }
  const seen = new Set<string>();
  const journals = new Map<string, ReconciliationPosting[]>();
  for (const posting of postings) {
    if (!posting.id || seen.has(posting.id)) throw new Error('Duplicate or missing posting');
    seen.add(posting.id);
    const account = indexed.get(posting.accountId);
    if (!account || !posting.journalId) throw new Error('Unknown account or missing journal');
    const group = journals.get(posting.journalId) ?? [];
    group.push(posting); journals.set(posting.journalId, group);
    totals.set(account.id, totals.get(account.id)! + (posting.side === account.normalSide ? posting.amount : -posting.amount));
  }
  for (const group of journals.values()) validatePostings(group);
  const differences: { accountId: string; cachedPence: bigint; journalPence: bigint }[] = [];
  for (const account of accounts) {
    const expected = balanceAfter(0n, account.normalSide, totals.get(account.id)!, account.nonnegative);
    if (account.cachedPence !== expected) differences.push({ accountId: account.id, cachedPence: account.cachedPence, journalPence: expected });
  }
  return { balanced: differences.length === 0, differences, accountCount: accounts.length, journalCount: journals.size };
}
