import {assertPence,splitRevenue} from './money';
export const OWNER_POLICY='FINANCIAL_BUSINESS_POLICY_2026_10_20' as const;
export function policyPence(value:unknown):bigint{
 if(typeof value!=='bigint'&&(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value)))throw Error('Explicit integer GBP pence required');
 const amount=BigInt(value);assertPence(amount);return amount;
}
export function eligibleValue(items:readonly {id:string;kind:'product'|'delivery'|'excluded';eligible:boolean;afterDiscount:bigint}[]){
 const ids=new Set<string>();let total=0n;
 for(const item of items){if(!item.id||ids.has(item.id))throw Error('Duplicate item');ids.add(item.id);assertPence(item.afterDiscount);if(item.kind==='product'&&item.eligible===true)total+=item.afterDiscount;}
 assertPence(total);return total;
}
/** Exact UTC timestamps, retaining submillisecond ingestion ordering. */
export function utc(value:string):bigint{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value))throw Error('Exact UTC timestamp required');
 const ms=Date.parse(value);if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,19)!==value.slice(0,19))throw Error('Invalid UTC timestamp');
 const fraction=(value.match(/\.(\d+)Z$/)?.[1]||'').padEnd(6,'0');return BigInt(Math.floor(ms/1000))*1000000n+BigInt(fraction);
}
export function sixMonthsUtc(original:string){
 utc(original);const date=new Date(original),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+6);
 const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,end));
 return date.toISOString().replace(/\.\d{3}Z$/,'.'+(original.match(/\.(\d+)Z$/)?.[1]||'000').padEnd(6,'0')+'Z');
}
export interface RankedOrder {source:string;id:string;eligible:boolean;value:bigint;placedAt:string|null;firstIngested:string;merchantCap:bigint|null;finality:boolean;terms:string|null}
export function chooseOrder(orders:readonly RankedOrder[],complete:boolean){
 if(complete!==true||!orders.length||orders.some(x=>x.finality!==true||!x.terms))return {status:'pending_review' as const,reason:'GROUP_COMPLETION_AND_MERCHANT_FINALITY_REQUIRED'};
 const ids=new Set<string>();for(const o of orders){const key=JSON.stringify([o.source,o.id]);if(ids.has(key))throw Error('Duplicate canonical order');ids.add(key);assertPence(o.value);utc(o.firstIngested);if(o.placedAt!==null)utc(o.placedAt);if(o.merchantCap!==null)assertPence(o.merchantCap);}
 const eligible=orders.filter(x=>x.eligible);if(!eligible.length)return {status:'pending_review' as const,reason:'NO_ELIGIBLE_ORDER'};
 const highest=eligible.reduce((n,o)=>o.value>n?o.value:n,0n),tied=eligible.filter(x=>x.value===highest);
 // A whole tied set uses placement only when ALL timestamps are trustworthy;
 // otherwise Q7 ingestion fallback is applied consistently to that tied set.
 const placement=tied.every(x=>x.placedAt!==null);
 let finalists=tied;
 if(placement){const earliest=tied.reduce((n,o)=>utc(o.placedAt!)<n?utc(o.placedAt!):n,utc(tied[0].placedAt!));finalists=tied.filter(x=>utc(x.placedAt!)===earliest);}
 if(finalists.length>1){const first=finalists.reduce((n,o)=>utc(o.firstIngested)<n?utc(o.firstIngested):n,utc(finalists[0].firstIngested));finalists=finalists.filter(x=>utc(x.firstIngested)===first);}
 if(finalists.length!==1)return {status:'pending_review' as const,reason:'INDISTINGUISHABLE_TIE'};
 const winner=finalists[0];if(winner.merchantCap===null)return {status:'pending_review' as const,reason:'MERCHANT_CAP_EVIDENCE_REQUIRED'};
 return {status:'ready' as const,winner,cap:winner.value<winner.merchantCap?winner.value:winner.merchantCap};
}
export function cashbackRecovery(original:bigint,revisedCommission:bigint|null,full:boolean){
 assertPence(original);if(full)return {status:'ready' as const,target:original};
 if(revisedCommission===null)return {status:'pending_review' as const,reason:'REVISED_COMMISSION_REQUIRED'};
 assertPence(revisedCommission);const remaining=splitRevenue(revisedCommission,'cashback').user;
 if(remaining>original)return {status:'pending_review' as const,reason:'INCREASE_REQUIRES_RECEIPT_BACKED_SETTLEMENT'};
 return {status:'ready' as const,target:original-remaining};
}
export function debtPriority<T extends {id:string;confirmedAt:string|null}>(debts:readonly T[]){
 if(debts.some(d=>d.confirmedAt===null))return {status:'pending_review' as const,reason:'DEBT_CONFIRMATION_REQUIRED'};
 const sorted=[...debts].sort((a,b)=>utc(a.confirmedAt!)<utc(b.confirmedAt!)?-1:utc(a.confirmedAt!)>utc(b.confirmedAt!)?1:0);
 if(sorted.some((d,i)=>i>0&&utc(d.confirmedAt!)===utc(sorted[i-1].confirmedAt!)))return {status:'pending_review' as const,reason:'DEBT_TIMESTAMP_TIE'};
 return {status:'ready' as const,debts:sorted};
}
