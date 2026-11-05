import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { JwtModuleAsyncOptions } from '@nestjs/jwt';
import { validateJwtConfigurationInput } from './jwt-configuration-policy';

export const JWT_CONFIGURATION = Symbol('JWT_CONFIGURATION');
export interface JwtConfiguration { readonly secret: string }

export function validateJwtConfiguration(config: ConfigService): JwtConfiguration {
  return validateJwtConfigurationInput({ secret: config.get<unknown>('JWT_SECRET') });
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
