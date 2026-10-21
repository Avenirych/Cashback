import { Entity, Column, PrimaryColumn } from 'typeorm';
import type { SourceCategory } from './classification-authority';
@Entity('finance_receipt_classifications')
export class FinanceReceiptClassification {
 @PrimaryColumn('uuid') id:string;
 @Column('varchar',{length:160,unique:true}) commandKey:string;
 @Column('varchar',{length:64}) requestHash:string;
 @Column('uuid') receiptId:string;
 @Column('uuid') actorId:string;
 @Column('uuid') contextId:string;
 @Column('jsonb') result:Record<string,unknown>;
 @Column('timestamptz',{default:()=> 'clock_timestamp()'}) createdAt:Date;
}
@Entity('finance_receipt_classified_parts')
export class FinanceReceiptClassifiedPart {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid') classificationId:string;
 @Column('uuid') receiptId:string;
 @Column('varchar',{length:3}) currency:'GBP';
 @Column('bigint') offsetPence:string;
 @Column('bigint') amountPence:string;
 @Column('varchar',{length:30}) category:SourceCategory;
 @Column('varchar',{length:60}) sourceNamespace:string;
 @Column('varchar',{length:160}) sourceEventId:string;
 @Column('uuid') basisReference:string;
 @Column('uuid',{array:true}) documentReferences:string[];
 @Column('uuid') verificationId:string;
 @Column('varchar',{length:60}) verifierReference:string;
}
@Entity('finance_classification_correction_requests')
export class FinanceClassificationCorrectionRequest {
 @PrimaryColumn('uuid') id:string;
 @Column('varchar',{length:160,unique:true}) commandKey:string;
 @Column('varchar',{length:64}) requestHash:string;
 @Column('uuid') partId:string;
 @Column('varchar',{length:1000}) reason:string;
 @Column('uuid') actorId:string;
 @Column('uuid',{nullable:true}) participantId:string|null;
 @Column('uuid',{nullable:true}) linkedFromRequestId:string|null;
 @Column('uuid') contextId:string;
 @Column('varchar',{length:12}) status:'requested';
 @Column('timestamptz',{default:()=> 'clock_timestamp()'}) createdAt:Date;
}

@Entity('finance_classification_correction_decisions')
export class FinanceClassificationCorrectionDecision {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid',{nullable:true}) candidateId:string|null;
 @Column('varchar',{length:64,nullable:true}) candidateFingerprint:string|null;
 @Column('uuid',{nullable:true}) originalPartId:string|null;
 @Column('int',{nullable:true}) baseVersion:number|null;
 @Column('varchar',{length:64,nullable:true}) intentFingerprint:string|null;
 @Column('uuid') requestId:string;
 @Column('uuid') actorId:string;
 @Column('uuid') participantId:string;
 @Column('uuid') contextId:string;
 @Column('varchar',{length:12}) decision:'approved'|'rejected';
 @Column('varchar',{length:1000}) reason:string;
 @Column('uuid') basisReference:string;
 @Column('uuid') operationId:string;
 @Column('int') operationVersion:number;
 @Column('varchar',{length:160,unique:true}) commandKey:string;
 @Column('varchar',{length:64}) requestHash:string;
 @Column('timestamptz',{default:()=> 'clock_timestamp()'}) createdAt:Date;
}

@Entity('finance_classification_correction_candidates')
export class FinanceClassificationCorrectionCandidate {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid') requestId:string;
 @Column('uuid') originalPartId:string;
 @Column('int') baseVersion:0;
 @Column('varchar',{length:64}) baseHash:string;
 @Column('jsonb') metadata:Record<string,unknown>;
 @Column('uuid') operationId:string;
 @Column('int') operationVersion:number;
 @Column('uuid') actorId:string;
 @Column('uuid') participantId:string;
 @Column('uuid') contextId:string;
 @Column('varchar',{length:64}) fingerprint:string;
 @Column('varchar',{length:64}) intentFingerprint:string;
 @Column('uuid') verificationId:string;
 @Column('varchar',{length:60}) verifierReference:string;
 @Column('varchar',{length:160,unique:true}) commandKey:string;
 @Column('varchar',{length:64}) requestHash:string;
 @Column('timestamptz',{default:()=> 'clock_timestamp()'}) createdAt:Date;
}
