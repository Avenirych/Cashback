import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import ProtectedGuard from '../components/ProtectedGuard';
import Login from './Login';
import VerifyEmail from './VerifyEmail';

const user = {id: 301, email: 'synthetic@example.test', name: 'Synthetic', email_verified: true};
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

function mount(path: string) {
  render(<React.StrictMode><AuthProvider><MemoryRouter initialEntries={[path]}><Routes>
    <Route path='/login' element={<Login lang='EN' onLangChange={() => {}} />} />
    <Route path='/verify-email' element={<VerifyEmail lang='EN' />} />
    <Route path='/register' element={<p>Registration</p>} />
    <Route element={<ProtectedGuard />}><Route path='/profile' element={<p>Verified profile</p>} /></Route>
  </Routes></MemoryRouter></AuthProvider></React.StrictMode>);
}

function mockApi() {
  global.fetch = jest.fn(async (url) => {
    const data = String(url).endsWith('/forum/status') ? {registered: false} : {access_token: 'synthetic', user};
    return {ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data};
  }) as jest.Mock;
}

test('verified login opens the protected profile', async () => {
  mockApi(); mount('/login');
  fireEvent.change(screen.getByLabelText('Email'), {target: {value: user.email}});
  fireEvent.change(screen.getByLabelText('Password'), {target: {value: 'Synthetic1!'}});
  fireEvent.submit(screen.getByLabelText('Password').closest('form')!);
  expect(await screen.findByText('Verified profile')).toBeInTheDocument();
});

test('email link verifies once in StrictMode and allows opening profile', async () => {
  mockApi(); mount('/verify-email?token=synthetic-token');
  expect(await screen.findByText('Your email has been verified. Thank you!')).toBeInTheDocument();
  expect((fetch as jest.Mock).mock.calls.filter(([url]) => String(url).includes('/auth/verify-email?token=synthetic-token'))).toHaveLength(1);
  fireEvent.click(screen.getByRole('link', {name: 'Open profile'}));
  expect(await screen.findByText('Verified profile')).toBeInTheDocument();
});
