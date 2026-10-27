import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Register from './Register';
let mockLocal=false;
const mockCheck=jest.fn();
jest.mock('../localTestMailbox',()=>({localTestMailboxEnabled:()=>mockLocal,LOCAL_TEST_MAILBOX_URL:'http://127.0.0.1:8036/'}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:null,loading:false,checkVerification:mockCheck})}));
const labels={
 RU:['Проверить почту','Проверить подтверждение','Откройте свой почтовый ящик'],
 EN:['Check email','Check verification','Open your inbox'],
 DE:['E-Mail prüfen','Bestätigung prüfen','Öffnen Sie Ihr Postfach'],
 FR:['Vérifier l’adresse électronique','Vérifier la confirmation','Ouvrez votre boîte de réception']
};
beforeEach(()=>{
 localStorage.clear();sessionStorage.clear();mockLocal=false;mockCheck.mockResolvedValue(false);
 sessionStorage.setItem('cashback_pending_verification',JSON.stringify({email:'fixture@example.test',verification_email_sent:true}));
});
function mount(lang:string){return render(<MemoryRouter><Register lang={lang} onLangChange={()=>{}}/></MemoryRouter>);}
test.each(Object.keys(labels))('development %s opens the mailbox in a separate protected tab',lang=>{
 mockLocal=true;mount(lang);
 const [mail,status]=labels[lang as keyof typeof labels];
 const link=screen.getByRole('link',{name:mail});
 expect(link).toHaveAttribute('href','http://127.0.0.1:8036/');
 expect(link).toHaveAttribute('target','_blank');
 expect(link).toHaveAttribute('rel','noopener noreferrer');
 expect(document.querySelectorAll('a[href="http://127.0.0.1:8036/"]')).toHaveLength(1);
 expect(screen.getByRole('button',{name:status})).toBeEnabled();
 expect(mockCheck).not.toHaveBeenCalled();
});
test.each(Object.keys(labels))('production %s explains how to open the real inbox without a technical address',lang=>{
 mount(lang);const [mail,,instruction]=labels[lang as keyof typeof labels];
 expect(document.body.textContent).not.toMatch(/Mailpit|8036|127\.0\.0\.1|localhost/);
 expect(document.querySelector('a[href*="8036"]')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:mail}));
 expect(screen.getByRole('status')).toHaveTextContent(instruction);
 expect(mockCheck).not.toHaveBeenCalled();
});
test('the separate status action still queries verification and never assumes success',async()=>{
 mount('RU');fireEvent.click(screen.getByRole('button',{name:'Проверить подтверждение'}));
 await waitFor(()=>expect(mockCheck).toHaveBeenCalledTimes(1));
 expect(await screen.findByText('Почта ещё не подтверждена. Откройте письмо и нажмите ссылку подтверждения.')).toBeInTheDocument();
});
test('status errors remain visible and retry is enabled',async()=>{
 mockCheck.mockRejectedValueOnce(new Error('offline'));mount('EN');
 fireEvent.click(screen.getByRole('button',{name:'Check verification'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Could not check verification.');
 expect(screen.getByRole('button',{name:'Check verification'})).toBeEnabled();
});
