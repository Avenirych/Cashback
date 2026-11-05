// Imported before App: remove the capability before any application rendering.
// No storage, history state, logging, network request, or automatic consume.
let captured:string|null=null;
export function captureRecoveryToken():string|null{
 if(typeof window==='undefined'||window.location.pathname!=='/reset-password')return captured;
 const url=new URL(window.location.href);
 if(url.search||url.hash){
  const values=url.searchParams.getAll('token');
  captured=values.length===1&&/^[a-f0-9]{64}$/.test(values[0])?values[0]:null;
  try{window.history.replaceState(null,'','/reset-password');}
  catch{captured=null;throw new Error('RECOVERY_URL_CLEANUP_FAILED');}
 }
 return captured;
}
export const clearRecoveryToken=()=>{captured=null;};
captureRecoveryToken();
