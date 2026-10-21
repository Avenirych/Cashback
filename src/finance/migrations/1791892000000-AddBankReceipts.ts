import type { MigrationInterface, QueryRunner } from 'typeorm';
/** Receipt-only extension. Apply exclusively to an explicitly verified finance database. */
export class AddBankReceipts1791892000000 implements MigrationInterface {
 name = 'AddBankReceipts1791892000000';
 async up(q:QueryRunner):Promise<void> {
  await q.query(`
ALTER TABLE public.finance_accounts DROP CONSTRAINT finance_accounts_kind_check;
ALTER TABLE public.finance_accounts DROP CONSTRAINT finance_accounts_check;
ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_kind_check CHECK(kind IN ('user_gbp','platform_income','bonus_liability','reserved','user_debt','clearing','company_bank_cash','unallocated_received_funds'));
ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_check CHECK(
 (kind IN ('user_debt','clearing','company_bank_cash') AND "normalSide"='debit') OR
 (kind IN ('user_gbp','platform_income','bonus_liability','reserved','unallocated_received_funds') AND "normalSide"='credit'));
CREATE TABLE public.finance_bank_receipts (
 id uuid PRIMARY KEY,
 "sourceNamespace" varchar(60) NOT NULL CHECK("sourceNamespace" ~ '^[A-Za-z0-9:_-]{3,60}$'),
 "accountScope" uuid NOT NULL,
 "transactionId" varchar(160) NOT NULL CHECK("transactionId" ~ '^[A-Za-z0-9:_-]{1,160}$'),
 "idempotencyKey" varchar(100) NOT NULL UNIQUE,
 "materialHash" varchar(64) NOT NULL CHECK("materialHash" ~ '^[0-9a-f]{64}$'),
 currency varchar(3) NOT NULL CHECK(currency='GBP'), "amountPence" bigint NOT NULL CHECK("amountPence">0),
 "receivedAt" timestamptz NOT NULL,
 "verificationId" uuid NOT NULL, "evidenceReference" uuid NOT NULL,
 "verifierReference" varchar(60) NOT NULL CHECK("verifierReference" ~ '^[A-Za-z0-9:_-]{3,60}$'),
 "verificationStatus" varchar(20) NOT NULL CHECK("verificationStatus"='verified'),
 "journalId" uuid NOT NULL UNIQUE REFERENCES public.finance_journals(id),
 "eventId" uuid NOT NULL UNIQUE REFERENCES public.finance_outbox("eventId"),
 "bankAccountId" uuid NOT NULL REFERENCES public.finance_accounts(id),
 "unallocatedAccountId" uuid NOT NULL REFERENCES public.finance_accounts(id),
 UNIQUE("sourceNamespace","accountScope","transactionId"),
 CHECK("bankAccountId"<>"unallocatedAccountId"), CHECK("eventId"=id)
);
CREATE TABLE public.finance_funding_lots (
 id uuid PRIMARY KEY, "receiptId" uuid NOT NULL UNIQUE REFERENCES public.finance_bank_receipts(id),
 currency varchar(3) NOT NULL CHECK(currency='GBP'), "amountPence" bigint NOT NULL CHECK("amountPence">0),
 status varchar(20) NOT NULL CHECK(status='restricted'),
 purpose varchar(40) NOT NULL CHECK(purpose='awaiting_classification')
);
CREATE FUNCTION public.finance_receipt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable bank receipt/funding lot' USING ERRCODE='23514'; END $$;
CREATE TRIGGER finance_receipt_immutable BEFORE UPDATE OR DELETE ON public.finance_bank_receipts FOR EACH ROW EXECUTE FUNCTION public.finance_receipt_immutable();
CREATE TRIGGER finance_lot_immutable BEFORE UPDATE OR DELETE ON public.finance_funding_lots FOR EACH ROW EXECUTE FUNCTION public.finance_receipt_immutable();
CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON public.finance_bank_receipts FOR EACH STATEMENT EXECUTE FUNCTION public.finance_reject_truncate();
CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON public.finance_funding_lots FOR EACH STATEMENT EXECUTE FUNCTION public.finance_reject_truncate();
CREATE FUNCTION public.finance_check_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n bigint; valid boolean;
BEGIN
 SELECT count(*) INTO n FROM public.finance_funding_lots WHERE "receiptId"=NEW.id AND currency=NEW.currency AND "amountPence"=NEW."amountPence" AND status='restricted';
 IF n<>1 THEN RAISE EXCEPTION 'Receipt requires one matching restricted lot' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO n FROM public.finance_postings WHERE "journalId"=NEW."journalId";
 SELECT EXISTS(SELECT 1 FROM public.finance_journals j JOIN public.finance_outbox o ON o."journalId"=j.id
 WHERE j.id=NEW."journalId" AND j.sealed AND j."eventKey"=NEW."idempotencyKey" AND o."eventId"=NEW."eventId" AND o."operationId"=NEW.id) INTO valid;
 IF NOT valid OR n<>2 OR
 NOT EXISTS(SELECT 1 FROM public.finance_postings p JOIN public.finance_accounts a ON a.id=p."accountId" WHERE p."journalId"=NEW."journalId" AND p."accountId"=NEW."bankAccountId" AND p.side='debit' AND p."amountPence"=NEW."amountPence" AND a.kind='company_bank_cash') OR
 NOT EXISTS(SELECT 1 FROM public.finance_postings p JOIN public.finance_accounts a ON a.id=p."accountId" WHERE p."journalId"=NEW."journalId" AND p."accountId"=NEW."unallocatedAccountId" AND p.side='credit' AND p."amountPence"=NEW."amountPence" AND a.kind='unallocated_received_funds') THEN
 RAISE EXCEPTION 'Receipt ledger/outbox mismatch' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_receipt_complete AFTER INSERT ON public.finance_bank_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_receipt();
CREATE FUNCTION public.finance_check_lot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.finance_bank_receipts r WHERE r.id=NEW."receiptId" AND r.currency=NEW.currency AND r."amountPence"=NEW."amountPence") THEN
 RAISE EXCEPTION 'Funding lot amount mismatch' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_lot_matches BEFORE INSERT ON public.finance_funding_lots FOR EACH ROW EXECUTE FUNCTION public.finance_check_lot();
`);
 }
 async down(q:QueryRunner):Promise<void> {
  // Refuse destructive rollback with any receipts or newly introduced accounts.
  await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.finance_bank_receipts) OR EXISTS(SELECT 1 FROM public.finance_accounts WHERE kind IN ('company_bank_cash','unallocated_received_funds')) THEN RAISE EXCEPTION 'Bank receipt rollback requires an empty extension'; END IF; END $$;
DROP TABLE public.finance_funding_lots;
DROP TABLE public.finance_bank_receipts;
DROP FUNCTION public.finance_check_lot(); DROP FUNCTION public.finance_check_receipt(); DROP FUNCTION public.finance_receipt_immutable();
ALTER TABLE public.finance_accounts DROP CONSTRAINT finance_accounts_kind_check;
ALTER TABLE public.finance_accounts DROP CONSTRAINT finance_accounts_check;
ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_kind_check CHECK(kind IN ('user_gbp','platform_income','bonus_liability','reserved','user_debt','clearing'));
ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_check CHECK((kind IN ('user_debt','clearing') AND "normalSide"='debit') OR (kind IN ('user_gbp','platform_income','bonus_liability','reserved') AND "normalSide"='credit'));`);
 }
}
