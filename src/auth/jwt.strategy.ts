import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { JWT_CONFIGURATION } from './jwt-configuration';
import type { JwtConfiguration } from './jwt-configuration';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(JWT_CONFIGURATION) config: JwtConfiguration,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.secret,
    });
  }

  async validate(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new UnauthorizedException('Invalid authenticated identity');
    }
    const claims = payload as { sub?: unknown; email?: unknown };
    const id = claims.sub;
    // users.id is a positive PostgreSQL integer, not a coercible string.
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
      throw new UnauthorizedException('Invalid authenticated identity');
    }
    let user;
    try {
      user = await this.usersService.getById(id);
    } catch {
      // A failed lookup is not proof of deletion. Do not expose DB details.
      throw new ServiceUnavailableException('Authentication service unavailable');
    }
    if (!user) throw new UnauthorizedException('Invalid authenticated identity');
    // Preserve the existing principal and allow unverified existing accounts.
    return { id, email: claims.email };
  }
}
