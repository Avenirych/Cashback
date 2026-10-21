import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import SiteSearch from './SiteSearch';

let mockLanguage='en';
jest.mock('../context/LanguageContext',()=>({useLang:()=>({lang:mockLanguage})}));
const documentPage={path:'/privacy',title:'Политика',titleEn:'Privacy',text:'retention marker <img src=x onerror=alert(1)>'};
function Location(){return <span data-testid="location">{useLocation().pathname+useLocation().search}</span>;}
function setup(query='privacy'){return render(<MemoryRouter initialEntries={['/search?q='+encodeURIComponent(query)]}><SiteSearch resultsPage/><Location/></MemoryRouter>);}
beforeEach(()=>{mockLanguage='en';global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>[documentPage]});});

test('indexed text remains text and result navigation stays internal',async()=>{
 const view=setup('retention');const link=await screen.findByRole('link',{name:/Privacy/});
 expect(view.container.querySelector('img')).toBeNull();expect(link).toHaveTextContent('<img');
 fireEvent.click(link);expect(screen.getByTestId('location')).toHaveTextContent('/privacy');
});
test.each(['https://example.test','//example.test','javascript:alert(1)','/profile','/auth/profile','/forum/topic/private','/privacy?token=secret'])('rejects unsafe or nonpublic indexed route %s',async path=>{
 (fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>[{...documentPage,path,text:'uniquesensitiveword'}]});
 setup('uniquesensitiveword');await waitFor(()=>expect(fetch).toHaveBeenCalled());
 expect(screen.queryByRole('link')).not.toBeInTheDocument();expect(screen.getByText('No results found')).toBeInTheDocument();
});
test.each([null,{},[null,{},false,{...documentPage,titleEn:null}]])('malformed index preserves safe fallback sections %#',async data=>{
 const warning=jest.spyOn(console,'warn').mockImplementation(()=>{});
 try {(fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>data});setup('privacy');
 expect(await screen.findByRole('link',{name:/Privacy policy/})).toHaveAttribute('href','/privacy');
 await waitFor(()=>expect(fetch).toHaveBeenCalled());} finally {warning.mockRestore();}
});
test.each(['http','json','network'])('unavailable index retains document links: %s',async mode=>{
 const warning=jest.spyOn(console,'warn').mockImplementation(()=>{});
 try {(fetch as jest.Mock).mockImplementation(async()=>{
  if(mode==='network')throw Error('offline');
  return {ok:mode!=='http',status:503,json:async()=>{throw Error('invalid json');}};
 });setup('cookies');expect(await screen.findByRole('link',{name:/Cookie Policy/})).toHaveAttribute('href','/cookies');
 await waitFor(()=>expect(warning).toHaveBeenCalled());} finally {warning.mockRestore();}
});
test('duplicate indexed routes retain a single safe link and document content',async()=>{
 (fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>[documentPage,documentPage]});setup('retention');
 await screen.findByRole('link',{name:/Privacy/});expect(screen.getAllByRole('link')).toHaveLength(1);
});
test.each([['ru','Найти'],['en','Search']])('preserves indexed language and editable query %s',(language,button)=>{
 mockLanguage=language;setup();expect(screen.getByRole('button',{name:button})).toBeInTheDocument();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'  retention  '}});
 fireEvent.submit(screen.getByRole('searchbox').closest('form')!);
 expect(screen.getByTestId('location')).toHaveTextContent('/search?q=retention');
 expect(screen.getByRole('searchbox')).toHaveValue('retention');
});
