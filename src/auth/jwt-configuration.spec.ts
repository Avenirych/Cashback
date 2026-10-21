import { startGuardedHttpTestApp } from '../../test/guarded-http-app';
import { requiredJwtSecret } from '../local-configuration';
import { UsersService } from '../users/users.service';
import { Controller, Get, Req, UseGuards, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import {
  JWT_CONFIGURATION, JwtConfiguration, JwtConfigurationModule,
  jwtRegistrationOptions, validateJwtConfiguration,
} from './jwt-configuration';

@Controller('jwt-probe')
class ProbeController {
  @Get()
  @UseGuards(JwtAuthGuard)
  get(@Req() req: { user: unknown }) { return req.user; }
}

const syntheticSecret = 'synthetic-jwt-regression-key-not-a-deployment-secret';
const configured = (value: unknown) => ({ get: jest.fn().mockReturnValue(value) });

const previousSecret = process.env.JWT_SECRET;
afterAll(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
async function testModule(value: unknown) {
  process.env.JWT_SECRET = typeof value === "string" && value.trim() ? value : syntheticSecret;
  return Test.createTestingModule({
    imports: [JwtConfigurationModule, JwtModule.registerAsync(jwtRegistrationOptions), PassportModule],
    controllers: [ProbeController],
    providers: [JwtStrategy, { provide: UsersService, useValue: { getById: jest.fn().mockResolvedValue({ id: 42, email: "synthetic@example.test", email_verified: false }) } }],
  }).overrideProvider(ConfigService).useValue(configured(value)).compile();
}

describe('Shared JWT configuration', () => {
  it.each([undefined, '', '   ', '\t\n'])('fails initialization for blank configuration (%p)', async value => {
    await expect(testModule(value)).rejects.toThrow('JWT_SECRET must be configured and nonblank');
  });

  it('does not include rejected configuration data in its error', () => {
    const invalid = { marker: 'synthetic-sensitive-error-marker' };
    expect(() => validateJwtConfiguration(configured(invalid) as unknown as ConfigService))
      .toThrow(/^JWT_SECRET must be configured and nonblank$/);
  });

  it('preserves a nonblank key exactly and freezes configuration', () => {
    const key = ` ${syntheticSecret} `;
    const result = validateJwtConfiguration(configured(key) as unknown as ConfigService);
    expect(result.secret).toBe(key);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('reads injected configuration at initialization rather than import-time env', async () => {
    const module = await testModule(syntheticSecret);
    const config = module.get<JwtConfiguration>(JWT_CONFIGURATION);
    expect(config.secret).toBe(syntheticSecret);
    expect(module.get(JwtService)).toBeDefined();
    expect(module.get(JwtStrategy)).toBeDefined();
    expect(module.get(ConfigService).get).toHaveBeenCalledTimes(1);
    await module.close();
  });

  describe('signer and real Passport verifier', () => {
    let app: INestApplication;
    let jwt: JwtService;
    beforeAll(async () => {
      const module = await testModule(syntheticSecret);
      jwt = module.get(JwtService);
      app = module.createNestApplication();
      await startGuardedHttpTestApp(app);
    });
    afterAll(async () => { await app.close(); });

    it('accepts signer JWT and preserves algorithm, TTL and payload', async () => {
      const claims = { sub: 42, email: 'synthetic@example.test', name: 'Synthetic' };
      const token = jwt.sign(claims);
      const decoded = jwt.decode(token, { complete: true }) as {
        header: { alg: string }; payload: typeof claims & { iat: number; exp: number };
      };
      expect(decoded.header.alg).toBe('HS256');
      expect(decoded.payload).toMatchObject(claims);
      expect(decoded.payload.exp - decoded.payload.iat).toBe(86400);
      await request(app.getHttpServer()).get('/jwt-probe')
        .set('Authorization', `Bearer ${token}`).expect(200)
        .expect({ id: 42, email: claims.email });
    });

    it('rejects a different signature', async () => {
      const wrong = new JwtService({ secret: 'different-synthetic-key' }).sign({ sub: 42 });
      await request(app.getHttpServer()).get('/jwt-probe')
        .set('Authorization', `Bearer ${wrong}`).expect(401);
    });

    it('keeps expiration verification enabled', async () => {
      const expired = jwt.sign({ sub: 42 }, { expiresIn: -1 });
      await request(app.getHttpServer()).get('/jwt-probe')
        .set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it('requires a bearer token', async () => {
      await request(app.getHttpServer()).get('/jwt-probe').expect(401);
    });
  });
});



test.each([undefined, '', '   ', '\t', '\r\n'])('canonical signer/strategy helper rejects blank secret %p', value => {
  expect(() => requiredJwtSecret({ JWT_SECRET: value })).toThrow('HISTORICAL_CONFIG_REQUIRED_JWT_SECRET');
});
test('canonical secret validation does not trim a legitimate key', () => {
  const key=' '+syntheticSecret+' '; expect(requiredJwtSecret({JWT_SECRET:key})).toBe(key);
});
