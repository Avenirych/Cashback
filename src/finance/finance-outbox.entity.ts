import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
@Entity('finance_outbox')
@Index('UQ_finance_outbox_key', ['idempotencyKey'], { unique:true })
@Index('UQ_finance_outbox_journal', ['journalId'], { unique:true })
export class FinanceOutbox {
 @PrimaryColumn('uuid') eventId: string;
 @Column('varchar',{length:60}) type: 'finance.journal.posted';
 @Column('int') schemaVersion: 1;
 @Column('varchar',{length:160}) idempotencyKey: string;
 @Column('uuid') operationId: string;
 @Column('uuid') journalId: string;
 @Column('timestamptz') createdAt: Date;
 @Column('varchar',{length:64}) envelopeHash: string;
 @Column('jsonb') payload: {currency:'GBP';journalId:string;postingCount:number};
 @Column('int',{default:0}) attempts: number;
 @Column('timestamptz',{nullable:true}) deliveredAt: Date | null;
 @Column('timestamptz',{nullable:true}) leaseUntil: Date | null;
 @Column('timestamptz',{default:()=> 'CURRENT_TIMESTAMP'}) availableAt: Date;
}
