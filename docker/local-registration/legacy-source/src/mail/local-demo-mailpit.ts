import { BadRequestException } from '@nestjs/common';

/** Configuration policy, not proof of host or database identity. */
export function validateLocalDemoMailpit(env: Record<string, unknown>): boolean {
  const flag = env.LOCAL_DEMO_MAILPIT;
  if (flag !== undefined && flag !== 'false' && flag !== 'true') {
    throw new Error('Invalid local demo mail configuration');
  }
  const enabled = flag === 'true';
  const mailpitDestination = typeof env.SMTP_HOST === 'string' &&
    env.SMTP_HOST.trim().toLowerCase() === 'mailpit';
  const scenario = env.LOCAL_DEMO_SCENARIO;
  if (!enabled) {
    if (mailpitDestination || (scenario !== undefined && scenario !== '')) {
      throw new Error('Local demo mail requires explicit approval configuration');
    }
    return false;
  }

  if (
    env.NODE_ENV !== 'development' ||
    scenario !== 'cashback-local-mailpit-registration' ||
    env.SMTP_HOST !== 'mailpit' || env.SMTP_PORT !== '1025' ||
    env.SMTP_SECURE !== 'false' || env.USE_ETHEREAL !== 'false' ||
    (env.SMTP_USER !== undefined && env.SMTP_USER !== '') ||
    (env.SMTP_PASSWORD !== undefined && env.SMTP_PASSWORD !== '') ||
    env.SMTP_FROM !== 'Cashback Test <noreply@example.test>' ||
    env.FRONTEND_URL !== 'http://localhost:3003' ||
    env.DB_HOST !== 'postgres-test' || env.DB_PORT !== '5432' ||
    env.DB_NAME !== 'cashback_docker_test' ||
    (env.DATABASE_URL !== undefined && env.DATABASE_URL !== '')
  ) {
    throw new Error('Invalid local demo mail configuration');
  }
  return true;
}

export function assertLocalDemoRecipient(email: string): void {
  if (validateLocalDemoMailpit(process.env) &&
      !/^[a-z0-9._+-]{1,64}@example\.test$/i.test(email)) {
    throw new BadRequestException('Local demo accepts only example.test addresses');
  }
}
