import React from 'react';
import {fireEvent, render, screen, within, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {LanguageProvider} from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ForumRules, {forumRules, rulesLabels} from './ForumRules';
import ForumRegister from './ForumRegister';
import {useAuth} from '../context/AuthContext';
jest.mock('../context/AuthContext', () => ({useAuth: jest.fn()}));
const codes = ['ru', 'en', 'de', 'fr'] as const;
beforeEach(() => {
  localStorage.clear();
  (useAuth as jest.Mock).mockReturnValue({user: {id: 1, email: 'buyer@example.invalid', name: 'Buyer', email_verified: true}, forumLoading: false, registerForum: jest.fn(), checkForumStatus: jest.fn()});
  global.fetch = jest.fn();
});
function mount(language: string, registration = false) {
  localStorage.setItem('lang', language);
  return render(<LanguageProvider><MemoryRouter><LanguageSwitcher />{registration ? <ForumRegister /> : <ForumRules />}</MemoryRouter></LanguageProvider>);
}
test.each(codes)('%s renders one complete document, thirteen initially collapsed topics and no duplicate bodies', async code => {
  const view = mount(code);
  expect(screen.getByRole('heading', {name: rulesLabels[code].title})).toBeInTheDocument();
  const sections = view.container.querySelectorAll('details');
  expect(sections).toHaveLength(13);
  sections.forEach(section => expect(section.open).toBe(false));
  for (const [heading, body] of forumRules[code]) {
    expect(screen.getAllByText(heading)).toHaveLength(1);
    expect(screen.getAllByText(body)).toHaveLength(1);
    expect(screen.getByText(body)).not.toBeVisible();
  }
  for (const other of codes.filter(x => x !== code)) {
    for (const [heading, body] of forumRules[other]) {
      // Some correctly translated headings (e.g. EN/DE "Moderation") coincide.
      if (!forumRules[code].some(s => s[0] === heading)) expect(screen.queryByText(heading)).not.toBeInTheDocument();
      expect(screen.queryByText(body)).not.toBeInTheDocument();
    }
  }
  fireEvent.click(within(sections[0] as HTMLElement).getByText(forumRules[code][0][0]));
  await waitFor(() => expect(sections[0].open).toBe(true));
  expect(screen.getByText(forumRules[code][0][1])).toBeVisible();
  fireEvent.click(within(sections[0] as HTMLElement).getByText(forumRules[code][0][0]));
  await waitFor(() => expect(sections[0].open).toBe(false));
  expect(fetch).not.toHaveBeenCalled();
});
test('existing global switcher changes every heading/body without reloading and collapses open topics', () => {
  const view = mount('ru');
  for (const code of codes) {
    const first = view.container.querySelector('details')!;
    first.open = true;
    fireEvent.change(screen.getByRole('combobox'), {target: {value: code}});
    expect(screen.getByRole('heading', {name: rulesLabels[code].title})).toBeInTheDocument();
    for (const [heading, body] of forumRules[code]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
      expect(screen.getByText(body)).toBeInTheDocument();
    }
    if (code !== 'ru') view.container.querySelectorAll('details').forEach(d => expect(d.open).toBe(false));
    expect(localStorage.getItem('lang')).toBe(code);
  }
});
test.each(codes)('%s registration displays exactly the same thirteen topics and keeps consent required and unchecked', code => {
  const view = mount(code, true);
  const rules = screen.getByRole('region', {name: rulesLabels[code].preview});
  for (const [heading, body] of forumRules[code]) {
    expect(within(rules).getAllByText(heading)).toHaveLength(1);
    expect(within(rules).getAllByText(body)).toHaveLength(1);
  }
  expect(view.container.querySelectorAll('details')).toHaveLength(13);
  const consent = screen.getByRole('checkbox', {name: rulesLabels[code].agree});
  expect(consent).toBeRequired(); expect(consent).not.toBeChecked();
  fireEvent.change(screen.getByRole('combobox'), {target: {value: codes[(codes.indexOf(code) + 1) % 4]}});
  expect(screen.getByRole('checkbox',{name:rulesLabels[codes[(codes.indexOf(code)+1)%4]].agree})).not.toBeChecked();
  expect((useAuth as jest.Mock).mock.results[0].value.registerForum).not.toHaveBeenCalled();
});
test('unsupported language never falls back to a different document', () => {
  const view = mount('es');
  expect(view.container.querySelector('details')).toBeNull();
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'DE'}));
  expect(screen.getByRole('heading', {name: 'Forenregeln'})).toBeInTheDocument();
});
