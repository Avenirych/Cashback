import { BadRequestException } from '@nestjs/common';
import type { User } from './user.entity';
import { normalizePhone } from './phone-normalization';

export interface SafeUserDto {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
  balance: number;
  email_verified: boolean;
  created_at: Date;
}

/** Own-account fields only. Never spread an entity into a response. */
export function safeUserDto(user: User): SafeUserDto {
  return {
    id: user.id, email: user.email, name: user.name,
    avatar_url: user.avatar_url, balance: user.balance,
    email_verified: user.email_verified, created_at: user.created_at,
  };
}

export function ownProfileDto(user: User) {
  return {
    ...safeUserDto(user),
    phone_e164: user.phone_e164 ?? null,
    phone_verified: user.phone_verified ?? false,
    phone_verified_at: user.phone_verified_at ?? null,
  };
}

export interface UpdateOwnUserDto { name?: string; phone_e164?: string }

/** Explicit runtime allowlist; TypeScript types alone do not validate JSON. */
export function parseOwnUserPatch(body: unknown): UpdateOwnUserDto {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Expected a profile object');
  }
  const fields = Reflect.ownKeys(body);
  if (!fields.length || fields.some(key => key !== 'name' && key !== 'phone_e164') ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(body))) {
    throw new BadRequestException('Only name and phone_e164 may be updated');
  }
  const data = body as Record<string, unknown>;
  const parsed: UpdateOwnUserDto = {};
  if (fields.includes('name')) {
    const name = data.name;
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      throw new BadRequestException('Name must contain 2 to 100 characters');
    }
    parsed.name = name.trim();
  }
  if (fields.includes('phone_e164')) parsed.phone_e164 = normalizePhone(data.phone_e164);
  return parsed;
}
