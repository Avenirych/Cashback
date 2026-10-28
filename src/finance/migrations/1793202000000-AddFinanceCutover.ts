import type {MigrationInterface,QueryRunner} from 'typeorm';
/** Economic boundary, separate from migration installation time. Admission remains OFF. */
export class AddFinanceCutover1793202000000 implements MigrationInterface {
 name='AddFinanceCutover1793202000000';
 async up(q:QueryRunner){await q.query(`
 CREATE TABLE finance_cutover_policy(singleton boolean PRIMARY KEY CHECK(singleton),boundary timestamptz NOT NULL,version text NOT NULL,admission_enabled boolean NOT NULL CHECK(NOT admission_enabled));
 INSERT INTO finance_cutover_policy VALUES(true,'2026-11-01T00:00:00Z','CUTOVER_2026_11_01',false);
 CREATE TRIGGER finance_cutover_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_cutover_policy FOR EACH STATEMENT EXECUTE FUNCTION finance_domain_immutable();
 CREATE TABLE finance_historical_reviews(source_system text NOT NULL,source_id text NOT NULL,reason text NOT NULL CHECK(reason IN ('DATE_UNPROVEN','OWNER_UNPROVEN','DEADLINE_CONFLICT','TRANSFER_CHAIN_UNPROVEN','PARTIAL_HISTORY_UNRECONCILED','OBLIGATION_PAYOUT_UNRECONCILED','DEBT_LINK_UNPROVEN','LATE_PRE_CUTOVER_EVENT')),original_record jsonb NOT NULL CHECK(jsonb_typeof(original_record)='object'),verified_received_at timestamptz,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(source_system,source_id,reason),CHECK(reason<>'DATE_UNPROVEN' OR verified_received_at IS NULL));
 CREATE TRIGGER finance_reviews_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON finance_historical_reviews FOR EACH STATEMENT EXECUTE FUNCTION finance_domain_immutable();
 CREATE FUNCTION finance_economic_cutover_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
 DECLARE boundary_time timestamptz; receipt_time timestamptz;
 BEGIN
 IF NOT (SELECT admission_enabled FROM public.finance_cutover_policy WHERE singleton) THEN RAISE EXCEPTION 'Financial admission not approved'; END IF;
 SELECT boundary INTO STRICT boundary_time FROM public.finance_cutover_policy WHERE singleton;
 IF NEW.basis='receipt' THEN
 SELECT r."receivedAt" INTO receipt_time FROM public.finance_receipt_settlements s JOIN public.finance_bank_receipts r ON r.id=s.receipt WHERE s.lot=NEW.lot AND r.id=NEW.reference AND r."verificationStatus"='verified';
 IF receipt_time IS NULL OR receipt_time<boundary_time OR receipt_time>clock_timestamp() THEN RAISE EXCEPTION 'Historical receipt requires separate review'; END IF;
 ELSE
 IF clock_timestamp()<boundary_time OR NOT EXISTS(SELECT 1 FROM public.finance_lot_transfers x JOIN public.finance_bonus_use_terms p ON p.lot=x.parent WHERE x.child=NEW.lot AND x.id=NEW.reference) THEN RAISE EXCEPTION 'Admitted new parent and completed post-cutover transfer required'; END IF;
 END IF;
 RETURN NEW;
 END $$;
 CREATE TRIGGER aa_finance_economic_cutover_guard BEFORE INSERT ON finance_bonus_use_terms FOR EACH ROW EXECUTE FUNCTION finance_economic_cutover_guard();
 `);}
 async down(q:QueryRunner){const [r]=await q.query('SELECT (SELECT count(*) FROM finance_historical_reviews)+(SELECT count(*) FROM finance_bonus_use_terms) AS n');if(BigInt(r.n)!==0n)throw Error('History exists; forward-only rollback required');await q.query('DROP TRIGGER aa_finance_economic_cutover_guard ON finance_bonus_use_terms; DROP FUNCTION finance_economic_cutover_guard(); DROP TABLE finance_historical_reviews; DROP TABLE finance_cutover_policy;');}
}
