import {createHash,randomUUID} from 'node:crypto';
import type {DataSource,EntityManager} from 'typeorm';
import {FinanceEventsService} from './finance-events.service';
import type {Posting} from './ledger';
import {OWNER_POLICY} from './owner-policy';
import {POLICY_21} from './policy-2026-10-21';
export interface PolicyAuthority {
 /** Authenticates principal, authorizes exact action and returns independently
  * verified facts. No network I/O or public role/boolean authorization fallback. */
 verify(m:EntityManager,principal:string,action:string,reference:string):Promise<{actor:string;proof:string;facts:unknown}>;
}
export class DisabledPolicyAuthority implements PolicyAuthority {async verify():Promise<never>{throw Error('OWNER_POLICY_AUTHORITY_NOT_CONFIGURED');}}
export const json=(x:unknown)=>JSON.stringify(x,(_k,v:unknown)=>typeof v==='bigint'?v.toString():v);
export const digest=(x:unknown)=>createHash('sha256').update(json(x)).digest('hex');
export class PolicyContext {
 constructor(readonly source:DataSource,readonly events:FinanceEventsService,readonly authority:PolicyAuthority=new DisabledPolicyAuthority(),readonly policy:string=OWNER_POLICY){if(![OWNER_POLICY,POLICY_21].includes(policy))throw Error('Unknown approved policy');}
 async serverReceiptTime(m:EntityManager){
  const r=m?.queryRunner;if(m?.connection!==this.source||!r||r.connection!==this.source||r.manager!==m||r.isReleased||!r.isTransactionActive)throw Error('Active caller transaction required');
  return (await m.query('SELECT to_char(clock_timestamp() AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS t'))[0].t as string;
 }
 async enter<T>(m:EntityManager,principal:string,action:string,reference:string,related?:(facts:T)=>readonly string[]){
  const r=m?.queryRunner;if(m?.connection!==this.source||!r||r.connection!==this.source||r.manager!==m||r.isReleased||!r.isTransactionActive)throw Error('Active caller transaction required');
  const value=await this.authority.verify(m,principal,action,reference);
  for(const x of [value.actor,value.proof])if(typeof x!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(x))throw Error('Verified actor/proof required');
  // Snapshot before waiting: caller mutation cannot alter monetary facts.
  const facts=JSON.parse(json(value.facts)) as T;
  if(this.policy===POLICY_21)await m.query('SELECT pg_advisory_xact_lock(726405,0)');
  const actors=[...new Set([value.actor,...(related?related(facts):[])])].sort();
  for(const actor of actors){if(typeof actor!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(actor))throw Error('Verified related actor required');await m.query('SELECT pg_advisory_xact_lock(726411,hashtext($1))',[actor]);}
  return {actor:value.actor,proof:value.proof,facts};
 }
 async get(m:EntityManager,kind:string,scope:string,key:string){return (await m.query('SELECT payload,hash,journal,sequence,to_char("ingestedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS ingested FROM finance_policy_records WHERE kind=$1 AND scope=$2 AND key=$3',[kind,scope,key]))[0];}
 async record(m:EntityManager,kind:string,scope:string,key:string,payload:unknown,journal?:string,serverReceivedAt?:string){
  const hash=digest(payload);await m.query('INSERT INTO finance_policy_records(kind,scope,key,policy,payload,hash,journal,"ingestedAt") VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,COALESCE($8::timestamptz,clock_timestamp())) ON CONFLICT(kind,scope,key) DO NOTHING',[kind,scope,key,this.policy,json(payload),hash,journal||null,serverReceivedAt||null]);
  const prior=await this.get(m,kind,scope,key);if(prior.hash!==hash||prior.journal!==(journal||null))throw Error('OWNER_POLICY_EVENT_CONFLICT');return prior;
 }
 async command(m:EntityManager,actor:string,key:string,request:unknown,fn:()=>Promise<Record<string,unknown>>){
  if(!/^[A-Za-z0-9:_-]{8,120}$/.test(key))throw Error('Stable policy command key required');
  // Reverify authority on every call, but a rotated verification reference is
  // audit provenance, not a different economic command. First proof is retained.
  const material={...(request as Record<string,unknown>),...(this.policy===POLICY_21?{policy:this.policy}:{})};delete (material as Record<string,unknown>).proof;
  const hash=digest(material),previous=await this.get(m,'command',actor,key);
  if(previous){if(previous.payload.requestHash!==hash)throw Error('OWNER_POLICY_COMMAND_CONFLICT');return previous.payload.result as Record<string,unknown>;}
  const result=await fn();await this.record(m,'command',actor,key,{requestHash:hash,request,result,policy:OWNER_POLICY});return result;
 }
 async account(m:EntityManager,key:string,owner:string,kind:string,side:'credit'|'debit',nonnegative=true){
  if(key.length>160)key='policy:'+digest(key);
  await m.query('INSERT INTO finance_accounts(id,"accountKey",kind,"ownerReference","normalSide",nonnegative) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT("accountKey") DO NOTHING',[randomUUID(),key,kind,owner,side,nonnegative]);
  const [a]=await m.query('SELECT * FROM finance_accounts WHERE "accountKey"=$1',[key]);if(a.kind!==kind||a.ownerReference!==owner||a.normalSide!==side||a.nonnegative!==nonnegative)throw Error('Policy account identity mismatch');return a.id as string;
 }
 async post(m:EntityManager,lines:Posting[]){const id=randomUUID();return this.events.postEventWithManager(m,{type:'finance.journal.posted',schemaVersion:1,eventId:id,idempotencyKey:'policy:'+id,operationId:id,createdAt:new Date().toISOString(),data:{currency:'GBP'}},lines);}
}
