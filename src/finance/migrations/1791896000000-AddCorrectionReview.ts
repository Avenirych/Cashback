import type { MigrationInterface, QueryRunner } from 'typeorm';
/** Extend the existing request, no historical identity backfill and no monetary changes. */
export class AddCorrectionReview1791896000000 implements MigrationInterface {
 name='AddCorrectionReview1791896000000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
ALTER TABLE public.finance_classification_correction_requests ADD COLUMN "participantId" uuid NULL;
CREATE TABLE public.finance_classification_correction_decisions(
 id uuid PRIMARY KEY,"requestId" uuid NOT NULL REFERENCES public.finance_classification_correction_requests(id),
 "actorId" uuid NOT NULL,"participantId" uuid NOT NULL,"contextId" uuid NOT NULL,
 decision varchar(12) NOT NULL CHECK(decision IN ('approved','rejected')),
 reason varchar(1000) NOT NULL CHECK(length(btrim(reason))>0),"basisReference" uuid NOT NULL,
 "operationId" uuid NOT NULL REFERENCES public.finance_bank_operations(id),"operationVersion" integer NOT NULL CHECK("operationVersion">0),
 "commandKey" varchar(160) NOT NULL UNIQUE,"requestHash" varchar(64) NOT NULL CHECK("requestHash" ~ '^[0-9a-f]{64}$'),
 "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE("requestId","operationVersion")
);
CREATE FUNCTION public.finance_correction_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; origin record; op record;BEGIN
 PERFORM pg_advisory_xact_lock(726405,0);
 SELECT * INTO r FROM public.finance_classification_correction_requests WHERE id=NEW."requestId";
 IF NOT FOUND OR r."participantId" IS NULL OR r."participantId"=NEW."participantId" OR r."contextId"<>NEW."contextId" THEN RAISE EXCEPTION 'Verified independent correction participant required' USING ERRCODE='23514';END IF;
 SELECT p."receiptId",l.id AS lot,o.id AS operation,o.identity,o."accountScope" INTO origin FROM public.finance_receipt_classified_parts p JOIN public.finance_funding_lots l ON l."receiptId"=p."receiptId" JOIN public.finance_bank_operations o ON o."receiptId"=p."receiptId" WHERE p.id=r."partId";
 IF NOT FOUND OR origin.operation<>NEW."operationId" THEN RAISE EXCEPTION 'Invalid correction operation origin' USING ERRCODE='23514';END IF;
 PERFORM pg_advisory_xact_lock(726404,hashtext(origin."accountScope"::text));PERFORM pg_advisory_xact_lock(726403,hashtext(origin.identity));
 SELECT * INTO op FROM public.finance_bank_operations WHERE id=origin.operation FOR UPDATE;
 PERFORM id FROM public.finance_funding_lots WHERE id=origin.lot FOR UPDATE;PERFORM id FROM public.finance_bank_receipts WHERE id=origin."receiptId" FOR UPDATE;PERFORM id FROM public.finance_classification_correction_requests WHERE id=r.id FOR UPDATE;
 IF op.state<>'eligible' OR op.version<>NEW."operationVersion" THEN RAISE EXCEPTION 'Correction evidence blocked or stale' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER finance_correction_review_guard BEFORE INSERT ON public.finance_classification_correction_decisions FOR EACH ROW EXECUTE FUNCTION public.finance_correction_review_guard();
CREATE TRIGGER finance_correction_decision_immutable BEFORE UPDATE OR DELETE ON public.finance_classification_correction_decisions FOR EACH ROW EXECUTE FUNCTION public.finance_evidence_immutable();
CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON public.finance_classification_correction_decisions FOR EACH STATEMENT EXECUTE FUNCTION public.finance_reject_truncate();
`);}
 async down():Promise<never>{throw Error('Correction identity and decision history have no automatic destructive rollback');}
}
