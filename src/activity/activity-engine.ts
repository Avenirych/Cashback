import {createHash,randomUUID} from 'node:crypto';
import {BadRequestException,ConflictException,HttpException} from '@nestjs/common';
export type Action='video'|'research'|'review'|'topic'|'post'|'failed_login'|'registration'|'resend'|'registration_total'|'sensitive';
export type Mode='demo'|'real'|'security';
export interface Sql {query(sql:string,params?:unknown[]):Promise<any[]>;queryRunner?:{isTransactionActive?:boolean}}
export interface Command {subject:string;userId?:number;action:Action;partner:string;mode:Mode;key:string;material:string}
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export function boundary(period:string,now:Date){
 const start=new Date(now),end=new Date(now);
 if(period==='month'){start.setUTCDate(1);start.setUTCHours(0,0,0,0);end.setTime(start.getTime());end.setUTCMonth(end.getUTCMonth()+1);}
 else if(period==='day'){start.setUTCHours(0,0,0,0);end.setTime(start.getTime()+86400000);}
 else if(period==='quarter_hour'||period==='minute'){const ms=period==='minute'?60000:900000;start.setTime(Math.floor(now.getTime()/ms)*ms);end.setTime(start.getTime()+ms);}
 else throw new BadRequestException('Invalid period');
 return {start:start.toISOString(),end:end.toISOString()};
}
// PostgreSQL TypeORM returns UPDATE/DELETE as [rows, affectedCount].
export function returnedRows(result:any[]):any[]{return Array.isArray(result[0])&&typeof result[1]==='number'?result[0]:result;}
export class ActivityEngine {
 private validate(c:Command){if(!['video','research','review','topic','post','failed_login','registration','resend','registration_total','sensitive'].includes(c.action)||!['demo','real','security'].includes(c.mode)||typeof c.subject!=='string'||!/^[-a-zA-Z0-9_:]{1,160}$/.test(c.subject)||typeof c.partner!=='string'||!/^[-a-zA-Z0-9_*:]{1,100}$/.test(c.partner)||typeof c.key!=='string'||!/^[-a-zA-Z0-9_:]{8,160}$/.test(c.key)||typeof c.material!=='string'||c.material.length>20000)throw new BadRequestException('Invalid activity command');}
 async lock(m:Sql,subject:string,action:string,mode:string){if(m.queryRunner?.isTransactionActive!==true)throw new Error('Active PostgreSQL transaction required');await m.query('SELECT pg_advisory_xact_lock(729211,hashtext($1))',[JSON.stringify([subject,action,mode])]);}
 async reserve(m:Sql,c:Command){
  this.validate(c);await this.lock(m,c.subject,c.action,c.mode);
  const old=await m.query('SELECT * FROM activity_limit_operations WHERE subject=$1 AND action=$2 AND partner=$3 AND mode=$4 AND key_hash=$5',[c.subject,c.action,c.partner,c.mode,digest(c.key)]);
  if(old.length){if(old[0].material_hash!==digest(c.material))throw new ConflictException({code:'ACTIVITY_IDEMPOTENCY_CONFLICT'});return old[0];}
  const [{now}]=await m.query('SELECT clock_timestamp() AS now');
  const policies=await m.query('SELECT * FROM activity_limit_policies WHERE action=$1 AND (partner=$2 OR partner=\'*\') AND enabled=true AND maximum IS NOT NULL ORDER BY partner,period',[c.action,c.partner]);
  if(c.action==='failed_login')for(const p of policies.filter(p=>p.period==='quarter_hour')){
   const [rolling]=await m.query("SELECT count(*)::integer AS n,min(created_at)+interval '15 minutes' AS reset FROM activity_limit_operations WHERE subject=$1 AND action=$2 AND mode=$3 AND ($4='*' OR partner=$4) AND state IN ('reserved','confirmed') AND created_at>$5::timestamptz-interval '15 minutes'",[c.subject,c.action,c.mode,p.partner,now]);
   if(rolling.n>=p.maximum)throw new HttpException({code:'ACTIVITY_LIMIT',action:c.action,period:'quarter_hour',resetAt:rolling.reset},429);
  }
  const buckets:Record<string,unknown>[]=[];
  for(const p of policies){const time=boundary(p.period,new Date(now));
   const args=[c.subject,c.action,p.partner,c.mode,p.period,time.start,time.end];
   await m.query('INSERT INTO activity_limit_usage(subject,action,scope,mode,period,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING',args);
   const [usage]=await m.query('SELECT used,reserved FROM activity_limit_usage WHERE subject=$1 AND action=$2 AND scope=$3 AND mode=$4 AND period=$5 AND starts_at=$6 FOR UPDATE',args.slice(0,6));
   if(usage.used+usage.reserved>=p.maximum)throw new HttpException({code:'ACTIVITY_LIMIT',action:c.action,period:p.period,resetAt:time.end},429);
   await m.query('UPDATE activity_limit_usage SET reserved=reserved+1 WHERE subject=$1 AND action=$2 AND scope=$3 AND mode=$4 AND period=$5 AND starts_at=$6',args.slice(0,6));
   buckets.push({scope:p.partner,period:p.period,start:time.start});
  }
  const [row]=await m.query('INSERT INTO activity_limit_operations(id,user_id,subject,action,partner,mode,key_hash,material_hash,state,buckets) VALUES($1,$2,$3,$4,$5,$6,$7,$8,\'reserved\',$9::jsonb) RETURNING *',[randomUUID(),c.userId??null,c.subject,c.action,c.partner,c.mode,digest(c.key),digest(c.material),JSON.stringify(buckets)]);return row;
 }
 async settle(m:Sql,id:string,outcome:'confirmed'|'released'){
  const [probe]=await m.query('SELECT * FROM activity_limit_operations WHERE id=$1',[id]);if(!probe)throw new BadRequestException('Unknown reservation');
  await this.lock(m,probe.subject,probe.action,probe.mode);const [row]=await m.query('SELECT * FROM activity_limit_operations WHERE id=$1 FOR UPDATE',[id]);
  if(row.state===outcome)return row;if(row.state!=='reserved')throw new ConflictException({code:'ACTIVITY_TERMINAL_RESERVATION'});
  for(const b of row.buckets){const changed=returnedRows(await m.query('UPDATE activity_limit_usage SET reserved=reserved-1,used=used+$7 WHERE subject=$1 AND action=$2 AND scope=$3 AND mode=$4 AND period=$5 AND starts_at=$6 RETURNING used,reserved',[row.subject,row.action,b.scope,row.mode,b.period,b.start,outcome==='confirmed'?1:0]));if(changed.length!==1)throw new ConflictException('Reservation accounting invariant');}
  const [updated]=returnedRows(await m.query('UPDATE activity_limit_operations SET state=$2 WHERE id=$1 RETURNING *',[id,outcome]));return updated;
 }
 // Only a server-side adapter may invoke this after cryptographic verification.
 // There is deliberately no caller-controlled HTTP confirmation endpoint.
 async partnerEvent(m:Sql,partner:string,externalId:string,operationId:string,outcome:'complete'|'failed'|'reversed',material:string){
  if(!/^[-a-zA-Z0-9_:]{1,160}$/.test(externalId))throw new BadRequestException('Invalid external identity');
  const [op]=await m.query('SELECT * FROM activity_limit_operations WHERE id=$1',[operationId]);if(!op||op.partner!==partner||op.mode!=='real')throw new BadRequestException('Partner reservation mismatch');
  await this.lock(m,op.subject,op.action,op.mode);await m.query('SELECT pg_advisory_xact_lock(729212,hashtext($1))',[JSON.stringify([partner,externalId])]);
  const [old]=await m.query('SELECT * FROM activity_partner_events WHERE partner=$1 AND external_id=$2',[partner,externalId]);
  if(old){if(old.material_hash!==digest(material)||old.operation_id!==operationId||old.outcome!==outcome)throw new ConflictException('Partner identity conflict');return {replay:true};}
  if(outcome==='complete')await this.settle(m,operationId,'confirmed');
  else if(outcome==='failed')await this.settle(m,operationId,'released');
  else if(op.state!=='confirmed')throw new ConflictException('Only confirmed activity can be reversed');
  // A reversal never fabricates money or refills an already-completed action quota.
  await m.query('INSERT INTO activity_partner_events(partner,external_id,material_hash,operation_id,outcome) VALUES($1,$2,$3,$4,$5)',[partner,externalId,digest(material),operationId,outcome]);return {replay:false};
 }
}
