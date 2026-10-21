import type { MigrationInterface, QueryRunner } from 'typeorm';
/** Source metadata only. Does not alter any ledger/coverage/evidence accounting table. */
export class AddReceiptClassification1791895000000 implements MigrationInterface {
 name='AddReceiptClassification1791895000000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
CREATE TABLE public.finance_receipt_classifications(
 id uuid PRIMARY KEY,"commandKey" varchar(160) NOT NULL UNIQUE,"requestHash" varchar(64) NOT NULL CHECK("requestHash" ~ '^[0-9a-f]{64}$'),
 "receiptId" uuid NOT NULL REFERENCES public.finance_bank_receipts(id),"actorId" uuid NOT NULL,"contextId" uuid NOT NULL,
 result jsonb NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((jsonb_typeof(result)='object' AND jsonb_typeof(result->'parts')='array' AND result->>'classificationId'=id::text AND result->>'receiptId'="receiptId"::text AND result->>'currency'='GBP' AND result->>'unclassifiedPenceAtCreation' ~ '^(0|[1-9][0-9]*)$') IS TRUE)
);
CREATE TABLE public.finance_receipt_classified_parts(
 id uuid PRIMARY KEY,"classificationId" uuid NOT NULL REFERENCES public.finance_receipt_classifications(id),
 "receiptId" uuid NOT NULL REFERENCES public.finance_bank_receipts(id),currency varchar(3) NOT NULL CHECK(currency='GBP'),
 "offsetPence" bigint NOT NULL CHECK("offsetPence">=0),"amountPence" bigint NOT NULL CHECK("amountPence">0),
 category varchar(30) NOT NULL CHECK(category IN ('shopping_cashback','rewarded_ads','research_referral','passive_ads','return_or_adjustment','company_funding')),
 "sourceNamespace" varchar(60) NOT NULL,"sourceEventId" varchar(160) NOT NULL,"basisReference" uuid NOT NULL,
 "documentReferences" uuid[] NOT NULL CHECK(cardinality("documentReferences") BETWEEN 1 AND 20),
 "verificationId" uuid NOT NULL,"verifierReference" varchar(60) NOT NULL
);
CREATE INDEX finance_classified_receipt_idx ON public.finance_receipt_classified_parts("receiptId","offsetPence");
CREATE TABLE public.finance_classification_correction_requests(
 id uuid PRIMARY KEY,"commandKey" varchar(160) NOT NULL UNIQUE,"requestHash" varchar(64) NOT NULL CHECK("requestHash" ~ '^[0-9a-f]{64}$'),
 "partId" uuid NOT NULL REFERENCES public.finance_receipt_classified_parts(id),reason varchar(1000) NOT NULL CHECK(length(btrim(reason))>0),
 "actorId" uuid NOT NULL,"contextId" uuid NOT NULL,status varchar(12) NOT NULL CHECK(status='requested'),
 "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION public.finance_classified_part_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origin record; parent_receipt uuid; used numeric;BEGIN
 PERFORM pg_advisory_xact_lock(726405,0);
 SELECT r."amountPence",l.id AS lot,o.id AS operation,o.identity,o."accountScope",o.state INTO origin FROM public.finance_bank_receipts r JOIN public.finance_funding_lots l ON l."receiptId"=r.id JOIN public.finance_bank_operations o ON o."receiptId"=r.id WHERE r.id=NEW."receiptId";
 IF NOT FOUND THEN RAISE EXCEPTION 'Untrusted receipt classification' USING ERRCODE='23514';END IF;
 PERFORM pg_advisory_xact_lock(726404,hashtext(origin."accountScope"::text));
 PERFORM pg_advisory_xact_lock(726403,hashtext(origin.identity));
 SELECT state INTO origin.state FROM public.finance_bank_operations WHERE id=origin.operation FOR UPDATE;
 IF origin.state<>'eligible' THEN RAISE EXCEPTION 'Classification evidence blocked' USING ERRCODE='23514';END IF;
 PERFORM id FROM public.finance_funding_lots WHERE id=origin.lot FOR UPDATE;
 PERFORM id FROM public.finance_bank_receipts WHERE id=NEW."receiptId" FOR UPDATE;
 SELECT "receiptId" INTO parent_receipt FROM public.finance_receipt_classifications WHERE id=NEW."classificationId";
 IF parent_receipt IS DISTINCT FROM NEW."receiptId" OR NEW."offsetPence"::numeric+NEW."amountPence"::numeric>origin."amountPence" THEN RAISE EXCEPTION 'Invalid classified receipt range' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM public.finance_receipt_classified_parts p WHERE p."receiptId"=NEW."receiptId" AND p."offsetPence"::numeric<NEW."offsetPence"::numeric+NEW."amountPence"::numeric AND NEW."offsetPence"::numeric<p."offsetPence"::numeric+p."amountPence"::numeric) THEN RAISE EXCEPTION 'Overlapping classified pennies' USING ERRCODE='23514';END IF;
 SELECT COALESCE(sum("amountPence"),0) INTO used FROM public.finance_receipt_classified_parts WHERE "receiptId"=NEW."receiptId";
 IF used+NEW."amountPence">origin."amountPence" THEN RAISE EXCEPTION 'Classified amount exceeds receipt' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER finance_classified_part_guard BEFORE INSERT ON public.finance_receipt_classified_parts FOR EACH ROW EXECUTE FUNCTION public.finance_classified_part_guard();
CREATE FUNCTION public.finance_check_classification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n bigint; amount numeric; cid uuid; saved jsonb;BEGIN
 cid:=CASE WHEN TG_TABLE_NAME='finance_receipt_classifications' THEN NEW.id ELSE NEW."classificationId" END;
 SELECT result INTO saved FROM public.finance_receipt_classifications WHERE id=cid;
 SELECT count(*),COALESCE(sum("amountPence"),0) INTO n,amount FROM public.finance_receipt_classified_parts WHERE "classificationId"=cid;
 IF n<1 OR jsonb_array_length(saved->'parts')<>n OR saved->>'classifiedPence' IS DISTINCT FROM amount::text OR
 (SELECT count(DISTINCT j->>'partId') FROM jsonb_array_elements(saved->'parts') j)<>n OR
 EXISTS(SELECT 1 FROM jsonb_array_elements(saved->'parts') j WHERE NOT EXISTS(SELECT 1 FROM public.finance_receipt_classified_parts p WHERE p."classificationId"=cid AND p.id::text=j->>'partId' AND p."offsetPence"::text=j->>'offsetPence' AND p."amountPence"::text=j->>'amountPence' AND p.category=j->>'category')) THEN RAISE EXCEPTION 'Incomplete classification history' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER finance_classification_complete AFTER INSERT ON public.finance_receipt_classifications DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_classification();
CREATE CONSTRAINT TRIGGER finance_classified_part_complete AFTER INSERT ON public.finance_receipt_classified_parts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_classification();
CREATE FUNCTION public.finance_classification_correction_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE context uuid;BEGIN
 SELECT c."contextId" INTO context FROM public.finance_receipt_classified_parts p JOIN public.finance_receipt_classifications c ON c.id=p."classificationId" WHERE p.id=NEW."partId";
 IF context IS DISTINCT FROM NEW."contextId" THEN RAISE EXCEPTION 'Correction outside classification context' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER finance_classification_correction_guard BEFORE INSERT ON public.finance_classification_correction_requests FOR EACH ROW EXECUTE FUNCTION public.finance_classification_correction_guard();
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['finance_receipt_classifications','finance_receipt_classified_parts','finance_classification_correction_requests'] LOOP
 EXECUTE format('CREATE TRIGGER finance_classification_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_evidence_immutable()',t);
 EXECUTE format('CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.finance_reject_truncate()',t);
 END LOOP;
END $$;
`);}
 async down():Promise<never>{throw Error('Classification history has no automatic destructive rollback');}
}
