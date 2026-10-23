import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import ModerationCenter from './ModerationCenter';
import messages from '../content/reviewMessages.json';
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:1,email_verified:true},token:'fixture'})}));
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:'en'})}));
test('restricted member can see reason and appeal without moderator access',async()=>{global.fetch=jest.fn().mockImplementation(async(url,options)=>{if(options?.method==='POST')return {ok:true};if(url.endsWith('/queue'))return {ok:false,status:403};return {ok:true,json:async()=>({restriction:{level:2,blocked:true,until:'2026-11-23'},cases:[{id:7,confirmed_at:'2026-10-23'}],notifications:[{id:1,case_id:7,action:'confirm',reason:'Detailed decision reason'}]})};});render(<MemoryRouter><ModerationCenter/></MemoryRouter>);expect(await screen.findByText(/Detailed decision reason/)).toBeVisible();const appeal=screen.getByRole('button',{name:messages.en.appeal});expect(appeal).toBeDisabled();fireEvent.change(screen.getByLabelText(messages.en.reason),{target:{value:'Please independently reconsider this decision'}});fireEvent.click(appeal);await waitFor(()=>expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/7/appeal'),expect.objectContaining({method:'POST'})));expect(screen.queryByText(messages.en.queue)).toBeNull();});
