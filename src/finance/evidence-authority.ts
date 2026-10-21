import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { BankReceiptFacts, VerifiedBankEvidence } from './bank-evidence-verifier';
export const EVIDENCE_AUTHORITY=Symbol('EVIDENCE_AUTHORITY');
export type EvidenceRole='evidence_submitter'|'evidence_reviewer'|'evidence_controller';
export type EvidenceAction='submit'|'approve'|'recheck'|'revoke'|'restore'|'history';
export interface TrustedEvidenceAuthority {
 /** Verify document provenance independently; a UUID alone is not evidence. No remote I/O under DB locks. */
 verifyReviewDocument(manager:EntityManager,documentReference:string,evidenceReference:string|null):Promise<void>;
 assertVerificationEnabled(manager:EntityManager):Promise<void>;
/** Resolve authenticated context and current permissions under the shared authorization lock.
  * Never accept a caller UUID, role string or user name alone as authorization. */
 authorize(manager:EntityManager,principalReference:string,action:EvidenceAction):Promise<{principalId:string;role:EvidenceRole}>;
 /** Independently verify the bank occurrence and its canonical identity; references alone are not proof. */
 inspect(manager:EntityManager,evidenceReference:string,claimed:BankReceiptFacts):Promise<VerifiedBankEvidence>;
}
@Injectable()
export class DisabledEvidenceAuthority implements TrustedEvidenceAuthority {
 async verifyReviewDocument():Promise<never>{throw new Error('Trusted review document verification is not configured');}
 async assertVerificationEnabled():Promise<never>{throw new Error('Trusted evidence authority is not configured');}
 async authorize():Promise<never>{throw new Error('Trusted evidence authorization is not configured');}
 async inspect():Promise<never>{throw new Error('Trusted bank evidence authority is not configured');}
}
