import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Recipient } from './recipient.entity';

export interface RecipientDetails {
  accountHolderName: string;
  sortCode: string;
  accountNumber: string;
}

@Injectable()
export class RecipientEncryptionService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const encoded = this.config.get<string>('RECIPIENT_ENCRYPTION_KEY');
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) {
      throw new ServiceUnavailableException('Recipient storage unavailable');
    }
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || key.toString('base64') !== encoded) {
      throw new ServiceUnavailableException('Recipient storage unavailable');
    }
    return key;
  }

  encrypt(userId: number, details: RecipientDetails) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from(`onboarding-recipient:v1:${userId}`, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(details), 'utf8'),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(
    userId: number,
    recipient: Pick<Recipient, 'ciphertext' | 'iv' | 'authTag'>,
  ): RecipientDetails {
    const key = this.key();
    try {
      const iv = Buffer.from(recipient.iv, 'base64');
      const tag = Buffer.from(recipient.authTag, 'base64');
      if (iv.length !== 12 || tag.length !== 16) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(Buffer.from(`onboarding-recipient:v1:${userId}`, 'utf8'));
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(recipient.ciphertext, 'base64')),
        decipher.final(),
      ]);
      const details = JSON.parse(
        plaintext.toString('utf8'),
      ) as RecipientDetails;
      if (
        typeof details.accountHolderName !== 'string' ||
        !details.accountHolderName.trim() ||
        !/^\d{6}$/.test(details.sortCode) ||
        !/^\d{8}$/.test(details.accountNumber)
      )
        throw new Error();
      return details;
    } catch {
      throw new ServiceUnavailableException('Recipient storage unavailable');
    }
  }
}
