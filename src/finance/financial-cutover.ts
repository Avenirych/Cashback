import {utc} from './owner-policy';
import type {EntityManager} from 'typeorm';
/** Additional explicit gate for future adapters. Never enables writers by date alone. */
export async function requireFinancialAdmission(m:EntityManager):Promise<void>{
 const rows=await m.query('SELECT boundary,admission_enabled FROM finance_cutover_policy WHERE singleton');
 if(rows.length!==1||rows[0].admission_enabled!==true)throw Error('FINANCIAL_ADMISSION_NOT_APPROVED');
 throw Error('FINANCIAL_WRITER_RELEASE_NOT_IMPLEMENTED');
}
export const REVIEW_REASONS=['DATE_UNPROVEN','OWNER_UNPROVEN','DEADLINE_CONFLICT','TRANSFER_CHAIN_UNPROVEN','PARTIAL_HISTORY_UNRECONCILED','OBLIGATION_PAYOUT_UNRECONCILED','DEBT_LINK_UNPROVEN','LATE_PRE_CUTOVER_EVENT'] as const;
export function historicalReview(input:{sourceSystem:string;sourceId:string;original:Record<string,unknown>;receivedAt?:string;receiptProven:boolean}){
 if(!input.sourceSystem||!input.sourceId)throw Error('Source identity required');
 const received=input.receiptProven?input.receivedAt:null;
 if(received)utc(received);
 return{sourceSystem:input.sourceSystem,sourceId:input.sourceId,original:structuredClone(input.original),verifiedReceivedAt:received??null,reason:!received?'DATE_UNPROVEN':utc(received)<utc('2026-11-01T00:00:00Z')?'LATE_PRE_CUTOVER_EVENT':null};
}

/** Pure admission classification; a candidate is NOT permission to post or pay. */
export function classifyEconomicSource(input:{kind:'receipt'|'transfer';actualAt:string|null;proven:boolean;parentAdmitted?:boolean;knownLegacy?:boolean}){
 if(input.knownLegacy)return 'historical' as const;
 if(!input.proven||!input.actualAt)return 'review_required' as const;
 if(utc(input.actualAt)<utc('2026-11-01T00:00:00Z'))return 'historical' as const;
 if(input.kind==='transfer'&&input.parentAdmitted!==true)return 'review_required' as const;
 return 'new_candidate' as const;
}
