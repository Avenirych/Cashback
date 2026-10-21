import React from 'react';
import {act,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import PhoneInput,{countryOptions} from './PhoneInput';
import {canonicalPhone} from '../utils/phone';
import {readDraft,saveDraft,DRAFT_KEY,passwordChecks} from '../utils/registrationDraft';
import Register from '../pages/Register';
let mockRegister=jest.fn(),mockUser:any=null;
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:mockUser,loading:false,register:mockRegister})}));
beforeEach(()=>{localStorage.clear();sessionStorage.clear();mockUser=null;mockRegister=jest.fn().mockResolvedValue({verification_email_sent:true});});
function Form(){return <MemoryRouter><Register lang="RU" onLangChange={()=>{}}/></MemoryRouter>}
test('registration has separate names, mandatory phone below email, UK flag/default and password feedback',()=>{render(<Form/>);expect(screen.getByRole('textbox',{name:'Имя'})).toBeRequired();expect(screen.getByRole('textbox',{name:'Фамилия'})).toBeRequired();expect(screen.getByRole('textbox',{name:'Телефон'})).toBeRequired();expect(screen.getByRole('combobox',{name:'Страна'})).toHaveTextContent('+44');expect(document.querySelector('img[src="/flags/gb.svg"]')).toBeInTheDocument();const password=document.querySelector<HTMLInputElement>('#password')!;expect(password.minLength).toBe(8);fireEvent.change(password,{target:{value:'Strong8!Demo'}});expect(screen.getByText(/Надёжность пароля/)).toHaveTextContent('5/5');});
test.each(['ru','en','de','fr'])('UK once at top, other countries sorted for %s',locale=>{const options=countryOptions(locale);expect(options[0].country).toBe('GB');expect(options.filter(x=>x.country==='GB')).toHaveLength(1);const names=options.slice(1).map(x=>x.name);expect(names).toEqual([...names].sort(new Intl.Collator(locale).compare));});
test('country name/code search keeps UK pinned and selection survives language switch',()=>{function Field({locale}:{locale:string}){const [country,setCountry]=React.useState<any>('GB');return <PhoneInput id="p" label="Phone" countryLabel="Country" value="" onChange={()=>{}} country={country} onCountry={setCountry} locale={locale}/>;}const v=render(<Field locale="en"/>);fireEvent.mouseDown(screen.getByRole('combobox'));fireEvent.change(screen.getByLabelText('Search countries'),{target:{value:'Germany'}});expect(screen.getAllByRole('option')).toHaveLength(2);fireEvent.click(screen.getByRole('option',{name:/Germany/}));v.rerender(<Field locale="ru"/>);expect(screen.getByRole('combobox')).toHaveTextContent('+49');fireEvent.mouseDown(screen.getByRole('combobox'));fireEvent.change(screen.getByLabelText('Поиск страны'),{target:{value:'+44'}});expect(screen.getAllByRole('option')[0]).toHaveTextContent('+44');});
test('draft stores only safe fields, restores country and never passwords',()=>{saveDraft({firstName:'Demo',lastName:'Buyer',email:'d@example.test',phone:'02079460123',country:'GB',password:'NEVER_SAVE',confirmation:'NEVER_SAVE'} as any);expect(localStorage.getItem(DRAFT_KEY)).not.toContain('NEVER_SAVE');expect(readDraft().firstName).toBe('Demo');render(<Form/>);expect(screen.getByRole('textbox',{name:'Имя'})).toHaveValue('Demo');expect(document.querySelector('#password')).toHaveValue('');});
test('successful registration sends separate names/E164 and clears draft without saving password',async()=>{render(<Form/>);act(()=>{fireEvent.change(screen.getByRole('textbox',{name:'Имя'}),{target:{value:'Demo'}});fireEvent.change(screen.getByRole('textbox',{name:'Фамилия'}),{target:{value:'Buyer'}});fireEvent.change(document.querySelector('#email')!,{target:{value:'demo@example.test'}});fireEvent.change(screen.getByRole('textbox',{name:'Телефон'}),{target:{value:'020 7946 0123'}});fireEvent.change(document.querySelector('#password')!,{target:{value:'Strong8!Demo'}});});fireEvent.click(screen.getByRole('checkbox'));fireEvent.submit(document.querySelector('form')!);await waitFor(()=>expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({firstName:'Demo',lastName:'Buyer',phone_e164:'+442079460123'})));await waitFor(()=>expect(localStorage.getItem(DRAFT_KEY)).toBeNull());expect(JSON.stringify({...localStorage,...sessionStorage})).not.toContain('Strong8!Demo');});
test('selected country validation and password min8',()=>{expect(canonicalPhone('02079460123','GB')).toBe('+442079460123');expect(canonicalPhone('123','GB')).toBeNull();expect(canonicalPhone('+12025550123','GB')).toBeNull();expect(passwordChecks('Aa1!xxx').every(Boolean)).toBe(false);expect(passwordChecks('Aa1!xxxx').every(Boolean)).toBe(true);});

test.each([['RU','Не менее 8 символов'],['EN','At least 8 characters']])('password hint matches the 8-character rule in %s',(lang,hint)=>{
 render(<MemoryRouter><Register lang={lang} onLangChange={()=>{}}/></MemoryRouter>);
 const input=screen.getByPlaceholderText(hint);expect(input).toHaveAttribute('minlength','8');
 expect(screen.getByText('○ '+hint)).toBeInTheDocument();
 expect(screen.queryByText(/min.? 3|мин.? 3/i)).not.toBeInTheDocument();
});
test('seven-character password cannot submit even with all other requirements satisfied',()=>{
 render(<Form/>);for(const [id,value] of [['firstName','Demo'],['lastName','Buyer'],['email','demo@example.test'],['phone','02079460123'],['password','Aa1!xxx']])fireEvent.change(document.getElementById(id)!,{target:{value}});
 fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByRole('button',{name:'Регистрация'})).toBeDisabled();
 fireEvent.submit(document.querySelector('form')!);expect(mockRegister).not.toHaveBeenCalled();
 expect(screen.getByText('○ Не менее 8 символов')).toBeInTheDocument();
});
