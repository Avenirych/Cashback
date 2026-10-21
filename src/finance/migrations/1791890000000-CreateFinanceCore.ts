import type { MigrationInterface, QueryRunner } from 'typeorm';
/** Prepared only. Not registered in any existing DataSource or AppModule. */
export class CreateFinanceCore1791890000000 implements MigrationInterface {
  name = 'CreateFinanceCore1791890000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
CREATE TABLE finance_accounts (
 id uuid PRIMARY KEY,
 "accountKey" varchar(160) NOT NULL CONSTRAINT "UQ_finance_account_key" UNIQUE,
 kind varchar(30) NOT NULL CHECK (kind IN ('user_gbp','platform_income','bonus_liability','reserved','user_debt','clearing')),
 "ownerReference" varchar(100), currency varchar(3) NOT NULL DEFAULT 'GBP' CHECK(currency='GBP'),
 "normalSide" varchar(6) NOT NULL CHECK("normalSide" IN ('debit','credit')),
 nonnegative boolean NOT NULL DEFAULT true,
 "balancePence" bigint NOT NULL DEFAULT 0,
 CHECK ((kind IN ('user_debt','clearing') AND "normalSide"='debit') OR
        (kind IN ('user_gbp','platform_income','bonus_liability','reserved') AND "normalSide"='credit')),
 CHECK (nonnegative OR kind='clearing')
);
CREATE TABLE finance_journals (
 id uuid PRIMARY KEY,
 "eventKey" varchar(160) NOT NULL CONSTRAINT "UQ_finance_event_key" UNIQUE,
 "requestHash" varchar(64) NOT NULL CHECK("requestHash" ~ '^[0-9a-f]{64}$'),
 sealed boolean NOT NULL DEFAULT false,
 "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE finance_postings (
 id uuid PRIMARY KEY, "journalId" uuid NOT NULL REFERENCES finance_journals(id),
 "accountId" uuid NOT NULL REFERENCES finance_accounts(id),
 side varchar(6) NOT NULL CHECK(side IN ('debit','credit')),
 "amountPence" bigint NOT NULL CHECK("amountPence">0)
);
CREATE INDEX "IDX_finance_postings_account" ON finance_postings("accountId");
CREATE INDEX "IDX_finance_postings_journal" ON finance_postings("journalId");
CREATE FUNCTION finance_protect_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND NOT OLD.sealed AND NEW.sealed AND
    NEW.id=OLD.id AND NEW."eventKey"=OLD."eventKey" AND
    NEW."requestHash"=OLD."requestHash" AND NEW."createdAt"=OLD."createdAt" THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Immutable finance journal' USING ERRCODE='23514';
END $$;
CREATE TRIGGER finance_journal_immutable BEFORE UPDATE OR DELETE ON finance_journals
 FOR EACH ROW EXECUTE FUNCTION finance_protect_journal();
CREATE FUNCTION finance_posting_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE closed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Immutable finance posting' USING ERRCODE='23514'; END IF;
 SELECT sealed INTO closed FROM finance_journals WHERE id=NEW."journalId" FOR UPDATE;
 IF closed IS DISTINCT FROM false THEN RAISE EXCEPTION 'Journal is sealed or absent' USING ERRCODE='23514'; END IF;
 UPDATE finance_accounts SET "balancePence"="balancePence" +
  CASE WHEN "normalSide"=NEW.side THEN NEW."amountPence" ELSE -NEW."amountPence" END
 WHERE id=NEW."accountId";
 RETURN NEW;
END $$;
CREATE TRIGGER finance_posting_immutable BEFORE INSERT OR UPDATE OR DELETE ON finance_postings
 FOR EACH ROW EXECUTE FUNCTION finance_posting_guard();
CREATE FUNCTION finance_account_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable finance account' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW."balancePence"<>0 THEN RAISE EXCEPTION 'Opening balances require postings' USING ERRCODE='23514'; END IF;
 ELSIF NEW.id IS DISTINCT FROM OLD.id OR NEW."accountKey" IS DISTINCT FROM OLD."accountKey" OR
       NEW.kind IS DISTINCT FROM OLD.kind OR NEW."ownerReference" IS DISTINCT FROM OLD."ownerReference" OR
       NEW.currency IS DISTINCT FROM OLD.currency OR NEW."normalSide" IS DISTINCT FROM OLD."normalSide" OR
       NEW.nonnegative IS DISTINCT FROM OLD.nonnegative OR pg_trigger_depth()<2 THEN
  RAISE EXCEPTION 'Account changes require postings' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_account_updates BEFORE INSERT OR UPDATE OR DELETE ON finance_accounts
 FOR EACH ROW EXECUTE FUNCTION finance_account_guard();
CREATE FUNCTION finance_reject_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Finance truncation forbidden' USING ERRCODE='23514'; END $$;
CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON finance_accounts
 FOR EACH STATEMENT EXECUTE FUNCTION finance_reject_truncate();
CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON finance_journals
 FOR EACH STATEMENT EXECUTE FUNCTION finance_reject_truncate();
CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON finance_postings
 FOR EACH STATEMENT EXECUTE FUNCTION finance_reject_truncate();
CREATE FUNCTION finance_check_account() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM finance_accounts WHERE id=NEW.id AND nonnegative AND "balancePence"<0) THEN
  RAISE EXCEPTION 'Negative finance balance' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_account_nonnegative AFTER INSERT OR UPDATE ON finance_accounts
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_check_account();
CREATE FUNCTION finance_check_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE closed boolean; n bigint; deb numeric; cred numeric;
BEGIN
 SELECT sealed INTO closed FROM finance_journals WHERE id=NEW.id;
 SELECT count(*), COALESCE(sum("amountPence") FILTER(WHERE side='debit'),0),
 COALESCE(sum("amountPence") FILTER(WHERE side='credit'),0) INTO n,deb,cred
 FROM finance_postings WHERE "journalId"=NEW.id;
 IF closed IS DISTINCT FROM true OR n<2 OR deb<>cred THEN
  RAISE EXCEPTION 'Unsealed or unbalanced journal' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_journal_balanced AFTER INSERT OR UPDATE ON finance_journals
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_check_journal();
`);
  }
  async down(q: QueryRunner): Promise<void> {
    // Future destructive operation restricted to the new core, never legacy tables.
    await q.query(`DROP TABLE finance_postings;
DROP TABLE finance_journals;
DROP TABLE finance_accounts;
DROP FUNCTION finance_reject_truncate();
DROP FUNCTION finance_check_journal();
DROP FUNCTION finance_check_account();
DROP FUNCTION finance_account_guard();
DROP FUNCTION finance_posting_guard();
DROP FUNCTION finance_protect_journal();`);
  }
}
