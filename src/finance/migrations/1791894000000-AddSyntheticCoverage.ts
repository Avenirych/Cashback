import type { MigrationInterface, QueryRunner } from 'typeorm';
/** Isolated synthetic metadata only; no ledger/account changes or release functions. */
export class AddSyntheticCoverage1791894000000 implements MigrationInterface {
 name='AddSyntheticCoverage1791894000000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
CREATE TABLE public.finance_coverage_mandates(
 id uuid PRIMARY KEY,"principalId" uuid NOT NULL,"contextId" uuid NOT NULL,
 purpose varchar(30) NOT NULL CHECK(purpose='synthetic_test_coverage'),currency varchar(3) NOT NULL CHECK(currency='GBP'),
 "limitPence" bigint NOT NULL CHECK("limitPence">0),"allowedLotIds" uuid[] NOT NULL CHECK(cardinality("allowedLotIds") BETWEEN 1 AND 100)
);
CREATE TABLE public.finance_coverage_targets(
 id uuid PRIMARY KEY,"contextId" uuid NOT NULL,"creatorId" uuid NOT NULL,
 "creationMandateId" uuid NOT NULL REFERENCES public.finance_coverage_mandates(id),
 kind varchar(30) NOT NULL CHECK(kind='synthetic_test_coverage'),currency varchar(3) NOT NULL CHECK(currency='GBP'),
 "amountPence" bigint NOT NULL CHECK("amountPence">0),state varchar(8) NOT NULL CHECK(state IN ('created','reserved')),
 "creationKey" varchar(160) NOT NULL UNIQUE,"creationHash" varchar(64) NOT NULL CHECK("creationHash" ~ '^[0-9a-f]{64}$')
);
CREATE TABLE public.finance_coverage_reservations(
 id uuid PRIMARY KEY,"commandKey" varchar(160) NOT NULL UNIQUE,"requestHash" varchar(64) NOT NULL CHECK("requestHash" ~ '^[0-9a-f]{64}$'),
 "targetId" uuid NOT NULL UNIQUE REFERENCES public.finance_coverage_targets(id),
 "mandateId" uuid NOT NULL REFERENCES public.finance_coverage_mandates(id),result jsonb NOT NULL,
 CHECK((jsonb_typeof(result)='object' AND jsonb_typeof(result->'allocationIds')='array' AND result->>'reservationId'=id::text AND result->>'targetId'="targetId"::text AND result->>'mandateId'="mandateId"::text AND result->>'currency'='GBP' AND result->>'purpose'='synthetic_test_coverage') IS TRUE)
);
CREATE TABLE public.finance_coverage_allocations(
 id uuid PRIMARY KEY,"reservationId" uuid NOT NULL REFERENCES public.finance_coverage_reservations(id),
 "lotId" uuid NOT NULL REFERENCES public.finance_funding_lots(id),"amountPence" bigint NOT NULL CHECK("amountPence">0),
 currency varchar(3) NOT NULL CHECK(currency='GBP'),state varchar(8) NOT NULL CHECK(state='held'),
 UNIQUE("reservationId","lotId")
);
CREATE INDEX finance_coverage_lot_idx ON public.finance_coverage_allocations("lotId");
CREATE INDEX finance_coverage_mandate_idx ON public.finance_coverage_reservations("mandateId");
CREATE FUNCTION public.finance_coverage_target_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g record; BEGIN
 IF TG_OP='INSERT' THEN
  SELECT * INTO g FROM public.finance_coverage_mandates WHERE id=NEW."creationMandateId";
  IF NEW.state<>'created' OR NEW."creatorId"<>g."principalId" OR NEW."contextId"<>g."contextId" THEN RAISE EXCEPTION 'Invalid synthetic target context' USING ERRCODE='23514'; END IF;RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND OLD.state='created' AND NEW.state='reserved' AND
 ROW(NEW.id,NEW."contextId",NEW."creatorId",NEW."creationMandateId",NEW.kind,NEW.currency,NEW."amountPence",NEW."creationKey",NEW."creationHash") IS NOT DISTINCT FROM ROW(OLD.id,OLD."contextId",OLD."creatorId",OLD."creationMandateId",OLD.kind,OLD.currency,OLD."amountPence",OLD."creationKey",OLD."creationHash") THEN RETURN NEW;END IF;
 RAISE EXCEPTION 'Immutable synthetic target or invalid transition' USING ERRCODE='23514';
END $$;
CREATE TRIGGER finance_coverage_target_guard BEFORE INSERT OR UPDATE OR DELETE ON public.finance_coverage_targets FOR EACH ROW EXECUTE FUNCTION public.finance_coverage_target_guard();
CREATE FUNCTION public.finance_coverage_allocation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l record; g record; t record; r record; used numeric; current_state text;
BEGIN
 -- Direct SQL inserts still serialize against evidence revoke before capacity locks.
 PERFORM pg_advisory_xact_lock(726405,0);
 SELECT * INTO r FROM public.finance_coverage_reservations WHERE id=NEW."reservationId";
 SELECT * INTO l FROM public.finance_funding_lots WHERE id=NEW."lotId";
 SELECT o.state INTO current_state FROM public.finance_bank_operations o WHERE o."receiptId"=l."receiptId";
 IF current_state IS DISTINCT FROM 'eligible' THEN RAISE EXCEPTION 'Coverage evidence blocked' USING ERRCODE='23514';END IF;
 PERFORM id FROM public.finance_funding_lots WHERE id=NEW."lotId" FOR UPDATE;
 SELECT * INTO g FROM public.finance_coverage_mandates WHERE id=r."mandateId" FOR UPDATE;
 SELECT * INTO t FROM public.finance_coverage_targets WHERE id=r."targetId" FOR UPDATE;
 IF l.status<>'restricted' OR NEW.currency<>l.currency OR g."contextId"<>t."contextId" OR g."principalId"<>t."creatorId" OR NOT(NEW."lotId"=ANY(g."allowedLotIds")) OR t.state<>'created' THEN
 RAISE EXCEPTION 'Invalid synthetic coverage scope' USING ERRCODE='23514';END IF;
 SELECT COALESCE(sum("amountPence"),0) INTO used FROM public.finance_coverage_allocations WHERE "lotId"=NEW."lotId";
 IF used+NEW."amountPence">l."amountPence" THEN RAISE EXCEPTION 'Lot coverage capacity exceeded' USING ERRCODE='23514';END IF;
 SELECT COALESCE(sum(a."amountPence"),0) INTO used FROM public.finance_coverage_allocations a JOIN public.finance_coverage_reservations x ON x.id=a."reservationId" WHERE x."mandateId"=g.id;
 IF used+NEW."amountPence">g."limitPence" THEN RAISE EXCEPTION 'Mandate coverage capacity exceeded' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER finance_coverage_allocation_guard BEFORE INSERT ON public.finance_coverage_allocations FOR EACH ROW EXECUTE FUNCTION public.finance_coverage_allocation_guard();
CREATE FUNCTION public.finance_check_coverage_target() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t record; n bigint; total numeric; r record;
BEGIN
 SELECT * INTO t FROM public.finance_coverage_targets WHERE id=NEW.id;
 SELECT count(*) INTO n FROM public.finance_coverage_reservations WHERE "targetId"=t.id;
 IF t.state='created' THEN IF n<>0 THEN RAISE EXCEPTION 'Created target cannot have reservation' USING ERRCODE='23514';END IF;RETURN NULL;END IF;
 IF n<>1 THEN RAISE EXCEPTION 'Full coverage reservation required' USING ERRCODE='23514';END IF;
 SELECT * INTO r FROM public.finance_coverage_reservations WHERE "targetId"=t.id;
 SELECT count(*),COALESCE(sum("amountPence"),0) INTO n,total FROM public.finance_coverage_allocations WHERE "reservationId"=r.id;
 IF n<1 OR total<>t."amountPence" OR r.result->>'amountPence' IS DISTINCT FROM t."amountPence"::text OR jsonb_array_length(r.result->'allocationIds')<>n OR
 (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(r.result->'allocationIds'))<>n OR
 EXISTS(SELECT 1 FROM jsonb_array_elements_text(r.result->'allocationIds') x WHERE NOT EXISTS(SELECT 1 FROM public.finance_coverage_allocations a WHERE a."reservationId"=r.id AND a.id::text=x.value)) THEN
 RAISE EXCEPTION 'Exact full synthetic coverage required' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_coverage_complete AFTER INSERT OR UPDATE ON public.finance_coverage_targets DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_coverage_target();
CREATE FUNCTION public.finance_check_reservation_target() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.finance_coverage_targets WHERE id=NEW."targetId" AND state='reserved') THEN RAISE EXCEPTION 'Reservation requires reserved target' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_reservation_complete AFTER INSERT ON public.finance_coverage_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_reservation_target();
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['finance_coverage_mandates','finance_coverage_reservations','finance_coverage_allocations'] LOOP
 EXECUTE format('CREATE TRIGGER finance_coverage_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_evidence_immutable()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['finance_coverage_targets','finance_coverage_mandates','finance_coverage_reservations','finance_coverage_allocations'] LOOP
 EXECUTE format('CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.finance_reject_truncate()',t);
 END LOOP;
END $$;
`);}
 async down():Promise<never>{throw Error('Synthetic coverage history has no automatic destructive rollback');}
}
