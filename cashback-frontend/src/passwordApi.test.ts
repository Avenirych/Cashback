import {passwordRequest,PasswordFailure,passwordText,validNewPassword} from './passwordApi';
const reply=(status:number)=>({status} as Response);
beforeEach(()=>{global.fetch=jest.fn() as jest.Mock;});
test('request accepts neutral202 without reading server body or leaking existence',async()=>{(fetch as jest.Mock).mockResolvedValue(reply(202));await passwordRequest('request',{email:'unknown@example.invalid',locale:'en'});expect((fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/auth\/password-reset\/request$/);expect((fetch as jest.Mock).mock.calls[0][1].referrerPolicy).toBe('no-referrer');});
test('204 is required for confirmation',async()=>{(fetch as jest.Mock).mockResolvedValue(reply(204));await expect(passwordRequest('confirm',{newPassword:'Replacement!123'})).resolves.toBeUndefined();});
test('invalid link is mapped without reading a sensitive error body',async()=>{(fetch as jest.Mock).mockResolvedValue(reply(400));await expect(passwordRequest('confirm',{})).rejects.toMatchObject({kind:'invalid'});});
test('network error has an uncertain outcome and no automatic retry',async()=>{(fetch as jest.Mock).mockRejectedValue(new TypeError('offline'));await expect(passwordRequest('change',{},'synthetic-session')).rejects.toMatchObject({kind:'uncertain'});expect(fetch).toHaveBeenCalledTimes(1);});
test('change carries existing bearer and no cookies',async()=>{(fetch as jest.Mock).mockResolvedValue(reply(204));await passwordRequest('change',{},'synthetic-session');expect((fetch as jest.Mock).mock.calls[0][1]).toMatchObject({headers:{Authorization:'Bearer synthetic-session'},credentials:'omit',cache:'no-store',redirect:'error'});});
test('429 stays a rate error',async()=>{(fetch as jest.Mock).mockResolvedValue(reply(429));await expect(passwordRequest('request',{})).rejects.toBeInstanceOf(PasswordFailure);});
test('password policy and byte bound match new-password backend policy',()=>{expect(validNewPassword('Replacement!123')).toBe(true);expect(validNewPassword('weak')).toBe(false);expect(validNewPassword('Aa1!'+ 'é'.repeat(35))).toBe(false);});
test.each(['ru','en','de','fr'])('complete locale keys: %s',lang=>{expect(Object.keys(passwordText(lang)).sort()).toEqual(Object.keys(passwordText('en')).sort());expect(Object.values(passwordText(lang)).every(v=>typeof v==='string'&&v.length>0)).toBe(true);});

test('deadline aborts one request without retrying',async()=>{
 jest.useFakeTimers();
 try{
  (fetch as jest.Mock).mockImplementation((_url,init)=>new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new Error('aborted')));}));
  const result=passwordRequest('change',{},'synthetic-session').catch(e=>e);
  jest.advanceTimersByTime(15000);
  expect((await result).kind).toBe('uncertain');expect(fetch).toHaveBeenCalledTimes(1);
 }finally{jest.useRealTimers();}
});
