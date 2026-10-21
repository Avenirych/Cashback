import { required } from '../local-configuration';
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
      secretOrKey: required('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: number; email: string }) {
    if (!Number.isSafeInteger(payload?.sub) || payload.sub <= 0) throw new UnauthorizedException('Invalid authenticated identity');
    let user;
    try { user = await this.users.getById(payload.sub); }
    catch { throw new ServiceUnavailableException('Authentication temporarily unavailable'); }
    if (!user || user.id !== payload.sub) throw new UnauthorizedException('Account unavailable');
    // There is no disabled/status column in the current schema. Do not confuse
    // unverified email or a forum-only ban with a disabled application account.
    return { id: user.id, email: user.email };
  }
}
