import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
@Entity('finance_coverage_mandates')
export class FinanceCoverageMandate {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid') principalId:string;
 @Column('uuid') contextId:string;
 @Column('varchar',{length:30}) purpose:'synthetic_test_coverage';
 @Column('varchar',{length:3}) currency:'GBP';
 @Column('bigint') limitPence:string;
 @Column('uuid',{array:true}) allowedLotIds:string[];
}
@Entity('finance_coverage_targets')
export class FinanceCoverageTarget {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid') contextId:string;
 @Column('uuid') creatorId:string;
 @Column('uuid') creationMandateId:string;
 @Column('varchar',{length:30}) kind:'synthetic_test_coverage';
 @Column('varchar',{length:3}) currency:'GBP';
 @Column('bigint') amountPence:string;
 @Column('varchar',{length:8}) state:'created'|'reserved';
 @Column('varchar',{length:160,unique:true}) creationKey:string;
 @Column('varchar',{length:64}) creationHash:string;
}
@Entity('finance_coverage_reservations')
export class FinanceCoverageReservation {
 @PrimaryColumn('uuid') id:string;
 @Column('varchar',{length:160,unique:true}) commandKey:string;
 @Column('varchar',{length:64}) requestHash:string;
 @Column('uuid',{unique:true}) targetId:string;
 @Column('uuid') mandateId:string;
 @Column('jsonb') result:Record<string,unknown>;
}
@Entity('finance_coverage_allocations')
@Index('UQ_finance_coverage_fragment',['reservationId','lotId'],{unique:true})
export class FinanceCoverageAllocation {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid') reservationId:string;
 @Column('uuid') lotId:string;
 @Column('bigint') amountPence:string;
 @Column('varchar',{length:3}) currency:'GBP';
 @Column('varchar',{length:8}) state:'held';
}
