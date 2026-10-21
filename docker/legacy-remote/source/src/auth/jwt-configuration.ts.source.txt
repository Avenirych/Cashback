import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { JwtModuleAsyncOptions } from '@nestjs/jwt';

export const JWT_CONFIGURATION = Symbol('JWT_CONFIGURATION');
export interface JwtConfiguration { readonly secret: string }

export function validateJwtConfiguration(config: ConfigService): JwtConfiguration {
  const secret = config.get<unknown>('JWT_SECRET');
  if (typeof secret !== 'string' || !secret.trim()) {
    throw new Error('JWT_SECRET must be configured and nonblank');
  }
  // Validate whitespace without rewriting the key used by existing sessions.
  return Object.freeze({ secret });
}

@Module({
  imports: [ConfigModule],
  providers: [{
    provide: JWT_CONFIGURATION,
    inject: [ConfigService],
    useFactory: validateJwtConfiguration,
  }],
  exports: [JWT_CONFIGURATION],
})
export class JwtConfigurationModule {}

export const jwtRegistrationOptions: JwtModuleAsyncOptions = {
  imports: [JwtConfigurationModule],
  inject: [JWT_CONFIGURATION],
  useFactory: (config: JwtConfiguration) => ({
    secret: config.secret,
    signOptions: { expiresIn: '24h' },
  }),
};
