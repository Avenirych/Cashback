import { assertPence } from './money';
export type Side = 'debit' | 'credit';
export interface Posting { accountId: string; side: Side; amount: bigint }
export function validatePostings(lines: readonly Posting[]): void {
  if (!Array.isArray(lines) || lines.length < 2 || lines.length > 1000) throw new Error('Invalid posting count');
  let debit = 0n, credit = 0n;
  for (const line of lines) {
    if (!line || typeof line.accountId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(line.accountId)) throw new Error('Invalid account ID');
    assertPence(line.amount); if (line.amount === 0n) throw new Error('Zero posting');
    if (line.side === 'debit') debit += line.amount;
    else if (line.side === 'credit') credit += line.amount;
    else throw new Error('Invalid posting side');
  }
  if (debit !== credit) throw new Error('Unbalanced journal');
}
export function balanceAfter(balance: bigint, normal: Side, delta: bigint, nonnegative: boolean): bigint {
  const next = balance + delta;
  if (nonnegative && next < 0n) throw new Error('Insufficient available funds');
  if (next > 9223372036854775807n || next < -9223372036854775808n) throw new Error('Balance overflow');
  if (normal !== 'debit' && normal !== 'credit') throw new Error('Invalid account side');
  return next;
}
