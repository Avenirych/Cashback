import { BadRequestException } from '@nestjs/common';

export function toPence(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException('Amount must be a GBP decimal');
  }
  const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new BadRequestException('Amount must be a GBP decimal');
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}

export function fromPence(pence: number): string {
  if (!Number.isSafeInteger(pence) || pence < 0 || pence > 9999999999) {
    throw new BadRequestException('Invalid GBP amount');
  }
  return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, '0')}`;
}
