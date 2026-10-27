import { registrationSecurityDigest as digest } from './docker-phone-registration-target';
export class AccessAdapterBlocked extends Error {constructor(readonly code:string){super('ACCESS_ADAPTER_BLOCKED:'+code);}}
export function adapterDeny(code:string):never {throw new AccessAdapterBlocked(code);}
export class ProductionSource {
  readonly provenance='production-adapter' as const;
  #listeners=new Set<()=>void>();#previous='';
  constructor(readonly sourceId:string){}
  onInvalidated(f:()=>void){this.#listeners.add(f);return ()=>{this.#listeners.delete(f);};}
  invalidate(){for(const f of this.#listeners){try{f();}catch{/* Remain invalidated. */}}}
  remember(value:unknown){const next=digest(value);if(this.#previous&&next!==this.#previous)this.invalidate();this.#previous=next;}
  async guarded<T>(signal:AbortSignal,work:(s:AbortSignal)=>Promise<T>):Promise<T>{
    const c=new AbortController(),abort=()=>c.abort();let timer:ReturnType<typeof setTimeout>|undefined;
    signal.addEventListener('abort',abort,{once:true});
    try{
      if(signal.aborted)adapterDeny('ABORTED');
      const result=await Promise.race([work(c.signal),new Promise<never>((_,reject)=>{
        timer=setTimeout(()=>{c.abort();reject(new AccessAdapterBlocked('ADAPTER_TIMEOUT'));},2500);
      })]);
      if(signal.aborted||c.signal.aborted)adapterDeny('ABORTED');return result;
    }catch(e){this.invalidate();throw e instanceof AccessAdapterBlocked?e:new AccessAdapterBlocked('TRANSPORT_OR_METADATA_FAILED');}
    finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);c.abort();}
  }
}
