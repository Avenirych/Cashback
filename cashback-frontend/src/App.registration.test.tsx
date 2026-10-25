import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import App from './App';
import {translations} from './i18n';

const originalDemo = process.env.REACT_APP_DEMO_ONLY;
const originalReviews = process.env.REACT_APP_LOCAL_DEMO_REVIEWS;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('lang','ru');
  process.env.REACT_APP_DEMO_ONLY = 'true';
  process.env.REACT_APP_LOCAL_DEMO_REVIEWS = 'false';
  jest.spyOn(global, 'fetch').mockResolvedValue({ok:true, json:async()=>[], text:async()=>'[]'} as Response);
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalDemo === undefined) delete process.env.REACT_APP_DEMO_ONLY;
  else process.env.REACT_APP_DEMO_ONLY = originalDemo;
  if (originalReviews === undefined) delete process.env.REACT_APP_LOCAL_DEMO_REVIEWS;
  else process.env.REACT_APP_LOCAL_DEMO_REVIEWS = originalReviews;
});
function open(path: string) {
  window.history.replaceState({}, '', path);
  return render(<App/>);
}
function expectRegistration() {
  for (const id of ['firstName','lastName','email','phone','password','age-confirmed','terms','privacy-acknowledged','marketing-requested']) {
    expect(document.getElementById(id)).toBeInTheDocument();
  }
  expect(document.querySelector('form')).toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:'Демонстрационный режим'})).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/register');
}

test.each(['RU','EN','DE','FR'] as const)('direct registration renders the real form in demo preview: %s', lang => {
  localStorage.setItem('lang',lang.toLowerCase()); open('/register'); expectRegistration();
  expect(screen.getByText(translations[lang].registrationLegal.age)).toBeInTheDocument();
});
test('a fresh mount at the same URL preserves route selection', () => {
  const view = open('/register'); expectRegistration(); view.unmount();
  open('/register'); expectRegistration();
});
test('forum -> header login -> registration renders the form without demo substitution', async () => {
  open('/forum');
  fireEvent.click(screen.getByRole('button',{name:'Вход / Регистрация'}));
  expect(window.location.pathname).toBe('/login');
  fireEvent.click(screen.getByRole('link',{name:'Регистрация'}));
  expectRegistration();
  await waitFor(()=>expect(global.fetch).toHaveBeenCalled());
  expect((global.fetch as jest.Mock).mock.calls.every(([,init]) => !init?.method || init.method === 'GET')).toBe(true);
});
test.each(['/forum/reviews/new'])('demo restrictions remain on %s', path => {
  open(path);
  expect(screen.getByRole('heading',{name:'Демонстрационный режим'})).toBeInTheDocument();
  expect(document.getElementById('firstName')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe(path);
});
test('moderation policy is public in demo mode without activating moderation tools', () => {
  open('/forum/moderation');
  expect(screen.getByRole('heading',{name:'Модерация, уведомления и апелляции'})).toBeInTheDocument();
  expect(document.querySelectorAll('details')).toHaveLength(16);
  expect(screen.getByText('Инструменты модерации недоступны в демонстрационном режиме.')).toBeInTheDocument();
  expect(document.querySelector('textarea')).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/forum/moderation');
  expect((global.fetch as jest.Mock).mock.calls.some(([url])=>String(url).includes('/forum/moderation/'))).toBe(false);
});
test('protected profile still redirects anonymous visitors to registration', async () => {
  open('/profile'); await waitFor(expectRegistration);
});
test('the normal non-demo registration route also remains available', () => {
  process.env.REACT_APP_DEMO_ONLY = 'false'; open('/register'); expectRegistration();
});
