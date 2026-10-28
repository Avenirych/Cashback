import type {DataSource,EntityManager} from 'typeorm';
import {ApplicationWindow,canApply,unitsText} from './bonus-use-policy';
import {policyPence,utc} from './owner-policy';
export interface BonusSnapshotAuthority {
 /** Resolve JWT-authenticated principal to an existing, verified ledger-owner mapping.
  * No owner ID, roles or verification boolean may come from a public request body. */
 resolveOwner(manager:EntityManager,principal:string):Promise<string>;
}
export class DisabledBonusSnapshotAuthority implements BonusSnapshotAuthority {
 async resolveOwner():Promise<never>{throw Error('BONUS_SNAPSHOT_AUTHORITY_NOT_CONFIGURED');}
}
/** Prepared read-only V2 adapter, deliberately not registered in any live module.
 * Free/reserved balances are NOT a payout quote or a complete obligation total.
 * No legacy bonus_items fallback, imported money, aggregation or write operation. */
export class BonusUseSnapshot {
 constructor(private readonly source:DataSource,private readonly authority:BonusSnapshotAuthority=new DisabledBonusSnapshotAuthority()){}
 async read(m:EntityManager,principal:string){
  const r=m?.queryRunner;
  if(m?.connection!==this.source||!r||r.connection!==this.source||r.manager!==m||r.isReleased||!r.isTransactionActive)throw Error('Active caller transaction required');
  const owner=await this.authority.resolveOwner(m,principal);
  if(typeof owner!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(owner))throw Error('Verified ledger owner required');
  const [mode]=await m.query('SHOW transaction_read_only');
  if(mode?.transaction_read_only!=='on')throw Error('Read-only transaction required');
  const [clock]=await m.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS t`);
  const rows=await m.query(`SELECT l.id,l.kind,a.currency,a."balancePence" AS free,r."balancePence" AS reserved,
   t.version,t.basis,t.reference,to_char(t.started AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "startedAt",
   to_char(t.until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS until
   FROM finance_bonus_lots l JOIN finance_accounts a ON a.id=l.available JOIN finance_accounts r ON r.id=l.reserved
   LEFT JOIN finance_bonus_use_terms t ON t.lot=l.id WHERE l.owner=$1 ORDER BY l.id`,[owner]);
  return {schemaVersion:'bonus-use.v1' as const,sourceModel:'isolated_finance_ledger' as const,asOf:clock.t as string,
   payoutEligibility:'not_evaluated' as const,lots:rows.map((row:any)=>{
    if(row.currency!=='GBP'||!['bonus','withdrawal_gbp'].includes(row.kind))throw Error('Unsupported verified lot denomination');
    const free=policyPence(row.free),reserved=policyPence(row.reserved);
    const application=row.kind!=='bonus'?{state:'not_applicable' as const,startedAt:null,until:null}:
     !row.version?{state:'unknown' as const,startedAt:null,until:null}:
     {state:canApply(row as ApplicationWindow,clock.t)?'eligible' as const:utc(clock.t)>=utc(row.until)?'expired' as const:'not_started' as const,startedAt:row.startedAt as string,until:row.until as string};
    return{id:row.id as string,kind:row.kind as 'bonus'|'withdrawal_gbp',freePence:free.toString(),purchaseReservedPence:reserved.toString(),
     bonusUnits:row.kind==='bonus'?{free:unitsText(free),purchaseReserved:unitsText(reserved)}:null,
     payoutCurrency:'GBP' as const,application};
   })};
 }
}
