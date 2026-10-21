/** GBP arithmetic: decimal strings at the boundary, bigint pennies in postings. */
export const MAX_PENCE = 9223372036854775807n;
export type RevenueKind = 'cashback' | 'rewarded_advertising' | 'research_referral' | 'passive_advertising';
function decimal(value: string): { coefficient: bigint; scale: bigint } {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value) || value.length > 100) throw new Error('Invalid nonnegative decimal');
  const [whole, fraction = ''] = value.split('.');
  return { coefficient: BigInt(whole + fraction), scale: 10n ** BigInt(fraction.length) };
}
function halfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}
export function assertPence(value: bigint): void {
  if (typeof value !== 'bigint' || value < 0n || value > MAX_PENCE) throw new Error('Invalid GBP pennies');
}
export function gbpToPence(value: string): bigint {
  const d = decimal(value); const result = halfUp(d.coefficient * 100n, d.scale);
  assertPence(result); return result;
}
/** Split a finalized received amount; platform gets the exact remainder. */
export function splitRevenue(total: bigint, kind: RevenueKind) {
  assertPence(total);
  const shares: Record<RevenueKind, bigint> = { cashback: 80n, rewarded_advertising: 80n, research_referral: 50n, passive_advertising: 0n };
  if (!Object.prototype.hasOwnProperty.call(shares, kind)) throw new Error('Unknown revenue kind');
  const user = halfUp(total * shares[kind], 100n);
  return { total, user, platform: total - user };
}
/** Exact decimal multiplication before the single penny rounding step. */
export function percentageOfGbp(value: string, percentage: string): bigint {
  const a = decimal(value), b = decimal(percentage);
  const result = halfUp(a.coefficient * b.coefficient, a.scale * b.scale);
  assertPence(result); return result;
}
