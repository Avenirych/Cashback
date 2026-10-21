import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
export const COVERAGE_MANDATE_PROVIDER=Symbol('COVERAGE_MANDATE_PROVIDER');
export interface SyntheticCoverageMandate {
 readonly id:string;
 readonly principalId:string;
 readonly contextId:string;
 readonly purpose:'synthetic_test_coverage';
 readonly currency:'GBP';
 readonly limitPence:bigint;
 readonly allowedLotIds:readonly string[];
}
export interface CoverageMandateProvider {
 /** Validate authenticated principal/test context independently, through the caller manager.
  * No caller role/UUID is sufficient. No nested transaction, remote I/O or out-of-order locks.
  * Resolve a stable immutable grant; changes require a new mandate ID. */
 verifyWithManager(manager:EntityManager,principalReference:string,mandateReference:string,contextReference:string):Promise<SyntheticCoverageMandate>;
}
@Injectable()
export class DisabledCoverageMandateProvider implements CoverageMandateProvider {
 async verifyWithManager():Promise<never>{throw Error('Trusted synthetic coverage mandate provider is not configured');}
}
