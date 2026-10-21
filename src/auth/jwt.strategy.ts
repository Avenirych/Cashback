import { requiredJwtSecret } from '../local-configuration';
import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requiredJwtSecret(),
    });
  }

  async validate(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new UnauthorizedException('Invalid authenticated identity');
    }
    const sub = (payload as { sub?: unknown }).sub;
    if (typeof sub !== 'number' || !Number.isSafeInteger(sub) || sub <= 0 || sub > 2147483647) {
      throw new UnauthorizedException('Invalid authenticated identity');
    }
    let user;
    try { user = await this.users.getById(sub); }
    catch { throw new ServiceUnavailableException('Authentication temporarily unavailable'); }
    if (!user || user.id !== sub) throw new UnauthorizedException('Account unavailable');
    // There is no disabled/status column in the current schema. Do not confuse
    // unverified email or a forum-only ban with a disabled application account.
    return { id: user.id, email: user.email };
  }
}
