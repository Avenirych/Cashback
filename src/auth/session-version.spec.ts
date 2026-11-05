import {
  MAX_SESSION_VERSION, compareSessionVersion, isSessionVersion, planSessionVersionIncrement,
} from './session-version';

describe('Inactive session version preparation (pure functions only)', () => {
  it.each([undefined, null, '', '0', '1', false, {}, [], -1, 0.5, NaN, Infinity,
    MAX_SESSION_VERSION + 1])('rejects invalid claim/current version %#', value => {
    expect(isSessionVersion(value)).toBe(false);
    expect(compareSessionVersion(value, 0)).toEqual({ valid: false, reason: 'invalid_claim' });
    expect(compareSessionVersion(0, value)).toEqual({ valid: false, reason: 'unavailable' });
    expect(() => planSessionVersionIncrement(value)).toThrow('SESSION_VERSION_UNAVAILABLE');
  });

  it.each([0, 1, MAX_SESSION_VERSION])('accepts an exact valid version %s', version => {
    expect(isSessionVersion(version)).toBe(true);
    expect(compareSessionVersion(version, version)).toEqual({ valid: true });
  });

  it('denies a legacy token without sv instead of defaulting it to zero', () => {
    const legacy: { sv?: unknown } = {};
    expect(compareSessionVersion(legacy.sv, 0)).toEqual({ valid: false, reason: 'invalid_claim' });
  });

  it('denies tokens before and after the current version', () => {
    expect(compareSessionVersion(0, 1)).toEqual({ valid: false, reason: 'mismatch' });
    expect(compareSessionVersion(2, 1)).toEqual({ valid: false, reason: 'mismatch' });
  });

  it('does not turn an unavailable authority into a valid version', () => {
    expect(compareSessionVersion(0, undefined)).toEqual({ valid: false, reason: 'unavailable' });
  });

  it('plans one immutable increment without changing caller state', () => {
    const version = 4;
    const plan = planSessionVersionIncrement(version);
    expect(plan).toEqual({ expected: 4, next: 5 });
    expect(Object.isFrozen(plan)).toBe(true);
    expect(version).toBe(4);
  });

  it('retains the same expected version for competing plans (DB CAS still required)', () => {
    const first = planSessionVersionIncrement(4);
    const second = planSessionVersionIncrement(4);
    expect(first).toEqual(second);
    expect(compareSessionVersion(second.expected, first.next))
      .toEqual({ valid: false, reason: 'mismatch' });
  });

  it('never wraps or resets an exhausted version', () => {
    expect(planSessionVersionIncrement(MAX_SESSION_VERSION - 1).next).toBe(MAX_SESSION_VERSION);
    expect(() => planSessionVersionIncrement(MAX_SESSION_VERSION)).toThrow('SESSION_VERSION_EXHAUSTED');
  });
});
