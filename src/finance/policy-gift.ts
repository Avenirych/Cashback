import {randomUUID} from 'node:crypto';
import type {EntityManager} from 'typeorm';
import {PolicyContext} from './policy-context';
import {debtPriority} from './owner-policy';
export type GiftEvidence={giftOrigins?:string[];giftLineageVerified?:boolean;linkedDebtSetVerified?:boolean};
/** Caller already holds the policy gate and all verified origin/customer locks.
 * Destinations are planned before any journal is posted, never release-then-collect. */
export async function returnDestinations(m:EntityManager,actor:string,f:GiftEvidence,lot:string,amount:bigint,claimed:Map<string,bigint>){
 const [l]=await m.query('SELECT l.*,p.owner AS parent_owner FROM finance_bonus_lots l LEFT JOIN finance_bonus_lots p ON p.id=l.parent WHERE l.id=$1',[lot]);
 if(!l||l.owner!==actor)throw Error('Returned lot ownership mismatch');
 const lines:any[]=[],recoveries:any[]=[];let left=amount;
 if(l.parent&&l.parent_owner!==actor){
  if(!f.giftLineageVerified||!f.linkedDebtSetVerified||!f.giftOrigins?.includes(l.responsible)||l.parent_owner!==l.responsible)return {status:'pending_review' as const,reason:'VERIFIED_DIRECT_GIFT_AND_LINKED_DEBT_SET_REQUIRED'};
  const debts=await m.query('SELECT d.*,a."balancePence",to_char(e."confirmedAt" AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS confirmed FROM finance_verified_debts d JOIN finance_accounts a ON a.id=d.account LEFT JOIN finance_policy_debt_evidence e ON e.debt=d.id WHERE d.debtor=$1 AND d.origin=$2 AND a."balancePence">0 ORDER BY d.id FOR UPDATE OF a',[l.responsible,l.origin]);
  const order=debtPriority(debts.map((d:any)=>({...d,confirmedAt:d.confirmed})));if(order.status!=='ready')return order;
  for(const d of order.debts as any[]){if(BigInt(d.balancePence)>BigInt(d.cap))throw Error('Gift origin debt exceeds cap');const remaining=BigInt(d.balancePence)-(claimed.get(d.id)||0n),n=remaining<left?remaining:left;if(n){lines.push({accountId:d.account,side:'credit',amount:n});recoveries.push({debt:d.id,amount:n});claimed.set(d.id,(claimed.get(d.id)||0n)+n);left-=n;}}
 }
 if(left)lines.push({accountId:l.available,side:'credit',amount:left});
 return {status:'ready' as const,lines,recoveries};
}
export async function recordGiftRecovery(m:EntityManager,journal:string,lot:string,source:string,recoveries:{debt:string;amount:bigint}[]){for(const r of recoveries)await m.query('INSERT INTO finance_policy_recovery_slices(id,journal,debt,lot,account,kind,amount) VALUES($1,$2,$3,$4,$5,\'collection\',$6)',[randomUUID(),journal,r.debt,lot,source,r.amount.toString()]);}
export async function cancelGiftGroup(c:PolicyContext,m:EntityManager,actor:string,f:any,proof:string){
 const bonus=await c.get(m,'bonus',f.click,'final');
 let parts:any[];
 if(bonus){const b=bonus.payload;if(b.actor!==actor||b.reservation!==f.reservation||JSON.stringify(b.winner)!==JSON.stringify(f.cancelledOrder))throw Error('Applied winner mismatch');parts=b.parts||[{lot:b.lot,consumed:b.consumed,used:b.used}];}
 else {parts=await m.query("SELECT r.*,r.lot,r.amount AS used,l.reserved AS consumed FROM finance_bonus_reservations r JOIN finance_bonus_lots l ON l.id=r.lot WHERE r.click=$1 AND r.state='active' ORDER BY r.id FOR UPDATE OF r,l",[f.click]);if(!parts.some(p=>p.id===f.reservation))throw Error('Active winner reservation required');}
 const claimed=new Map<string,bigint>(),lines:any[]=[],recoveries:any[]=[];let total=0n;
 for(const p of parts){const amount=BigInt(p.used);const [a]=await m.query('SELECT "balancePence" FROM finance_accounts WHERE id=$1 FOR UPDATE',[p.consumed]);if(!a||(bonus?BigInt(a.balancePence)!==amount:BigInt(a.balancePence)<amount))return {status:'pending_review',reason:'SPENT_BONUS_REVERSAL_RECONCILIATION_REQUIRED'};
  const dest=await returnDestinations(m,actor,f,p.lot,amount,claimed);if(dest.status!=='ready')return dest;if(amount){lines.push({accountId:p.consumed,side:'debit',amount},...dest.lines);total+=amount;}recoveries.push({lot:p.lot,source:p.consumed,items:dest.recoveries});
 }
 const j=total?await c.post(m,lines):null;
 if(!bonus)for(const p of parts)await m.query("UPDATE finance_bonus_reservations SET state='released' WHERE id=$1",[p.id]);
 if(j)for(const r of recoveries)await recordGiftRecovery(m,j.journalId,r.lot,r.source,r.items);
 const result={status:'returned',returned:total.toString(),originalJournal:bonus?.journal||null,journal:j?.journalId||null,recoveries:recoveries.flatMap(r=>r.items.map((i:any)=>({lot:r.lot,debt:i.debt,amount:i.amount.toString()}))),actor,proof,policy:c.policy};await c.record(m,'bonus_cancel',f.click,'return',result,j?.journalId);return result;
}
