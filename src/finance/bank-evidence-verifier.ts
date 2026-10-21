import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
export const BANK_EVIDENCE_VERIFIER = Symbol('BANK_EVIDENCE_VERIFIER');
export interface BankReceiptFacts {
 readonly sourceNamespace: string;
 readonly accountScope: string; // Opaque internal UUID, never bank account details.
 readonly transactionId: string;
 readonly currency: 'GBP';
 readonly amountPence: bigint;
 readonly receivedAt: string;
}
export interface VerifiedBankEvidence extends BankReceiptFacts {
 readonly status: 'verified';
 readonly verificationId: string;
 readonly evidenceReference: string;
 readonly verifierReference: string;
}
/** Trusted boundary. An ID or hash alone is NOT proof. No active adapter provided. */
export interface BankEvidenceVerifier {
 verify(evidenceReference: string, claimed: BankReceiptFacts): Promise<VerifiedBankEvidence>;
}
export interface TransactionalBankEvidenceVerifier extends BankEvidenceVerifier {
 verifyWithManager(manager:EntityManager,evidenceReference:string,claimed:BankReceiptFacts):Promise<VerifiedBankEvidence>;
 bindReceiptWithManager(manager:EntityManager,proof:VerifiedBankEvidence,receiptId:string):Promise<void>;
}
export class EvidenceRefusedError extends Error {
 readonly code='BANK_EVIDENCE_BLOCKED';
 constructor(message:string,readonly receiptId:string|null=null){super(message);}
}
@Injectable()
export class DisabledBankEvidenceVerifier implements BankEvidenceVerifier {
 async verifyWithManager():Promise<never>{throw new Error('Trusted bank evidence verifier is not configured');}
 async bindReceiptWithManager():Promise<never>{throw new Error('Trusted bank evidence verifier is not configured');}
 async verify(): Promise<never> { throw new Error('Trusted bank evidence verifier is not configured'); }
}
