import type {MigrationInterface,QueryRunner} from 'typeorm';
export class AddPolicy21Allocations1792540000000 implements MigrationInterface {
 name='AddPolicy21Allocations1792540000000';
 async up(q:QueryRunner){await q.query(`
ALTER TABLE finance_policy_records DROP CONSTRAINT finance_policy_records_policy_check;
ALTER TABLE finance_policy_records ADD CONSTRAINT finance_policy_records_policy_check CHECK(policy IN ('FINANCIAL_BUSINESS_POLICY_2026_10_20','FINANCIAL_POLICY_2026_10_21'));
ALTER TABLE finance_policy_debt_evidence DROP CONSTRAINT finance_policy_debt_evidence_policy_check;
ALTER TABLE finance_policy_debt_evidence ADD CONSTRAINT finance_policy_debt_evidence_policy_check CHECK(policy IN ('FINANCIAL_BUSINESS_POLICY_2026_10_20','FINANCIAL_POLICY_2026_10_21'));
CREATE TABLE finance_policy_recovery_slices(
 id uuid PRIMARY KEY, journal uuid NOT NULL REFERENCES finance_journals(id),
 debt uuid REFERENCES finance_verified_debts(id), scope text,
 lot uuid NOT NULL REFERENCES finance_bonus_lots(id), account uuid NOT NULL REFERENCES finance_accounts(id),
 kind text NOT NULL CHECK(kind IN ('collection','restoration')), amount bigint NOT NULL CHECK(amount>0),
 UNIQUE NULLS NOT DISTINCT(journal,lot,account,kind,debt)
);
CREATE TRIGGER finance_policy_slices_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_policy_recovery_slices FOR EACH STATEMENT EXECUTE FUNCTION finance_domain_immutable();
CREATE FUNCTION finance_policy_slice_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM finance_bonus_lots l JOIN finance_accounts a ON a.id=NEW.account WHERE l.id=NEW.lot AND a."ownerReference"=l.owner AND a.currency='GBP' AND a."normalSide"='credit') THEN RAISE EXCEPTION 'Recovery source ownership mismatch';END IF;
 IF NOT EXISTS(SELECT 1 FROM finance_postings p JOIN finance_journals j ON j.id=p."journalId" WHERE j.id=NEW.journal AND j.sealed AND p."accountId"=NEW.account AND p.side=CASE WHEN NEW.kind='collection' THEN 'debit' ELSE 'credit' END AND p."amountPence">=NEW.amount) THEN RAISE EXCEPTION 'Recovery source posting mismatch'; END IF;
 IF (SELECT COALESCE(sum(s.amount),0) FROM finance_policy_recovery_slices s WHERE s.journal=NEW.journal AND s.account=NEW.account AND s.kind=NEW.kind)+NEW.amount>
 (SELECT COALESCE(sum(p."amountPence"),0) FROM finance_postings p WHERE p."journalId"=NEW.journal AND p."accountId"=NEW.account AND p.side=CASE WHEN NEW.kind='collection' THEN 'debit' ELSE 'credit' END) THEN RAISE EXCEPTION 'Recovery slices exceed actual posting';END IF;
 IF NEW.debt IS NOT NULL AND NEW.kind='collection' AND
 (SELECT COALESCE(sum(s.amount),0) FROM finance_policy_recovery_slices s WHERE s.journal=NEW.journal AND s.debt=NEW.debt AND s.kind='collection')+NEW.amount>
 (SELECT COALESCE(sum(p."amountPence"),0) FROM finance_postings p JOIN finance_verified_debts d ON d.account=p."accountId" WHERE d.id=NEW.debt AND p."journalId"=NEW.journal AND p.side='credit') THEN RAISE EXCEPTION 'Recovery slices exceed actual debt collection';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_policy_slice_owner BEFORE INSERT ON finance_policy_recovery_slices FOR EACH ROW EXECUTE FUNCTION finance_policy_slice_owner();
`);}
 async down():Promise<never>{throw Error('No destructive financial-policy rollback');}
}
