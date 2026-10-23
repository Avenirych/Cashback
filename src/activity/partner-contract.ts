import {createHmac,timingSafeEqual} from 'node:crypto';
import {ForbiddenException,ServiceUnavailableException,BadRequestException} from '@nestjs/common';
import {ActivityEngine,Sql} from './activity-engine';
const verified=Symbol('server verified partner callback');
interface Event {externalId:string;operationId:string;outcome:'complete'|'failed'|'reversed'}
export class PartnerActivityContract {
 // Empty in the shipped application. An actual partner adapter/key must be
 // configured server-side before this contract can accept a real confirmation.
 constructor(private readonly keys:ReadonlyMap<string,string>=new Map()){}
 verify(partner:string,raw:Buffer,timestamp:string,signature:string,now=Date.now()){
  const secret=this.keys.get(partner);if(!secret||secret.length<32)throw new ServiceUnavailableException('Partner not connected');
  if(!/^\d{10}$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000||!/^[a-f0-9]{64}$/.test(signature)||raw.length>16384)throw new ForbiddenException('Invalid partner authentication');
  const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();if(!timingSafeEqual(expected,Buffer.from(signature,'hex')))throw new ForbiddenException('Invalid partner authentication');
  let event:Event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw new BadRequestException('Invalid partner event');}
  if(!event||Object.keys(event).sort().join(',')!=='externalId,operationId,outcome'||typeof event.externalId!=='string'||typeof event.operationId!=='string'||!['complete','failed','reversed'].includes(event.outcome))throw new BadRequestException('Invalid partner event');
  return {[verified]:true as const,partner,event};
 }
 async apply(m:Sql,proof:ReturnType<PartnerActivityContract['verify']>){
  if(proof?.[verified]!==true)throw new ForbiddenException('Trusted partner proof required');
  return new ActivityEngine().partnerEvent(m,proof.partner,proof.event.externalId,proof.event.operationId,proof.event.outcome,JSON.stringify(proof.event));
 }
}
