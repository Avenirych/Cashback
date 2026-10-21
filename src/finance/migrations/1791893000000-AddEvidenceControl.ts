import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AddEvidenceControl1791893000000 implements MigrationInterface {
 name='AddEvidenceControl1791893000000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
CREATE TABLE public.finance_bank_operations(
 id uuid PRIMARY KEY, identity varchar(64) NOT NULL UNIQUE CHECK(identity ~ '^[0-9a-f]{64}$'),
 "accountScope" uuid NOT NULL, facts jsonb NOT NULL, "factsHash" varchar(64) NOT NULL,
 state varchar(24) NOT NULL CHECK(state IN ('eligible','revoked')), version integer NOT NULL DEFAULT 1 CHECK(version>0),
 "receiptId" uuid UNIQUE REFERENCES public.finance_bank_receipts(id),
 CHECK(facts->>'currency'='GBP' AND facts->>'accountScope'="accountScope"::text AND facts->>'amountPence' ~ '^[1-9][0-9]*$')
);
CREATE TABLE public.finance_bank_observations(
 id uuid PRIMARY KEY,"evidenceReference" uuid NOT NULL,source varchar(160) NOT NULL,"accountScope" uuid NOT NULL,
 "nativeId" varchar(160),state varchar(24) NOT NULL CHECK(state IN ('pending_review','quarantined')),
 "submitterId" uuid NOT NULL,UNIQUE(source,"accountScope","nativeId")
);
CREATE TABLE public.finance_bank_decisions(
 id uuid PRIMARY KEY,"operationId" uuid NOT NULL REFERENCES public.finance_bank_operations(id),
 "observationId" uuid NOT NULL REFERENCES public.finance_bank_observations(id),"reviewerId" uuid NOT NULL,
 "verifierReference" varchar(60) NOT NULL,"documentReference" uuid
);
CREATE TABLE public.finance_bank_restore_reviews(
 id uuid PRIMARY KEY,"operationId" uuid NOT NULL REFERENCES public.finance_bank_operations(id),
 "operationVersion" integer NOT NULL,"reviewerId" uuid NOT NULL,
 "observationId" uuid NOT NULL REFERENCES public.finance_bank_observations(id),
 "documentReference" uuid NOT NULL,"verifierReference" varchar(60) NOT NULL
);
CREATE TABLE public.finance_evidence_events(
 id uuid PRIMARY KEY,"commandKey" varchar(160) NOT NULL UNIQUE,action varchar(20) NOT NULL CHECK(action IN ('submit','approve','revoke','recheck','restore')),
 "actorId" uuid NOT NULL,"requestHash" varchar(64) NOT NULL CHECK("requestHash" ~ '^[0-9a-f]{64}$'),
 data jsonb NOT NULL,result jsonb NOT NULL,"operationId" uuid REFERENCES public.finance_bank_operations(id),
 "operationVersion" integer, "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION public.finance_evidence_event_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."operationId" IS NOT NULL THEN SELECT version INTO NEW."operationVersion" FROM public.finance_bank_operations WHERE id=NEW."operationId"; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER finance_evidence_event_version BEFORE INSERT ON public.finance_evidence_events FOR EACH ROW EXECUTE FUNCTION public.finance_evidence_event_version();
CREATE FUNCTION public.finance_check_bank_control() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE op record;BEGIN
 SELECT * INTO op FROM public.finance_bank_operations WHERE id=NEW.id;
 IF NOT EXISTS(SELECT 1 FROM public.finance_bank_decisions d WHERE d."operationId"=op.id) OR NOT EXISTS(SELECT 1 FROM public.finance_evidence_events e WHERE e."operationId"=op.id AND e."operationVersion"=op.version AND ((op.state='eligible' AND e.action IN ('approve','restore')) OR (op.state='revoked' AND e.action='revoke'))) THEN
 RAISE EXCEPTION 'Bank control requires decision and atomic audit' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_bank_control_complete AFTER INSERT OR UPDATE ON public.finance_bank_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_bank_control();
CREATE FUNCTION public.finance_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Immutable evidence history' USING ERRCODE='23514';END $$;
CREATE FUNCTION public.finance_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Immutable bank operation' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.id,NEW.identity,NEW."accountScope",NEW.facts,NEW."factsHash") IS DISTINCT FROM ROW(OLD.id,OLD.identity,OLD."accountScope",OLD.facts,OLD."factsHash") OR
 (OLD."receiptId" IS NOT NULL AND NEW."receiptId" IS DISTINCT FROM OLD."receiptId") OR
 (NEW.state IS DISTINCT FROM OLD.state AND NEW.version<>OLD.version+1) OR
 (NEW.state IS NOT DISTINCT FROM OLD.state AND NEW.version NOT IN (OLD.version,OLD.version+1)) THEN
 RAISE EXCEPTION 'Invalid bank control update' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER finance_operation_guard BEFORE UPDATE OR DELETE ON public.finance_bank_operations FOR EACH ROW EXECUTE FUNCTION public.finance_operation_guard();
CREATE FUNCTION public.finance_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o record; BEGIN
 SELECT * INTO o FROM public.finance_bank_observations WHERE id=NEW."observationId";
 IF o."submitterId"=NEW."reviewerId" OR NOT EXISTS(SELECT 1 FROM public.finance_bank_operations p WHERE p.id=NEW."operationId" AND p."accountScope"=o."accountScope") OR
 (TG_TABLE_NAME='finance_bank_decisions' AND EXISTS(SELECT 1 FROM public.finance_bank_decisions d WHERE d."observationId"=NEW."observationId" AND d."operationId"<>NEW."operationId")) THEN
 RAISE EXCEPTION 'Independent matching review required' USING ERRCODE='23514'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER finance_decision_guard BEFORE INSERT ON public.finance_bank_decisions FOR EACH ROW EXECUTE FUNCTION public.finance_decision_guard();
CREATE TRIGGER finance_review_guard BEFORE INSERT ON public.finance_bank_restore_reviews FOR EACH ROW EXECUTE FUNCTION public.finance_decision_guard();
CREATE FUNCTION public.finance_check_evidence_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.finance_bank_operations o JOIN public.finance_bank_decisions d ON d."operationId"=o.id WHERE o."receiptId"=NEW.id AND d.id=NEW."verificationId" AND o.facts->>'sourceNamespace'=NEW."sourceNamespace" AND o.facts->>'transactionId'=NEW."transactionId" AND o."accountScope"=NEW."accountScope" AND (o.facts->>'amountPence')::bigint=NEW."amountPence" AND (o.facts->>'receivedAt')::timestamptz=NEW."receivedAt") THEN
 RAISE EXCEPTION 'Receipt requires transactional evidence association' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_receipt_evidence AFTER INSERT ON public.finance_bank_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_evidence_receipt();
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['finance_bank_observations','finance_bank_decisions','finance_bank_restore_reviews','finance_evidence_events'] LOOP
 EXECUTE format('CREATE TRIGGER finance_evidence_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_evidence_immutable()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['finance_bank_operations','finance_bank_observations','finance_bank_decisions','finance_bank_restore_reviews','finance_evidence_events'] LOOP
 EXECUTE format('CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.finance_reject_truncate()',t);
 END LOOP;
END $$;
`);}
 async down():Promise<never>{throw Error('Evidence history rollback requires a separately reviewed migration; automatic down forbidden');}
}
