import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the public Cashback+ home route with navigation', async () => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  localStorage.setItem('lang', 'en');
  // The only external read on the guest page is the optional static search index.
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] }) as typeof fetch;
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Smart shopping with Cashback+' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Go shopping' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Get bonuses' })).toBeEnabled();
  expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop');
  expect(screen.getByRole('search')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});
