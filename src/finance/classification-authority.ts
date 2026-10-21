import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
export const CLASSIFICATION_AUTHORITY=Symbol('CLASSIFICATION_AUTHORITY');
export const SOURCE_CATEGORIES=['shopping_cashback','rewarded_ads','research_referral','passive_ads','return_or_adjustment','company_funding'] as const;
export type SourceCategory=typeof SOURCE_CATEGORIES[number];
export interface SourceOriginFacts {
 readonly receiptId:string;
 readonly offsetPence:bigint;
 readonly amountPence:bigint;
 readonly category:SourceCategory;
 readonly sourceNamespace:string;
 readonly sourceEventId:string;
 readonly basisReference:string;
 readonly documentReferences:readonly string[];
}
export interface VerifiedSourceOrigin extends SourceOriginFacts {
 readonly status:'verified';
 readonly verificationId:string;
 readonly verifierReference:string;
}
export interface ClassificationAuthority {
 /** Resolve authenticated context/current classify_source permission under authorization lock.
  * Caller role, UUID, evidence permission or coverage mandate is not authorization.
  * No independent transaction, remote I/O or lower-order locks. */
 authorizeWithManager(manager:EntityManager,principalReference:string,contextReference:string):Promise<{principalId:string;contextId:string;right:'classify_source'}>;
 /** Independently validate local source evidence and exact receipt range/basis, never echo claimed values as proof. */
 verifyOriginWithManager(manager:EntityManager,claimed:SourceOriginFacts):Promise<VerifiedSourceOrigin>;
}
@Injectable()
export class DisabledClassificationAuthority implements ClassificationAuthority {
 async authorizeWithManager():Promise<never>{throw Error('Trusted classify_source authority is not configured');}
 async verifyOriginWithManager():Promise<never>{throw Error('Trusted source origin verifier is not configured');}
}
