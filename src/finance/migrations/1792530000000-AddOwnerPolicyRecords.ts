import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Isolated-only policy records. Never registered with the live DataSource. */
export class AddOwnerPolicyRecords1792530000000 implements MigrationInterface {
 name='AddOwnerPolicyRecords1792530000000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
CREATE TABLE public.finance_policy_records (
 sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 kind varchar(40) NOT NULL, scope varchar(400) NOT NULL, key varchar(160) NOT NULL,
 policy varchar(60) NOT NULL CHECK(policy='FINANCIAL_BUSINESS_POLICY_2026_10_20'),
 payload jsonb NOT NULL, hash varchar(64) NOT NULL,
 journal uuid REFERENCES public.finance_journals(id),
 "ingestedAt" timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(kind,scope,key)
);
CREATE UNIQUE INDEX finance_policy_order_version ON public.finance_policy_records((payload->>'orderSource'),(payload->>'orderId'),(payload->>'version')) WHERE kind='order';
CREATE TABLE public.finance_policy_debt_evidence (
 debt uuid PRIMARY KEY REFERENCES public.finance_verified_debts(id),
 "confirmedAt" timestamptz NOT NULL, proof varchar(160) NOT NULL,
 policy varchar(60) NOT NULL CHECK(policy='FINANCIAL_BUSINESS_POLICY_2026_10_20')
);
CREATE TRIGGER finance_policy_records_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_policy_records FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE TRIGGER finance_policy_debt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_policy_debt_evidence FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
ALTER TABLE public.finance_bonus_reservations DROP CONSTRAINT finance_bonus_reservations_state_check;
ALTER TABLE public.finance_bonus_reservations ADD CONSTRAINT finance_bonus_reservations_state_check CHECK(state IN ('active','released','consumed'));
`);}
 async down():Promise<void>{throw Error('No destructive financial history rollback');}
}
