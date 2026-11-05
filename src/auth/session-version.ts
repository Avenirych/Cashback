/** Inactive preparation only. Import into both JWT strategies only after approved schema cutover. */
export const MAX_SESSION_VERSION = 2147483647;

export interface SessionVersionClaims { readonly sv: number }
export interface SessionVersionIncrement {
  readonly expected: number;
  readonly next: number;
}
export type SessionVersionDecision =
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: 'invalid_claim' | 'mismatch' | 'unavailable' };

export function isSessionVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 0 && value <= MAX_SESSION_VERSION;
}

/** Call only after signature/expiry/identity checks, with a fresh authoritative DB value.
 * This pure comparison cannot establish storage freshness or revoke in-flight operations.
 */
export function compareSessionVersion(claim: unknown, current: unknown): SessionVersionDecision {
  if (!isSessionVersion(claim)) return { valid: false, reason: 'invalid_claim' };
  if (!isSessionVersion(current)) return { valid: false, reason: 'unavailable' };
  return claim === current ? { valid: true } : { valid: false, reason: 'mismatch' };
}

/** An arithmetic plan, NOT a DB write. Persist only with an atomic expected-version CAS.
 * Never implement this as an unconditional UPDATE following a separate SELECT.
 */
export function planSessionVersionIncrement(expected: unknown): SessionVersionIncrement {
  if (!isSessionVersion(expected)) throw new Error('SESSION_VERSION_UNAVAILABLE');
  if (expected === MAX_SESSION_VERSION) throw new Error('SESSION_VERSION_EXHAUSTED');
  return Object.freeze({ expected, next: expected + 1 });
}
