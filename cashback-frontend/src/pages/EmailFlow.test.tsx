import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import VerifyEmail from './VerifyEmail';
import Register from './Register';
import * as mailbox from '../localTestMailbox';
import {useAuth} from '../context/AuthContext';
jest.mock('../context/AuthContext',()=>({useAuth:jest.fn()}));
const mockUseAuth=useAuth as jest.Mock;
let auth:any;
beforeEach(()=>{sessionStorage.clear();auth={user:{id:1,email:'buyer@example.test',email_verified:false},loading:false,register:jest.fn(),verifyEmail:jest.fn().mockResolvedValue(undefined),resendVerification:jest.fn().mockResolvedValue({message:'generic'}),checkVerification:jest.fn().mockResolvedValue(false)};mockUseAuth.mockImplementation(()=>auth);});
function verify(url='/verify-email?token='+ 'a'.repeat(64)){return render(<MemoryRouter initialEntries={[url]}><VerifyEmail lang="ru" /></MemoryRouter>);}
test('valid link verifies once under StrictMode and provides real profile link',async()=>{render(<React.StrictMode><MemoryRouter initialEntries={['/verify-email?token='+ 'a'.repeat(64)]}><VerifyEmail lang="ru"/></MemoryRouter></React.StrictMode>);await screen.findByText('Электронная почта подтверждена!');expect(auth.verifyEmail).toHaveBeenCalledTimes(1);expect(screen.getByRole('link',{name:'Перейти в профиль'})).toHaveAttribute('href','/profile');});
test('invalid/expired/reused response never grants profile and allows resend',async()=>{auth.verifyEmail.mockRejectedValue(new Error('invalid'));verify();await screen.findByRole('alert');expect(screen.queryByText('Электронная почта подтверждена!')).not.toBeInTheDocument();fireEvent.change(screen.getByLabelText('Электронная почта'),{target:{value:'buyer@example.test'}});fireEvent.click(screen.getByText('Отправить письмо ещё раз'));await waitFor(()=>expect(auth.resendVerification).toHaveBeenCalledWith('buyer@example.test'));});
test('original registration tab checks server and only then shows verified state',async()=>{const view=render(<MemoryRouter><Register lang="RU" onLangChange={()=>{}} /></MemoryRouter>);fireEvent.click(screen.getByText('Проверить почту'));await screen.findByText(/Почта ещё не подтверждена/);expect(screen.queryByText('Электронная почта подтверждена!')).not.toBeInTheDocument();auth.user={...auth.user,email_verified:true};auth.checkVerification.mockResolvedValue(true);fireEvent.click(screen.getByText('Проверить почту'));await waitFor(()=>expect(auth.checkVerification).toHaveBeenCalledTimes(2));view.rerender(<MemoryRouter><Register lang="RU" onLangChange={()=>{}} /></MemoryRouter>);expect(screen.getByText('Электронная почта подтверждена!')).toBeInTheDocument();expect(screen.getByRole('link',{name:'Перейти в профиль'})).toHaveAttribute('href','/profile');expect(screen.queryByText(/Mailpit/)).not.toBeInTheDocument();});
test('failed server check never declares success',async()=>{auth.checkVerification.mockRejectedValue(new Error('offline'));verify('/verify-email');fireEvent.click(screen.getByText('Проверить почту'));await screen.findByText(/Не удалось выполнить запрос/);expect(screen.queryByText('Электронная почта подтверждена!')).not.toBeInTheDocument();});

test('pending registration prominently exposes local test inbox only with exact development guard',()=>{
 const guard=jest.spyOn(mailbox,'localTestMailboxEnabled').mockReturnValue(true);
 const view=render(<MemoryRouter><Register lang="RU" onLangChange={()=>{}} /></MemoryRouter>);
 expect(screen.getByRole('heading',{name:'Подтвердите электронную почту'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Открыть тестовую почту'})).toHaveAttribute('href','http://127.0.0.1:8036/');
 expect(screen.getByText(/не приходят в ваш обычный ящик/)).toBeInTheDocument();
 guard.mockReturnValue(false);view.rerender(<MemoryRouter><Register lang="RU" onLangChange={()=>{}} /></MemoryRouter>);
 expect(screen.queryByRole('link',{name:'Открыть тестовую почту'})).not.toBeInTheDocument();guard.mockRestore();
});
test.each([
 ['development','http://localhost:3004','http://127.0.0.1:3006',true],
 ['production','http://localhost:3004','http://127.0.0.1:3006',false],
 ['test','http://localhost:3004','http://127.0.0.1:3006',false],
 ['development','http://localhost:3003','http://127.0.0.1:3006',false],
 ['development','https://cashback.example','http://127.0.0.1:3006',false],
 ['development','http://localhost:3004','http://localhost:3001',false],
])('mailbox guard fails closed: %s %s %s', (mode,origin,api,expected)=>expect(mailbox.localTestMailboxEnabled(mode as any,origin as string,api as string)).toBe(expected));

test('successful form submission switches immediately to prominent confirmation instructions',async()=>{
 auth.user=null;auth.register.mockResolvedValue({verification_email_sent:true});
 const guard=jest.spyOn(mailbox,'localTestMailboxEnabled').mockReturnValue(true);
 render(<MemoryRouter><Register lang="RU" onLangChange={()=>{}} /></MemoryRouter>);
 fireEvent.change(screen.getByLabelText('Имя'),{target:{value:'Test'}});
 fireEvent.change(screen.getByLabelText('Фамилия'),{target:{value:'Buyer'}});
 fireEvent.change(screen.getByLabelText('Телефон'),{target:{value:'02079460123'}});
 fireEvent.change(screen.getByLabelText('Email'),{target:{value:'buyer@example.test'}});
 fireEvent.change(screen.getByLabelText('Пароль'),{target:{value:'Synthetic-password8!'}});
 for (const id of ['age-confirmed','terms','privacy-acknowledged']) fireEvent.click(document.getElementById(id)!);
 fireEvent.click(screen.getByRole('button',{name:'Регистрация'}));
 await screen.findByRole('heading',{name:'Подтвердите электронную почту'});
 expect(auth.register).toHaveBeenCalledWith({name:'Test Buyer',firstName:'Test',lastName:'Buyer',phone_e164:'+442079460123',email:'buyer@example.test',password:'Synthetic-password8!'});
 expect(screen.getByText(/Мы отправили ссылку для подтверждения/)).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Открыть тестовую почту'})).toBeInTheDocument();
 expect(screen.queryByText('Электронная почта подтверждена!')).not.toBeInTheDocument();guard.mockRestore();
});
