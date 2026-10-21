import type { INestApplication } from '@nestjs/common';
import { startGuardedHttpTestApp } from '../test/guarded-http-app';

describe('Guarded HTTP test startup readiness', () => {
  function fixture(address: unknown = { address: '127.0.0.1', port: 49152 }) {
    const server = { address: jest.fn(() => address) };
    const app = { init: jest.fn().mockResolvedValue(undefined), listen: jest.fn().mockResolvedValue(undefined), getHttpServer: jest.fn(() => server) };
    return { app, server, start: () => startGuardedHttpTestApp(app as unknown as INestApplication) };
  }
  it('waits for listening readiness before reading the address', async () => {
    const f = fixture();
    let ready!: () => void;
    f.app.listen.mockImplementation(() => new Promise<void>(resolve => { ready = resolve; }));
    const pending = f.start();
    await Promise.resolve();
    expect(f.app.init).toHaveBeenCalledTimes(1);
    expect(f.app.listen).toHaveBeenCalledWith(0, '127.0.0.1');
    expect(f.server.address).not.toHaveBeenCalled();
    ready();
    await pending;
    expect(f.server.address).toHaveBeenCalledTimes(1);
  });
  it.each([null, 'pipe', { address: '0.0.0.0', port: 12345 }, { address: '127.0.0.1', port: 0 }])('rejects non-ready/non-loopback listener %#', async address => {
    await expect(fixture(address).start()).rejects.toThrow('TEST_OWNED_LOOPBACK_LISTENER_NOT_READY');
  });
  it('propagates startup failure without reading an address or retrying', async () => {
    const f = fixture(); f.app.listen.mockRejectedValue(new Error('synthetic listen failure'));
    await expect(f.start()).rejects.toThrow('synthetic listen failure');
    expect(f.app.listen).toHaveBeenCalledTimes(1); expect(f.server.address).not.toHaveBeenCalled();
  });
});
