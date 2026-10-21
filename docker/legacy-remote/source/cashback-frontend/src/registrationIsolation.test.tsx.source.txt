import React from 'react';
import { act, render } from '@testing-library/react';
import { bonusApi } from './bonusApi';
import { bonusApi as legacy } from './services/bonusApi';
import { BonusesProvider, useBonuses } from './context/BonusesContext';
import { registrationIsolated } from './registrationIsolation';

jest.mock('./context/AuthContext', () => ({useAuth: () => ({
  user: {id: 501, email_verified: true}, token: 'synthetic-only-token', loading: false,
})}));
const saved = process.env.REACT_APP_REGISTRATION_ISOLATED;
beforeEach(() => {
  process.env.REACT_APP_REGISTRATION_ISOLATED = 'true';
  global.fetch = jest.fn().mockRejectedValue(new Error('Network must not be used'));
});
afterEach(() => {
  if (saved === undefined) delete process.env.REACT_APP_REGISTRATION_ISOLATED;
  else process.env.REACT_APP_REGISTRATION_ISOLATED = saved;
  jest.useRealTimers();
});

test('all current and legacy bonus API methods refuse before any fetch', async () => {
  const payload = {toUsername: 'synthetic', bonusIds: ['synthetic-id']};
  const calls = [
    () => bonusApi.getSnapshot('synthetic-only-token'),
    () => bonusApi.transferBonus('synthetic-only-token', payload, 'synthetic-key'),
    () => legacy.getSnapshot(501), () => legacy.getSummary(501), () => legacy.getItems(501),
    () => legacy.transferBonus(payload),
    () => legacy.consumeBonusesForPurchase(501, ['synthetic-id'], 'synthetic-order'),
    () => legacy.refreshExpiredBonuses(501),
  ];
  for (const call of calls) await expect(call()).rejects.toThrow('disabled in isolated registration mode');
  expect(fetch).not.toHaveBeenCalled();
});

test('verified session, focus, visibility, timers, refresh and transfer produce no bonus requests', async () => {
  jest.useFakeTimers();
  let state!: ReturnType<typeof useBonuses>;
  function Probe() { state = useBonuses(); return null; }
  const mounted = render(<BonusesProvider><Probe /></BonusesProvider>);
  await act(async () => {
    jest.advanceTimersByTime(120000);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await state.refresh();
    await expect(state.transfer({toUsername: 'synthetic', bonusIds: []}, 'synthetic-key')).rejects.toThrow('disabled');
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(state.summary).toBeNull(); // Unavailable; no invented financial snapshot.
  mounted.unmount();
});

test.each(['TRUE', 'typo', '1'])('ambiguous flag %s fails closed', value => {
  process.env.REACT_APP_REGISTRATION_ISOLATED = value;
  expect(registrationIsolated()).toBe(true);
});

test.each([undefined, 'false', ''])('ordinary mode %s retains the network path', async value => {
  if (value === undefined) delete process.env.REACT_APP_REGISTRATION_ISOLATED;
  else process.env.REACT_APP_REGISTRATION_ISOLATED = value;
  expect(registrationIsolated()).toBe(false);
  await expect(bonusApi.getSnapshot('synthetic-only-token')).rejects.toThrow('Network must not be used');
  expect(fetch).toHaveBeenCalledTimes(1); // Stub rejects; no financial response or operation.
});
