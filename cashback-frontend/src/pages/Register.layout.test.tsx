import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Register from './Register';
let mockUser:any=null;
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:mockUser,loading:false})}));
jest.mock('../components/MoneyTree',()=>()=> <div data-testid="money-tree"/>);
jest.mock('../components/MarketingPreferencesPanel',()=>()=> <><div data-testid="preferences">Preferences</div><p data-testid="preferences-note">Explanation</p><p data-testid="preferences-policy">Policy and SMS consent</p></>);
beforeEach(()=>{mockUser=null;sessionStorage.clear();localStorage.clear();});
test.each(['RU','EN','DE','FR'])('%s form remains inside shared form/tree layout without a premature preferences panel',lang=>{
 const v=render(<MemoryRouter><Register lang={lang} onLangChange={()=>{}}/></MemoryRouter>);
 const layout=v.container.querySelector('.register-layout')!;
 expect(layout.querySelector('.register-form')).not.toBeNull();
 expect(layout.querySelector('.register-illustration')).toContainElement(screen.getByTestId('money-tree'));
 expect(screen.queryByTestId('preferences')).toBeNull();
});
test.each(['RU','EN','DE','FR'])('%s pending account keeps every preferences fragment inside the shared full-width grid row after the tree',lang=>{
 mockUser={id:424242,email:'layout.fixture@example.test',email_verified:false,phone_e164:'+442079460123'};
 const v=render(<MemoryRouter><Register lang={lang} onLangChange={()=>{}}/></MemoryRouter>);
 const layout=v.container.querySelector('.register-layout')!,row=layout.querySelector<HTMLElement>('.register-marketing')!;
 expect(row).toBe(layout.lastElementChild);
 expect(row.previousElementSibling).toHaveClass('register-illustration');
 expect(v.container.querySelectorAll('.register-marketing')).toHaveLength(1);
 for(const id of ['preferences','preferences-note','preferences-policy'])expect(row).toContainElement(screen.getByTestId(id));
 expect(v.container.querySelector('.register-form-column')).not.toContainElement(row);
 expect(v.container.querySelector('.register-form')).toBeNull();
});
