import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Requires the existing evidence + synthetic coverage migrations. Isolated only. */
export class CoordinateCoverageRepayment1792541000000 implements MigrationInterface {
 name='CoordinateCoverageRepayment1792541000000';
 async up(q:QueryRunner){await q.query(`
CREATE TABLE finance_coverage_releases(
 id uuid PRIMARY KEY, allocation uuid NOT NULL REFERENCES finance_coverage_allocations(id),
 command text NOT NULL UNIQUE, actor uuid NOT NULL, amount bigint NOT NULL CHECK(amount>0), proof text NOT NULL
);
CREATE TABLE finance_receipt_repayments(
 receipt uuid PRIMARY KEY REFERENCES finance_bank_receipts(id),debt uuid NOT NULL REFERENCES finance_verified_debts(id),
 journal uuid NOT NULL UNIQUE REFERENCES finance_journals(id),amount bigint NOT NULL CHECK(amount>0)
);
CREATE FUNCTION finance_active_coverage(a uuid) RETURNS numeric LANGUAGE sql STABLE AS $$
 SELECT x."amountPence"-COALESCE((SELECT sum(r.amount) FROM finance_coverage_releases r WHERE r.allocation=x.id),0) FROM finance_coverage_allocations x WHERE x.id=a
$$;
CREATE FUNCTION finance_policy_coverage_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lot uuid; receipt_id uuid; capacity numeric; used numeric; n numeric; increment numeric;
BEGIN
 PERFORM pg_advisory_xact_lock(726405,0);
 IF TG_TABLE_NAME='finance_coverage_releases' THEN
  IF NOT EXISTS(SELECT 1 FROM finance_coverage_allocations a JOIN finance_coverage_reservations r ON r.id=a."reservationId" JOIN finance_coverage_targets t ON t.id=r."targetId" WHERE a.id=NEW.allocation AND t."creatorId"=NEW.actor) THEN RAISE EXCEPTION 'Coverage release ownership mismatch';END IF;
  SELECT "lotId" INTO lot FROM finance_coverage_allocations WHERE id=NEW.allocation;
 ELSE
  IF TG_TABLE_NAME='finance_receipt_repayments' THEN SELECT id INTO lot FROM finance_funding_lots WHERE "receiptId"=NEW.receipt;
  ELSE lot:=NEW."lotId";END IF;
 END IF;
 SELECT "amountPence","receiptId" INTO capacity,receipt_id FROM finance_funding_lots WHERE id=lot FOR UPDATE;
 IF capacity IS NULL THEN RAISE EXCEPTION 'Verified funding lot required';END IF;
 IF TG_TABLE_NAME='finance_coverage_releases' THEN
  IF NEW.amount>finance_active_coverage(NEW.allocation) THEN RAISE EXCEPTION 'Coverage release exceeds remaining allocation';END IF;
  RETURN NEW;
 END IF;
 SELECT COALESCE(sum(finance_active_coverage(a.id)),0) INTO used FROM finance_coverage_allocations a WHERE a."lotId"=lot;
 SELECT COALESCE(sum(r.amount),0) INTO n FROM finance_receipt_repayments r WHERE r.receipt=receipt_id;
 IF TG_TABLE_NAME='finance_receipt_repayments' THEN increment:=NEW.amount; ELSE increment:=NEW."amountPence"; END IF;
 IF used+n+increment>capacity THEN RAISE EXCEPTION 'Receipt capacity already allocated';END IF;
 IF TG_TABLE_NAME='finance_receipt_repayments' THEN
  IF NOT EXISTS(SELECT 1 FROM finance_bank_operations WHERE "receiptId"=NEW.receipt AND state='eligible') OR EXISTS(SELECT 1 FROM finance_receipt_settlements WHERE receipt=NEW.receipt) OR
  NOT EXISTS(SELECT 1 FROM finance_bank_receipts r JOIN finance_postings p ON p."accountId"=r."unallocatedAccountId" JOIN finance_journals j ON j.id=p."journalId" WHERE r.id=NEW.receipt AND j.id=NEW.journal AND j.sealed AND p.side='debit' AND p."amountPence"=NEW.amount) OR
  NOT EXISTS(SELECT 1 FROM finance_verified_debts d JOIN finance_postings p ON p."accountId"=d.account WHERE d.id=NEW.debt AND p."journalId"=NEW.journal AND p.side='credit' AND p."amountPence"=NEW.amount)
  THEN RAISE EXCEPTION 'Receipt/debt journal reconciliation failed';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_policy_coverage_guard BEFORE INSERT ON finance_coverage_allocations FOR EACH ROW EXECUTE FUNCTION finance_policy_coverage_guard();
CREATE TRIGGER finance_policy_release_guard BEFORE INSERT ON finance_coverage_releases FOR EACH ROW EXECUTE FUNCTION finance_policy_coverage_guard();
CREATE TRIGGER finance_policy_repayment_guard BEFORE INSERT ON finance_receipt_repayments FOR EACH ROW EXECUTE FUNCTION finance_policy_coverage_guard();
CREATE TRIGGER finance_coverage_release_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_coverage_releases FOR EACH STATEMENT EXECUTE FUNCTION finance_domain_immutable();
CREATE TRIGGER finance_receipt_repayment_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_receipt_repayments FOR EACH STATEMENT EXECUTE FUNCTION finance_domain_immutable();
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('finance_coverage_allocation_guard()'::regprocedure) INTO definition;
 definition:=replace(definition,'sum("amountPence"),0) INTO used FROM public.finance_coverage_allocations WHERE "lotId"=NEW."lotId"','sum(finance_active_coverage(id)),0) INTO used FROM public.finance_coverage_allocations WHERE "lotId"=NEW."lotId"');
 definition:=replace(definition,'sum(a."amountPence"),0) INTO used','sum(finance_active_coverage(a.id)),0) INTO used');
 EXECUTE definition;
END $$;
`);}
 async down():Promise<never>{throw Error('No destructive coverage history rollback');}
}
