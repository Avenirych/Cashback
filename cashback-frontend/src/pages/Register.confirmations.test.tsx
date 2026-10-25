import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Register from './Register';
import {translations} from '../i18n';

let mockRegister = jest.fn();
jest.mock('../context/AuthContext', () => ({useAuth: () => ({
  user: null, loading: false, register: mockRegister,
})}));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  mockRegister = jest.fn().mockResolvedValue({verification_email_sent: true});
});
function mount(lang = 'RU') {
  return render(<MemoryRouter><Register lang={lang} onLangChange={() => {}} /></MemoryRouter>);
}
function validFields() {
  for (const [id, value] of [['firstName','Demo'], ['lastName','Buyer'],
    ['email','demo@example.test'], ['phone','02079460123'], ['password','Strong8!Demo']]) {
    fireEvent.change(document.getElementById(id)!, {target: {value}});
  }
}
const ids = ['age-confirmed', 'terms', 'privacy-acknowledged'];
function confirm(mask: number) {
  ids.forEach((id, index) => { if (mask & (1 << index)) fireEvent.click(document.getElementById(id)!); });
}

test.each([0,1,2,3,4,5,6,7])('submit-handler enforcement for mandatory mask %i', async mask => {
  mount(); validFields(); confirm(mask);
  expect(screen.getByRole('button', {name: 'Регистрация'}).hasAttribute('disabled')).toBe(mask !== 7);
  // Direct submit deliberately bypasses the disabled button and native validation.
  fireEvent.submit(document.querySelector('form')!);
  if (mask === 7) {
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockRegister).toHaveBeenCalledWith({name:'Demo Buyer', firstName:'Demo', lastName:'Buyer',
      phone_e164:'+442079460123', email:'demo@example.test', password:'Strong8!Demo'});
    await screen.findByRole('heading', {name:'Подтвердите электронную почту'});
  } else {
    expect(mockRegister).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  }
});

test.each([false,true])('marketing %s neither blocks nor changes the registration payload', async selected => {
  mount(); validFields(); confirm(7);
  const marketing = document.getElementById('marketing-requested') as HTMLInputElement;
  expect(marketing).not.toBeChecked(); expect(marketing).not.toBeRequired();
  if (selected) fireEvent.click(marketing);
  ids.forEach(id => expect(document.getElementById(id)).toBeChecked());
  expect(screen.getByText(translations.RU.registrationLegal.notSaved)).toBeInTheDocument();
  fireEvent.submit(document.querySelector('form')!);
  await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
  expect(Object.keys(mockRegister.mock.calls[0][0]).sort()).toEqual(['email','firstName','lastName','name','password','phone_e164']);
  await screen.findByRole('heading', {name:'Подтвердите электронную почту'});
  if (selected) expect(screen.getByText(translations.RU.registrationLegal.notSaved)).toBeInTheDocument();
});

test.each([0,7])('Enter respects mandatory confirmations for mask %i', async mask => {
  mount(); validFields(); confirm(mask);
  userEvent.type(document.getElementById('password')!, '{enter}');
  if (mask === 7) {
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    await screen.findByRole('heading', {name:'Подтвердите электронную почту'});
  } else expect(mockRegister).not.toHaveBeenCalled();
});

test('defaults and marketing are independent; legal links do not toggle confirmations', () => {
  mount();
  screen.getAllByRole('checkbox').forEach(input => expect(input).not.toBeChecked());
  fireEvent.click(document.getElementById('marketing-requested')!);
  ids.forEach(id => expect(document.getElementById(id)).not.toBeChecked());
  for (const [id, path] of [['terms','/terms'], ['privacy-acknowledged','/privacy']]) {
    const link = document.querySelector(`label[for="${id}"] a`)!;
    expect(link).toHaveAttribute('href',path); expect(link).toHaveAttribute('target','_blank');
    fireEvent.click(link); expect(document.getElementById(id)).not.toBeChecked();
    fireEvent.click(document.getElementById(id)!); fireEvent.click(link);
    expect(document.getElementById(id)).toBeChecked();
  }
});

test.each(['RU','EN','DE','FR'] as const)('new content is localized in %s and phone remains mandatory', lang => {
  mount(lang); const t = translations[lang].registrationLegal;
  for (const key of ['mandatory','optional','age','marketing','withdraw','notSaved','nature','accuracy','rewards'] as const) {
    expect(screen.getByText(t[key])).toBeInTheDocument();
  }
  ids.forEach(id => expect(document.getElementById(id)).toBeRequired());
  expect(document.getElementById('phone')).toBeRequired();
  expect(document.querySelector('label[for="terms"]')).toHaveTextContent(t.termsBefore+t.termsLink+t.termsAfter);
  expect(document.querySelector('label[for="privacy-acknowledged"]')).toHaveTextContent(t.privacyBefore+t.privacyLink+t.privacyAfter);
  expect(document.querySelector('a[href="/privacy"]')).toBeInTheDocument();
});

test.each([['firstName','X'],['lastName','X'],['phone','123'],['password','weak'],['email','invalid']])(
  'existing %s validation still prevents direct submission', (id,value) => {
    mount(); validFields(); confirm(7);
    fireEvent.change(document.getElementById(id)!, {target:{value}});
    fireEvent.submit(document.querySelector('form')!);
    expect(mockRegister).not.toHaveBeenCalled();
  }
);

test('server error is preserved, busy blocks repeated submission and allows retry', async () => {
  let reject!: (reason: Error) => void;
  mockRegister.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  mount(); validFields(); confirm(7);
  const form = document.querySelector('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mockRegister).toHaveBeenCalledTimes(1);
  expect(document.getElementById('terms')).toBeDisabled();
  reject(new Error('Email already registered'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Email already registered');
  await waitFor(() => expect(screen.getByRole('button',{name:'Регистрация'})).toBeEnabled());
});


test.each([['DE','Vorname','Nachname','Telefon','Passwortstärke'],['FR','Prénom','Nom','Téléphone','Robustesse du mot de passe']])('existing form labels are translated in %s',(lang,first,last,phone,strength)=>{
 mount(lang); expect(screen.getByRole('textbox',{name:first})).toBeRequired(); expect(screen.getByRole('textbox',{name:last})).toBeRequired(); expect(screen.getByRole('textbox',{name:phone})).toBeRequired(); expect(screen.getByText(new RegExp(strength))).toBeInTheDocument(); expect(document.querySelector('a[href="/privacy#privacySection5"]')).toBeInTheDocument();
});
