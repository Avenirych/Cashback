import { normalizePhone } from './phone-normalization';
import { parseOwnUserPatch } from './users.dto';

describe('International phone boundary (metadata only, no delivery)', () => {
  it.each(['+12025550123', '+1 (202) 555-0123', ' +1 202 555 0123 '])('normalizes equivalent input %#', input => {
    expect(normalizePhone(input)).toBe('+12025550123');
  });
  it.each([undefined, null, 123, '', '2025550123', '+1', '+000123456',
    'call +12025550123', '+12025550123 ext 1', '+12025550123\nprivate', '+1'.repeat(40)])(
    'rejects invalid input with fixed, non-sensitive error %#', input => {
      expect(() => normalizePhone(input)).toThrow('A valid international phone number is required');
    },
  );
  it.each(['phone_verified','phone_verified_at','smsMarketingGrantedAt','smsMarketing'])('rejects privileged profile field %s', field => {
    expect(() => parseOwnUserPatch({phone_e164:'+12025550123',[field]:true})).toThrow();
  });
  it('does not allow clearing phone through the owner patch', () => {
    expect(() => parseOwnUserPatch({phone_e164:null})).toThrow();
  });
});
