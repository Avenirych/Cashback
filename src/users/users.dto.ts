import { BadRequestException } from '@nestjs/common';
import type { User } from './user.entity';

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

export interface UpdateOwnUserDto { name: string }

/** Explicit runtime allowlist; TypeScript types alone do not validate JSON. */
export function parseOwnUserPatch(body: unknown): UpdateOwnUserDto {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Expected a profile object');
  }
  const fields = Object.keys(body);
  if (fields.length !== 1 || fields[0] !== 'name') {
    throw new BadRequestException('Only name may be updated');
  }
  const name = (body as Record<string, unknown>).name;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    throw new BadRequestException('Name must contain 2 to 100 characters');
  }
  return { name: name.trim() };
}
