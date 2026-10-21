import type { INestApplication } from '@nestjs/common';

/** Test-only: await the actual owned ephemeral listener, never a timing delay. */
export async function startGuardedHttpTestApp(app: INestApplication): Promise<void> {
  await app.init();
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  if (!address || typeof address !== 'object' || address.address !== '127.0.0.1' ||
      !Number.isInteger(address.port) || address.port <= 0) {
    throw new Error('TEST_OWNED_LOOPBACK_LISTENER_NOT_READY');
  }
}
