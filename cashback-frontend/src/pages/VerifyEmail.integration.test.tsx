import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {AuthProvider, useAuth} from '../context/AuthContext';
import VerifyEmail from './VerifyEmail';
import ProtectedGuard from '../components/ProtectedGuard';

const link = '/verify-email?token=' + 'a'.repeat(64);
const account = {id: 42, name: 'Buyer', email: 'buyer@example.invalid', email_verified: false};
let auth: ReturnType<typeof useAuth>;
let verified: boolean;
let mode: 'ok' | 'lost' | 'json' | 'invalid' | 'offline';
let requests: number;
function response(data: unknown, status = 200) {
  return {ok: status === 200, status, json: async () => data, text: async () => JSON.stringify(data)};
}
function Probe() { auth = useAuth(); return <span data-testid="session">{auth.loading ? 'loading' : 'ready'}</span>; }
function Page({show = true, url = link}: {show?: boolean; url?: string}) {
  return <><Probe />{show && <MemoryRouter initialEntries={[url]}><VerifyEmail lang="ru" /></MemoryRouter>}</>;
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  sessionStorage.setItem('cashback_pending_auth', 'synthetic-pending-session');
  verified = false; mode = 'ok'; requests = 0;
  global.fetch = jest.fn(async (url, init) => {
    if (String(url).includes('/auth/verify-email?')) {
      requests++;
      if (mode === 'offline') throw new TypeError('Network unavailable');
      if (mode === 'invalid' || verified) return response({message: 'Invalid or expired verification token'}, 400);
      verified = true;
      if (mode === 'lost') throw new TypeError('Response lost after server commit');
      if (mode === 'json') return {ok: true, status: 200, text: async () => '{'};
      return response({access_token: 'synthetic-verified-session', user: {...account, email_verified: true}});
    }
    if (String(url).endsWith('/auth/profile')) {
      if (!(init?.headers as any)?.Authorization) return response({}, 401);
      return response({...account, email_verified: verified});
    }
    if (String(url).endsWith('/forum/status')) return response({registered: false});
    throw new Error('Unexpected endpoint');
  }) as jest.Mock;
});

test('successful response establishes verified session and profile navigation under StrictMode', async () => {
  render(<React.StrictMode><AuthProvider><Page /></AuthProvider></React.StrictMode>);
  await screen.findByText('Электронная почта подтверждена!');
  expect(requests).toBe(1);
  expect(auth.user?.email_verified).toBe(true);
  expect(localStorage.getItem('cashback_token')).toBe('synthetic-verified-session');
  expect(screen.getByRole('link', {name: 'Перейти в профиль'})).toHaveAttribute('href', '/profile');
});

test.each(['lost', 'json'] as const)('server commits but %s response is uncertain: authenticated status recovers success', async value => {
  mode = value;
  render(<AuthProvider><Page /></AuthProvider>);
  await screen.findByText('Электронная почта подтверждена!');
  expect(verified).toBe(true); expect(requests).toBe(1);
  expect(auth.user?.email_verified).toBe(true);
});

test('refresh with scrubbed URL restores verified account without replaying token', async () => {
  verified = true;
  render(<AuthProvider><Page url="/verify-email" /></AuthProvider>);
  await screen.findByText('Электронная почта подтверждена!');
  expect(requests).toBe(0);
});

test('another tab has consumed token: restored authenticated status recovers success', async () => {
  verified = true; mode = 'invalid';
  render(<AuthProvider><Page /></AuthProvider>);
  await screen.findByText('Электронная почта подтверждена!');
  expect(requests).toBe(1);
});

test('status cannot recover using a different account', async () => {
  render(<AuthProvider><Page show={false} /></AuthProvider>);
  await screen.findByText('ready');
  await expect(auth.checkVerification(account.id + 1)).rejects.toThrow('Session changed');
  const original = fetch as jest.Mock;
  global.fetch = jest.fn((url, init) => String(url).endsWith('/auth/profile')
    ? Promise.resolve(response({...account, id: account.id + 1, email_verified: true})) : original(url, init));
  await expect(auth.checkVerification(account.id)).rejects.toThrow('Invalid account status response');
  expect(auth.user?.email_verified).toBe(false);
});

