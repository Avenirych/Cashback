import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import Login from './Login';
import messages from '../content/loginMessages.json';
import {LoginFailure} from '../loginErrors';
let mockLogin=jest.fn();
let mockPending=false;
jest.mock('../context/AuthContext',()=>({useAuth:()=>({login:mockLogin,isEmailVerificationPending:mockPending})}));
jest.mock('../components/MoneyTree',()=>()=>null);
beforeEach(()=>{mockLogin=jest.fn().mockResolvedValue(undefined);mockPending=false;});
function mount(lang='ru',path='/login'){return render(<MemoryRouter initialEntries={[path]}><Routes>
 <Route path='/login' element={<Login lang={lang} onLangChange={()=>{}}/>}/>
 <Route path='/' element={<p>Home destination</p>}/><Route path='/forum' element={<p>Forum destination</p>}/>
 <Route path='/forum/reviews/new' element={<p>Review destination</p>}/><Route path='/verify-email' element={<p>Verification destination</p>}/>
 </Routes></MemoryRouter>);}
function fill(lang:keyof typeof messages='ru'){fireEvent.change(screen.getByLabelText(messages[lang].email),{target:{value:'buyer@example.test'}});fireEvent.change(screen.getByLabelText(messages[lang].password),{target:{value:'old-password'}});}
test.each(['ru','en','de','fr']as const)('%s complete copy, labels, autocomplete, genuine links and no fake reset route',lang=>{
 const v=mount(lang.toUpperCase()),t=messages[lang];expect(screen.getByRole('heading',{level:1})).toHaveTextContent(t.title);
 for(const text of [t.intro,t.forgot,t.recoveryUnavailable,t.securityTitle,t.security,t.attempts,t.importantTitle,t.important,t.age])expect(v.container).toHaveTextContent(text);
 expect(screen.getByRole('link',{name:t.register})).toHaveAttribute('href','/register');expect(screen.getByRole('link',{name:t.privacyLink})).toHaveAttribute('href','/privacy');expect(screen.getByRole('link',{name:t.contacts})).toHaveAttribute('href','/contacts');
 expect(screen.queryByRole('link',{name:t.forgot})).not.toBeInTheDocument();expect(screen.getByLabelText(t.email)).toHaveAttribute('autocomplete','email');expect(screen.getByLabelText(t.password)).toHaveAttribute('autocomplete','current-password');expect(screen.getByRole('button',{name:t.submit})).toBeDisabled();
 if(lang!=='ru')expect(v.container.textContent).not.toMatch(/[А-Яа-яЁё]/);
});
test('existing email validation prevents requests and localizes errors',()=>{mount('de');fireEvent.change(screen.getByLabelText(messages.de.email),{target:{value:'a..b@example.test'}});expect(screen.getByRole('alert')).toHaveTextContent(messages.de.errors.email);fireEvent.submit(document.querySelector('form')!);expect(mockLogin).not.toHaveBeenCalled();});
test.each(['ru','en','de','fr']as const)('%s credential, network, rate and server errors are distinct and safely localized',async lang=>{
 mount(lang);fill(lang);for(const kind of ['credentials','limited','network','server','unknown']as const){mockLogin.mockRejectedValueOnce(new LoginFailure(kind));fireEvent.submit(document.querySelector('form')!);const alert=await screen.findByRole('alert');await waitFor(()=>expect(alert).toHaveTextContent(messages[lang].errors[kind]));expect(alert).toHaveFocus();}
});
test('arbitrary backend/internal details are never rendered or logged',async()=>{const log=jest.spyOn(console,'error').mockImplementation(()=>{});mockLogin.mockRejectedValue(new Error('User not found; SQL password=private'));const v=mount();fill();fireEvent.submit(document.querySelector('form')!);expect(await screen.findByRole('alert')).toHaveTextContent(messages.ru.errors.unknown);expect(v.container).not.toHaveTextContent(/User not found|SQL|private/);expect(log).not.toHaveBeenCalled();log.mockRestore();});
test('loading prevents duplicate requests and passes the original payload unchanged',async()=>{let finish!:()=>void;mockLogin.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve}));mount();fill();fireEvent.submit(document.querySelector('form')!);fireEvent.submit(document.querySelector('form')!);expect(mockLogin).toHaveBeenCalledTimes(1);expect(mockLogin).toHaveBeenCalledWith({email:'buyer@example.test',password:'old-password'});expect(screen.getByRole('button',{name:messages.ru.loading})).toBeDisabled();expect(screen.getByLabelText(messages.ru.password)).toBeDisabled();finish();await screen.findByText('Home destination');});
test('keyboard reaches labelled fields and Enter submits',async()=>{mount();screen.getByLabelText(messages.ru.email).focus();userEvent.type(screen.getByLabelText(messages.ru.email),'buyer@example.test');userEvent.tab();expect(screen.getByLabelText(messages.ru.password)).toHaveFocus();userEvent.type(screen.getByLabelText(messages.ru.password),'old-password{enter}');await screen.findByText('Home destination');expect(mockLogin).toHaveBeenCalledTimes(1);});
test.each([['/forum','Forum destination'],['/forum/reviews/new','Review destination'],['https://evil.example','Home destination'],['//evil.example','Home destination']])('safe return %s',async(next,destination)=>{mount('ru','/login?next='+encodeURIComponent(next));fill();fireEvent.submit(document.querySelector('form')!);await screen.findByText(destination);});
test('unverified login uses the existing email verification page',async()=>{mockLogin.mockImplementation(async()=>{mockPending=true});mount();fill();fireEvent.submit(document.querySelector('form')!);await screen.findByText('Verification destination');});
