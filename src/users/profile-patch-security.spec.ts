import { parseOwnUserPatch } from './users.dto';

describe('Canonical name-only profile patch hardening', () => {
  it.each([null, undefined, [], 'name', 7, Object.create({ name: 'Inherited' }),
    Object.assign(Object.create({ admin: true }), { name: 'Buyer' }),
    JSON.parse('{"name":"Buyer","__proto__":{"admin":true}}'),
    { name: 'Buyer', constructor: 'polluted' }, { name: 'Buyer', phone_e164: '+12025550123' },
    { name: 'Buyer', email_verified: true }, { name: 'Buyer', balance: 999 },
    { name: 'Buyer', [Symbol('hidden')]: true },
    Object.defineProperty({ name: 'Buyer' }, 'hidden', { value: true }),
  ])('rejects malformed, inherited or additional fields %#', value => {
    expect(() => parseOwnUserPatch(value)).toThrow();
    expect(Object.prototype).not.toHaveProperty('admin');
  });
  it('rejects accessors without invoking them', () => {
    const getter = jest.fn(() => 'Buyer');
    expect(() => parseOwnUserPatch(Object.defineProperty({}, 'name', { get: getter }))).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });
  it.each([{}, Object.create(null)])('accepts only an own data name and preserves trimming %#', body => {
    body.name = '  Buyer Name  ';
    expect(parseOwnUserPatch(body)).toEqual({ name: 'Buyer Name' });
  });
  it.each(['', 'a', 'x'.repeat(101), 42])('retains name validation %#', name => {
    expect(() => parseOwnUserPatch({ name })).toThrow();
  });
});