test('real page remount reuses consumed link: failed replay recovers only via authenticated status', async () => {
  const view = render(<AuthProvider><Page /></AuthProvider>);
  await screen.findByText('Электронная почта подтверждена!');
  view.rerender(<AuthProvider><Page show={false} /></AuthProvider>);
  view.rerender(<AuthProvider><Page /></AuthProvider>);
  await screen.findByText('Электронная почта подтверждена!');
  expect(auth.user?.email_verified).toBe(true);
  expect(requests).toBe(2); // Backend rejects replay; authenticated profile proves account status.
});

test('page remount during an in-flight verification does not send a second request', async () => {
  const original = fetch as jest.Mock;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  global.fetch = jest.fn(async (url, init) => {
    const result = await original(url, init);
    if (String(url).includes('/auth/verify-email?')) await gate;
    return result;
  });
  const view = render(<AuthProvider><Page /></AuthProvider>);
  await screen.findByText('ready');
  // Let the first request reach the fake server before remounting the page.
  await act(async () => { await Promise.resolve(); });
  view.rerender(<AuthProvider><Page show={false} /></AuthProvider>);
  view.rerender(<AuthProvider><Page /></AuthProvider>);
  await act(async () => { release(); });
  await screen.findByText('Электронная почта подтверждена!');
  expect(requests).toBe(1);
});

test('concurrent provider calls share a single token request', async () => {
  render(<AuthProvider><Page show={false} /></AuthProvider>);
  await screen.findByText('ready');
  await act(async () => { await Promise.all([auth.verifyEmail('a'.repeat(64)), auth.verifyEmail('a'.repeat(64))]); });
  expect(requests).toBe(1);
});

test('success button enters protected profile using refreshed auth state', async () => {
  render(<AuthProvider><MemoryRouter initialEntries={[link]}><Routes>
    <Route path="/verify-email" element={<VerifyEmail lang="ru" />} />
    <Route element={<ProtectedGuard />}><Route path="/profile" element={<p>Protected profile reached</p>} /></Route>
  </Routes></MemoryRouter></AuthProvider>);
  fireEvent.click(await screen.findByRole('link', {name: 'Перейти в профиль'}));
  await screen.findByText('Protected profile reached');
});

test('logout during verification cannot restore a stale session', async () => {
  const original = fetch as jest.Mock;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  global.fetch = jest.fn(async (url, init) => {
    const result = await original(url, init);
    if (String(url).includes('/auth/verify-email?')) await gate;
    return result;
  });
  render(<AuthProvider><Page /></AuthProvider>);
  await screen.findByText('ready');
  await act(async () => { await Promise.resolve(); auth.logout(); release(); });
  await screen.findByRole('alert');
  expect(auth.user).toBeNull();
  expect(localStorage.getItem('cashback_token')).toBeNull();
});

test.each(['invalid', 'offline'] as const)('%s request with unverified server status never succeeds', async value => {
  mode = value; render(<AuthProvider><Page /></AuthProvider>);
  await screen.findByRole('alert');
  expect(screen.queryByText('Электронная почта подтверждена!')).not.toBeInTheDocument();
  expect(auth.user?.email_verified).toBe(false);
});

test('used token without authenticated session cannot recover success', async () => {
  sessionStorage.clear(); verified = true; mode = 'invalid';
  render(<AuthProvider><Page /></AuthProvider>);
  await screen.findByRole('alert');
  expect(auth.user).toBeNull();
  expect(screen.queryByRole('link', {name: 'Перейти в профиль'})).not.toBeInTheDocument();
});

test('status lookup failure after lost response fails closed', async () => {
  mode = 'lost';
  const original = fetch as jest.Mock;
  let profiles = 0;
  global.fetch = jest.fn((url, init) => {
    if (String(url).endsWith('/auth/profile') && ++profiles > 1) return Promise.resolve(response({}, 503));
    return original(url, init);
  });
  render(<AuthProvider><Page /></AuthProvider>);
  await screen.findByRole('alert');
  expect(screen.queryByText('Электронная почта подтверждена!')).not.toBeInTheDocument();
});
