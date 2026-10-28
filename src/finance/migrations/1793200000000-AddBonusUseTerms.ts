import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Preparation only. NOT registered in a live DataSource; no historical backfill. */
export class AddBonusUseTerms1793200000000 implements MigrationInterface {
 name='AddBonusUseTerms1793200000000';
 async up(q:QueryRunner){await q.query(`
CREATE TABLE finance_bonus_use_activation(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), effective timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO finance_bonus_use_activation DEFAULT VALUES;
CREATE TABLE finance_bonus_use_terms(
 lot uuid PRIMARY KEY REFERENCES finance_bonus_lots(id),
 version text NOT NULL CHECK(version='BONUS_APPLICATION_2026_10_28'),
 basis text NOT NULL CHECK(basis IN ('receipt','transfer')),
 reference uuid NOT NULL, started timestamptz NOT NULL, until timestamptz NOT NULL,
 CHECK(until>started)
);
CREATE FUNCTION finance_bonus_use_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE stamp timestamptz; born timestamptz; boundary timestamptz;
BEGIN
 SELECT effective INTO boundary FROM finance_bonus_use_activation;
 SELECT min("createdAt") INTO born FROM finance_domain_commands WHERE result->>'lotId'=NEW.lot::text;
 IF born IS NULL OR born<boundary THEN RAISE EXCEPTION 'Historical transition not approved'; END IF;
 IF NEW.basis='receipt' THEN
  SELECT r."receivedAt" INTO stamp FROM finance_receipt_settlements s
  JOIN finance_bonus_lots l ON l.id=s.lot JOIN finance_bank_receipts r ON r.id=s.receipt
  WHERE l.id=NEW.lot AND l.kind='bonus' AND s.receipt=NEW.reference AND r.currency='GBP' AND r."verificationStatus"='verified';
 ELSE
  IF NOT EXISTS(SELECT 1 FROM finance_lot_transfers t JOIN finance_bonus_lots l ON l.id=t.child WHERE t.id=NEW.reference AND t.child=NEW.lot AND l.kind='bonus') THEN
   RAISE EXCEPTION 'Completed bonus transfer required';
  END IF;
  stamp=clock_timestamp();
 END IF;
 IF stamp IS NULL THEN RAISE EXCEPTION 'Verified actual receipt required'; END IF;
 NEW.started=stamp;
 NEW.until=((stamp AT TIME ZONE 'UTC')+interval '6 months') AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
CREATE TRIGGER finance_bonus_use_guard BEFORE INSERT ON finance_bonus_use_terms FOR EACH ROW EXECUTE FUNCTION finance_bonus_use_guard();
CREATE TRIGGER finance_bonus_use_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_bonus_use_terms FOR EACH STATEMENT EXECUTE FUNCTION finance_domain_immutable();
CREATE TRIGGER finance_bonus_use_cutover_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_bonus_use_activation FOR EACH STATEMENT EXECUTE FUNCTION finance_domain_immutable();
`);}
 async down(q:QueryRunner){
  const [r]=await q.query('SELECT count(*)::int AS n FROM finance_bonus_use_terms');
  if(r.n)throw Error('Application history exists; destructive rollback refused');
  await q.query('DROP TABLE finance_bonus_use_terms; DROP FUNCTION finance_bonus_use_guard(); DROP TABLE finance_bonus_use_activation;');
 }
}
