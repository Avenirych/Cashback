import { Injectable } from '@nestjs/common';
import type { SourceOriginFacts, VerifiedSourceOrigin } from './classification-authority';
import type { EntityManager } from 'typeorm';
export const CORRECTION_AUTHORITY=Symbol('CORRECTION_AUTHORITY');
export type CorrectionRight='request_classification_correction'|'review_classification_correction';
export interface TrustedCorrectionIdentity {
 principalId:string;participantId:string;contextId:string;right:CorrectionRight;identityVerified:true;
}
export interface CorrectionAuthority {
 /** Authenticated current permissions and common responsible participant, under shared authorization lock.
  * No roles/participant IDs from caller payload, remote I/O or independent transactions.
  * Permission/identity changes must obey the same lock; participant mapping must be stable across accounts. */
 authorizeWithManager(manager:EntityManager,principalReference:string,contextReference:string,right:CorrectionRight):Promise<TrustedCorrectionIdentity>;
 /** Independent trusted verification of the review basis, not mere existence of a UUID/document. */
 verifyCandidateSourceWithManager?(manager:EntityManager,facts:SourceOriginFacts):Promise<VerifiedSourceOrigin>;
 verifyExactDecisionBasisWithManager?(manager:EntityManager,basisReference:string,facts:{requestId:string;candidateId:string;fingerprint:string;decision:'approved'|'rejected'}):Promise<void>;
 verifyDecisionBasisWithManager(manager:EntityManager,basisReference:string,requestId:string,decision:'approved'|'rejected'):Promise<void>;
}
@Injectable()
export class DisabledCorrectionAuthority implements CorrectionAuthority {
 async authorizeWithManager():Promise<never>{throw Error('Trusted correction authority is not configured');}
 async verifyCandidateSourceWithManager():Promise<never>{throw Error('Trusted candidate source verifier is not configured');}
 async verifyExactDecisionBasisWithManager():Promise<never>{throw Error('Trusted exact candidate review verifier is not configured');}
 async verifyDecisionBasisWithManager():Promise<never>{throw Error('Trusted correction review verifier is not configured');}
}
