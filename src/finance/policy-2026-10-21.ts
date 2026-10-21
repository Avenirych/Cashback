import {policyPence,utc} from './owner-policy';
export const POLICY_21='FINANCIAL_POLICY_2026_10_21';
export type MonetarySlice={id:string;confirmed:string;amount:string};
/** Only order the caller's already verified eligible set. Equal-date groups may
 * be consumed wholly or left wholly untouched; never pick an arbitrary member. */
export function fifo<T extends MonetarySlice>(lots:readonly T[],requested:bigint){
 if(requested<0n)throw Error('Negative allocation');
 if(new Set(lots.map(l=>l.id)).size!==lots.length)throw Error('Duplicate monetary lot');
 const sorted=[...lots].sort((a,b)=>utc(a.confirmed)<utc(b.confirmed)?-1:utc(a.confirmed)>utc(b.confirmed)?1:0);
 const allocations:{lot:T;amount:bigint}[]=[];let left=requested;
 for(let i=0;i<sorted.length&&left;){let end=i+1;while(end<sorted.length&&utc(sorted[end].confirmed)===utc(sorted[i].confirmed))end++;
  const group=sorted.slice(i,end),total=group.reduce((n,l)=>n+policyPence(l.amount),0n);
  if(group.length>1&&left<total)return {status:'pending_review' as const,reason:'FIFO_EQUAL_CONFIRMATION_AMBIGUITY'};
  for(const lot of group){const available=policyPence(lot.amount),amount=left<available?left:available;if(amount){allocations.push({lot,amount});left-=amount;}}
  i=end;
 }
 return {status:'ready' as const,allocations,allocated:requested-left,unfunded:left};
}
