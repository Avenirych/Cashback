import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
@Entity('finance_bank_receipts')
@Index('UQ_finance_bank_transaction',['sourceNamespace','accountScope','transactionId'],{unique:true})
@Index('UQ_finance_receipt_key',['idempotencyKey'],{unique:true})
export class FinanceBankReceipt {
 @PrimaryColumn('uuid') id:string;
 @Column('varchar',{length:60}) sourceNamespace:string;
 @Column('uuid') accountScope:string;
 @Column('varchar',{length:160}) transactionId:string;
 @Column('varchar',{length:100}) idempotencyKey:string;
 @Column('varchar',{length:64}) materialHash:string;
 @Column('varchar',{length:3}) currency:'GBP';
 @Column('bigint') amountPence:string;
 @Column('timestamptz') receivedAt:Date;
 @Column('uuid') verificationId:string;
 @Column('uuid') evidenceReference:string;
 @Column('varchar',{length:60}) verifierReference:string;
 @Column('varchar',{length:20}) verificationStatus:'verified';
 @Column('uuid',{unique:true}) journalId:string;
 @Column('uuid',{unique:true}) eventId:string;
 @Column('uuid') bankAccountId:string;
 @Column('uuid') unallocatedAccountId:string;
}
@Entity('finance_funding_lots')
export class FinanceFundingLot {
 @PrimaryColumn('uuid') id:string;
 @Column('uuid',{unique:true}) receiptId:string;
 @Column('varchar',{length:3}) currency:'GBP';
 @Column('bigint') amountPence:string;
 @Column('varchar',{length:20}) status:'restricted';
 @Column('varchar',{length:40}) purpose:'awaiting_classification';
}
