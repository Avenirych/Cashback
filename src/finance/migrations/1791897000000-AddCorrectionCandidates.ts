import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AddCorrectionCandidates1791897000000 implements MigrationInterface {
 name='AddCorrectionCandidates1791897000000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
ALTER TABLE public.finance_classification_correction_requests ADD COLUMN "linkedFromRequestId" uuid NULL REFERENCES public.finance_classification_correction_requests(id);
CREATE FUNCTION public.finance_correction_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record;BEGIN
 IF NEW."linkedFromRequestId" IS NULL THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(726405,0);
 SELECT * INTO p FROM public.finance_classification_correction_requests WHERE id=NEW."linkedFromRequestId";
 IF NOT FOUND OR p.id=NEW.id OR p."partId"<>NEW."partId" OR p."contextId"<>NEW."contextId" OR NEW."participantId" IS NULL THEN RAISE EXCEPTION 'Invalid linked correction request' USING ERRCODE='23514';END IF;
 IF EXISTS(WITH RECURSIVE a AS (SELECT id,"participantId","linkedFromRequestId" FROM public.finance_classification_correction_requests WHERE id=p.id UNION ALL SELECT r.id,r."participantId",r."linkedFromRequestId" FROM public.finance_classification_correction_requests r JOIN a ON r.id=a."linkedFromRequestId") SELECT 1 FROM a WHERE "participantId" IS NULL OR id=NEW.id) THEN RAISE EXCEPTION 'Unverified or cyclic linked ancestry' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER finance_correction_link_guard BEFORE INSERT ON public.finance_classification_correction_requests FOR EACH ROW EXECUTE FUNCTION public.finance_correction_link_guard();
CREATE TABLE public.finance_classification_correction_candidates(
 id uuid PRIMARY KEY,"requestId" uuid NOT NULL REFERENCES public.finance_classification_correction_requests(id),"originalPartId" uuid NOT NULL REFERENCES public.finance_receipt_classified_parts(id),
 "baseVersion" integer NOT NULL CHECK("baseVersion"=0),"baseHash" varchar(64) NOT NULL CHECK("baseHash" ~ '^[0-9a-f]{64}$'),metadata jsonb NOT NULL,
 "operationId" uuid NOT NULL REFERENCES public.finance_bank_operations(id),"operationVersion" integer NOT NULL CHECK("operationVersion">0),
 "actorId" uuid NOT NULL,"participantId" uuid NOT NULL,"contextId" uuid NOT NULL,
 fingerprint varchar(64) NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),"intentFingerprint" varchar(64) NOT NULL CHECK("intentFingerprint" ~ '^[0-9a-f]{64}$'),
 "verificationId" uuid NOT NULL,"verifierReference" varchar(60) NOT NULL,
 "commandKey" varchar(160) NOT NULL UNIQUE,"requestHash" varchar(64) NOT NULL CHECK("requestHash" ~ '^[0-9a-f]{64}$'),"createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((jsonb_typeof(metadata)='object' AND metadata ?& ARRAY['category','sourceNamespace','sourceEventId','basisReference','documentReferences'] AND metadata - ARRAY['category','sourceNamespace','sourceEventId','basisReference','documentReferences']='{}'::jsonb AND metadata->>'category' IN ('shopping_cashback','rewarded_ads','research_referral','passive_ads','return_or_adjustment','company_funding') AND jsonb_typeof(metadata->'documentReferences')='array') IS TRUE)
);
ALTER TABLE public.finance_classification_correction_decisions
 ADD COLUMN "candidateId" uuid NULL REFERENCES public.finance_classification_correction_candidates(id),
 ADD COLUMN "candidateFingerprint" varchar(64) NULL,ADD COLUMN "originalPartId" uuid NULL REFERENCES public.finance_receipt_classified_parts(id),
 ADD COLUMN "baseVersion" integer NULL,ADD COLUMN "intentFingerprint" varchar(64) NULL,
 ADD CONSTRAINT finance_exact_candidate_binding CHECK(("candidateId" IS NULL AND "candidateFingerprint" IS NULL AND "originalPartId" IS NULL AND "baseVersion" IS NULL AND "intentFingerprint" IS NULL) OR ("candidateId" IS NOT NULL AND "candidateFingerprint" IS NOT NULL AND "originalPartId" IS NOT NULL AND "baseVersion" IS NOT NULL AND "baseVersion"=0 AND "intentFingerprint" IS NOT NULL));
