import { Column, CreateDateColumn, Entity, PrimaryColumn, Index } from 'typeorm';
export type AccountKind = 'user_gbp' | 'platform_income' | 'bonus_liability' | 'reserved' | 'user_debt' | 'clearing' | 'company_bank_cash' | 'unallocated_received_funds' | 'bank_fee_expense' | 'transfer_expense' | 'other_expense';
@Entity('finance_accounts')
@Index('UQ_finance_account_key', ['accountKey'], { unique: true })
export class FinanceAccount {
  @PrimaryColumn('uuid') id: string;
  @Column('varchar', { length: 160 }) accountKey: string;
  @Column('varchar', { length: 30 }) kind: AccountKind;
  // Opaque future integration reference: no relation to existing balances.
  @Column('varchar', { length: 100, nullable: true }) ownerReference: string | null;
  @Column('varchar', { length: 3, default: 'GBP' }) currency: 'GBP';
  @Column('varchar', { length: 6 }) normalSide: 'debit' | 'credit';
  @Column('boolean', { default: true }) nonnegative: boolean;
  @Column('bigint', { default: '0' }) balancePence: string;
}
@Entity('finance_journals')
@Index('UQ_finance_event_key', ['eventKey'], { unique: true })
export class FinanceJournal {
  @PrimaryColumn('uuid') id: string;
  @Column('varchar', { length: 160 }) eventKey: string;
  @Column('varchar', { length: 64 }) requestHash: string;
  @Column('boolean', { default: false }) sealed: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
@Entity('finance_postings')
export class FinancePosting {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid') journalId: string;
  @Column('uuid') accountId: string;
  @Column('varchar', { length: 6 }) side: 'debit' | 'credit';
  @Column('bigint') amountPence: string;
}
