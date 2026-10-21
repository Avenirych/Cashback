import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Isolated only; requires core/outbox/receipts and lot-operations migrations. */
export class AddIsolatedReceiptSettlement1792511000000 implements MigrationInterface {
 name='AddIsolatedReceiptSettlement1792511000000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
ALTER TABLE public.finance_accounts DROP CONSTRAINT finance_accounts_kind_check;
ALTER TABLE public.finance_accounts DROP CONSTRAINT finance_accounts_check;
ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_kind_check CHECK(kind IN ('user_gbp','platform_income','bonus_liability','reserved','user_debt','clearing','company_bank_cash','unallocated_received_funds','bank_fee_expense','transfer_expense','other_expense'));
ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_check CHECK(
 (kind IN ('user_debt','clearing','company_bank_cash','bank_fee_expense','transfer_expense','other_expense') AND "normalSide"='debit') OR
 (kind IN ('user_gbp','platform_income','bonus_liability','reserved','unallocated_received_funds') AND "normalSide"='credit'));
CREATE TABLE public.finance_receipt_settlements (
 id uuid PRIMARY KEY, source varchar(160) NOT NULL UNIQUE, receipt uuid NOT NULL UNIQUE REFERENCES public.finance_bank_receipts(id),
 actor varchar(160) NOT NULL, "materialHash" varchar(64) NOT NULL,
 gross bigint NOT NULL CHECK(gross>0), "userGross" bigint NOT NULL CHECK("userGross">=0),
 "platformGross" bigint NOT NULL CHECK("platformGross">=0), expenses bigint NOT NULL CHECK(expenses>=0),
 "debtOffset" bigint NOT NULL CHECK("debtOffset">=0 AND "debtOffset"<="userGross"),
 lot uuid REFERENCES public.finance_bonus_lots(id), journal uuid NOT NULL UNIQUE REFERENCES public.finance_journals(id),
 result jsonb NOT NULL, CHECK(gross="userGross"+"platformGross")
);
CREATE TABLE public.finance_settlement_expenses (
 journal uuid PRIMARY KEY REFERENCES public.finance_journals(id),
 settlement uuid NOT NULL REFERENCES public.finance_receipt_settlements(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TRIGGER finance_settlement_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_receipt_settlements FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE TRIGGER finance_expense_assignment_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.finance_settlement_expenses FOR EACH STATEMENT EXECUTE FUNCTION public.finance_domain_immutable();
CREATE FUNCTION public.finance_no_settled_coverage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r uuid;
BEGIN
 SELECT "receiptId" INTO r FROM public.finance_funding_lots WHERE id=NEW."lotId" FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.finance_receipt_settlements WHERE receipt=r) THEN RAISE EXCEPTION 'Receipt already economically allocated'; END IF;
 RETURN NEW;
END $$;
DO $$ BEGIN IF to_regclass('public.finance_coverage_allocations') IS NOT NULL THEN
 CREATE TRIGGER finance_no_settled_coverage BEFORE INSERT ON public.finance_coverage_allocations FOR EACH ROW EXECUTE FUNCTION public.finance_no_settled_coverage();
END IF; END $$;
`);}
 async down():Promise<void>{throw new Error('No destructive settlement history rollback');}
}