CREATE UNIQUE INDEX finance_one_exact_approval ON public.finance_classification_correction_decisions("originalPartId","baseVersion","operationVersion") WHERE "candidateId" IS NOT NULL AND decision='approved';
CREATE UNIQUE INDEX finance_one_exact_intent_decision ON public.finance_classification_correction_decisions("originalPartId","baseVersion","operationVersion","intentFingerprint") WHERE "candidateId" IS NOT NULL;
CREATE FUNCTION public.finance_candidate_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; origin record; op record;BEGIN
 PERFORM pg_advisory_xact_lock(726405,0);SELECT * INTO r FROM public.finance_classification_correction_requests WHERE id=NEW."requestId";
 IF NOT FOUND OR r."participantId" IS NULL OR r."participantId"<>NEW."participantId" OR r."contextId"<>NEW."contextId" OR r."partId"<>NEW."originalPartId" THEN RAISE EXCEPTION 'Invalid trusted candidate request' USING ERRCODE='23514';END IF;
 SELECT p."receiptId",l.id lot,o.id operation,o.identity,o."accountScope" INTO origin FROM public.finance_receipt_classified_parts p JOIN public.finance_funding_lots l ON l."receiptId"=p."receiptId" JOIN public.finance_bank_operations o ON o."receiptId"=p."receiptId" WHERE p.id=r."partId";
 IF NOT FOUND OR origin.operation<>NEW."operationId" THEN RAISE EXCEPTION 'Invalid candidate bank origin' USING ERRCODE='23514';END IF;
 PERFORM pg_advisory_xact_lock(726404,hashtext(origin."accountScope"::text));PERFORM pg_advisory_xact_lock(726403,hashtext(origin.identity));SELECT * INTO op FROM public.finance_bank_operations WHERE id=origin.operation FOR UPDATE;
 PERFORM id FROM public.finance_funding_lots WHERE id=origin.lot FOR UPDATE;PERFORM id FROM public.finance_bank_receipts WHERE id=origin."receiptId" FOR UPDATE;PERFORM id FROM public.finance_classification_correction_requests WHERE id=r.id FOR UPDATE;
 IF op.state<>'eligible' OR op.version<>NEW."operationVersion" THEN RAISE EXCEPTION 'Candidate evidence blocked or stale' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER finance_candidate_guard BEFORE INSERT ON public.finance_classification_correction_candidates FOR EACH ROW EXECUTE FUNCTION public.finance_candidate_guard();
CREATE FUNCTION public.finance_exact_candidate_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c record;BEGIN
 PERFORM pg_advisory_xact_lock(726405,0);
 IF EXISTS(WITH RECURSIVE a AS (SELECT id,"participantId","linkedFromRequestId" FROM public.finance_classification_correction_requests WHERE id=NEW."requestId" UNION ALL SELECT r.id,r."participantId",r."linkedFromRequestId" FROM public.finance_classification_correction_requests r JOIN a ON r.id=a."linkedFromRequestId") SELECT 1 FROM a WHERE "participantId" IS NULL OR "participantId"=NEW."participantId") THEN RAISE EXCEPTION 'Independent verified ancestry participant required' USING ERRCODE='23514';END IF;
 IF NEW."candidateId" IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO c FROM public.finance_classification_correction_candidates WHERE id=NEW."candidateId";
 IF NOT FOUND OR c."requestId"<>NEW."requestId" OR c.fingerprint<>NEW."candidateFingerprint" OR c."originalPartId"<>NEW."originalPartId" OR c."baseVersion"<>NEW."baseVersion" OR c."intentFingerprint"<>NEW."intentFingerprint" OR c."operationId"<>NEW."operationId" OR c."operationVersion"<>NEW."operationVersion" OR c."participantId"=NEW."participantId" THEN RAISE EXCEPTION 'Exact candidate binding or independence mismatch' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
CREATE TRIGGER finance_exact_candidate_review_guard BEFORE INSERT ON public.finance_classification_correction_decisions FOR EACH ROW EXECUTE FUNCTION public.finance_exact_candidate_review_guard();
CREATE TRIGGER finance_candidate_immutable BEFORE UPDATE OR DELETE ON public.finance_classification_correction_candidates FOR EACH ROW EXECUTE FUNCTION public.finance_evidence_immutable();
CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON public.finance_classification_correction_candidates FOR EACH STATEMENT EXECUTE FUNCTION public.finance_reject_truncate();
`);}
 async down():Promise<never>{throw Error('Candidate and linked decision history have no destructive automatic rollback');}
}
