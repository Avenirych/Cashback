import type { EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import type { BankReceiptFacts } from './bank-evidence-verifier';
export const evidenceHash=(x:unknown):string=>createHash('sha256').update(JSON.stringify(x,(_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex');
export const bankIdentity=(f:BankReceiptFacts):string=>evidenceHash([f.sourceNamespace,f.accountScope.toLowerCase(),f.transactionId]);
/** Authorization, account scope, canonical operation, ledger event, accounts. */
export async function lockEvidenceScope(m:EntityManager,scope:string):Promise<void>{
 await m.query('SELECT pg_advisory_xact_lock(726405, 0)');
 await m.query('SELECT pg_advisory_xact_lock(726404, hashtext($1))',[scope.toLowerCase()]);
}
export async function lockBankIdentity(m:EntityManager,f:BankReceiptFacts):Promise<void>{
 await lockEvidenceScope(m,f.accountScope);
 await m.query('SELECT pg_advisory_xact_lock(726403, hashtext($1))',[bankIdentity(f)]);
}
