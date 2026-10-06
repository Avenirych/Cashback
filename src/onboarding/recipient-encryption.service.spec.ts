import { ConfigService } from '@nestjs/config';
import { RecipientEncryptionService } from './recipient-encryption.service';

describe('RecipientEncryptionService', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const details = {
    accountHolderName: 'Alice Example',
    sortCode: '001234',
    accountNumber: '00123456',
  };
  const service = (encoded: unknown = key) =>
    new RecipientEncryptionService({
      get: () => encoded,
    } as unknown as ConfigService);

  it('roundtrips encrypted details and uses fresh IVs', () => {
    const encrypted = service().encrypt(1, details);
    expect(service().decrypt(1, encrypted)).toEqual(details);
    expect(JSON.stringify(encrypted)).not.toContain(details.accountHolderName);
    expect(JSON.stringify(encrypted)).not.toContain(details.accountNumber);
    expect(service().encrypt(1, details).iv).not.toEqual(encrypted.iv);
  });

  it.each([
    null,
    '',
    'not-base64',
    Buffer.alloc(16).toString('base64'),
    Buffer.alloc(33).toString('base64'),
  ])('fails closed with invalid key %p on both write and read', (encoded) => {
    expect(() => service(encoded).encrypt(1, details)).toThrow(
      'Recipient storage unavailable',
    );
    expect(() =>
      service(encoded).decrypt(1, service().encrypt(1, details)),
    ).toThrow('Recipient storage unavailable');
  });

  it('rejects a different identity, key, ciphertext, tag, or IV', () => {
    const encrypted = service().encrypt(1, details);
    expect(() => service().decrypt(2, encrypted)).toThrow(
      'Recipient storage unavailable',
    );
    expect(() =>
      service(Buffer.alloc(32, 8).toString('base64')).decrypt(1, encrypted),
    ).toThrow();
    for (const field of ['ciphertext', 'iv', 'authTag'] as const) {
      const bytes = Buffer.from(encrypted[field], 'base64');
      bytes[0] ^= 1;
      expect(() =>
        service().decrypt(1, {
          ...encrypted,
          [field]: bytes.toString('base64'),
        }),
      ).toThrow();
    }
  });
});
