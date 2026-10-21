import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
@Entity('finance_bank_operations')
export class FinanceBankOperation {
 @PrimaryColumn('uuid') id:string;
 @Column('varchar',{length:64,unique:true}) identity:string;
 @Column('uuid') accountScope:string;
 @Column('jsonb') facts:{sourceNamespace:string;accountScope:string;transactionId:string;currency:'GBP';amountPence:string;receivedAt:string};
 @Column('varchar',{length:64}) factsHash:string;
 @Column('varchar',{length:24}) state:'eligible'|'revoked';
 @Column('int',{default:1}) version:number;
 @Column('uuid',{nullable:true,unique:true}) receiptId:string|null;
}
@Entity('finance_bank_observations')
@Index('UQ_finance_observation_native',['source','accountScope','nativeId'],{unique:true})
export class FinanceBankObservation {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid') evidenceReference:string;
 @Column('varchar',{length:160}) source:string;
 @Column('uuid') accountScope:string;
 @Column('varchar',{length:160,nullable:true}) nativeId:string|null;
 @Column('varchar',{length:24}) state:'pending_review'|'quarantined';
 @Column('uuid') submitterId:string;
}
@Entity('finance_bank_decisions')
export class FinanceBankDecision {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid') operationId:string;
 @Column('uuid') observationId:string;
 @Column('uuid') reviewerId:string;
 @Column('varchar',{length:60}) verifierReference:string;
 @Column('uuid',{nullable:true}) documentReference:string|null;
}
@Entity('finance_bank_restore_reviews')
export class FinanceBankRestoreReview {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid') operationId:string;
 @Column('int') operationVersion:number;
 @Column('uuid') reviewerId:string;
 @Column('uuid') observationId:string;
 @Column('uuid') documentReference:string;
 @Column('varchar',{length:60}) verifierReference:string;
}
@Entity('finance_evidence_events')
export class FinanceEvidenceEvent {
 @PrimaryColumn('uuid') id:string;
 @Column('varchar',{length:160,unique:true}) commandKey:string;
 @Column('varchar',{length:20}) action:'submit'|'approve'|'revoke'|'recheck'|'restore';
 @Column('uuid') actorId:string;
 @Column('varchar',{length:64}) requestHash:string;
 @Column('jsonb') data:Record<string,unknown>;
 @Column('jsonb') result:Record<string,unknown>;
 @Column('uuid',{nullable:true}) operationId:string|null;
 @Column('int',{nullable:true}) operationVersion:number|null;
 @Column('timestamptz',{default:()=> 'clock_timestamp()'}) createdAt:Date;
}
