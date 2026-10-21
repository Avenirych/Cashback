import type { MigrationInterface, QueryRunner } from 'typeorm';
/** Additive finance-only migration. Not in application DataSource lists. */
export class AddFinanceOutbox1791891000000 implements MigrationInterface {
 name='AddFinanceOutbox1791891000000';
 async up(q: QueryRunner): Promise<void> { await q.query(`
CREATE TABLE public.finance_outbox (
 "eventId" uuid PRIMARY KEY,
 type varchar(60) NOT NULL CHECK(type='finance.journal.posted'),
 "schemaVersion" integer NOT NULL CHECK("schemaVersion"=1),
 "idempotencyKey" varchar(160) NOT NULL CHECK("idempotencyKey" ~ '^[A-Za-z0-9:_-]{8,160}$') CONSTRAINT "UQ_finance_outbox_key" UNIQUE,
 "operationId" uuid NOT NULL,
 "journalId" uuid NOT NULL CONSTRAINT "UQ_finance_outbox_journal" UNIQUE REFERENCES public.finance_journals(id),
 "createdAt" timestamptz NOT NULL,
 "envelopeHash" varchar(64) NOT NULL CHECK("envelopeHash" ~ '^[0-9a-f]{64}$'),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND
  payload ?& ARRAY['currency','journalId','postingCount'] AND
  payload - ARRAY['currency','journalId','postingCount'] = '{}'::jsonb AND
  jsonb_typeof(payload->'currency')='string' AND jsonb_typeof(payload->'journalId')='string' AND
  payload->>'currency'='GBP' AND payload->>'journalId'="journalId"::text AND
  jsonb_typeof(payload->'postingCount')='number' AND (payload->>'postingCount')::integer BETWEEN 2 AND 1000),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 "deliveredAt" timestamptz, "leaseUntil" timestamptz,
 "availableAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "IDX_finance_outbox_pending" ON public.finance_outbox("availableAt","eventId") WHERE "deliveredAt" IS NULL;
CREATE FUNCTION public.finance_outbox_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.attempts<>0 OR NEW."deliveredAt" IS NOT NULL OR NEW."leaseUntil" IS NOT NULL THEN
   RAISE EXCEPTION 'New outbox must be pending' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.finance_journals WHERE id=NEW."journalId" AND sealed AND "eventKey"=NEW."idempotencyKey") THEN
   RAISE EXCEPTION 'Outbox requires matching sealed journal' USING ERRCODE='23514'; END IF;
  IF NEW.payload->>'postingCount' <> (SELECT count(*)::text FROM public.finance_postings WHERE "journalId"=NEW."journalId") THEN
   RAISE EXCEPTION 'Outbox posting count mismatch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 ELSIF TG_OP='UPDATE' THEN
  IF ROW(NEW."eventId",NEW.type,NEW."schemaVersion",NEW."idempotencyKey",NEW."operationId",NEW."journalId",NEW."createdAt",NEW."envelopeHash",NEW.payload)
   IS DISTINCT FROM ROW(OLD."eventId",OLD.type,OLD."schemaVersion",OLD."idempotencyKey",OLD."operationId",OLD."journalId",OLD."createdAt",OLD."envelopeHash",OLD.payload) THEN
   RAISE EXCEPTION 'Immutable outbox event' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Outbox deletion/truncation forbidden' USING ERRCODE='23514';
END $$;
CREATE TRIGGER finance_outbox_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.finance_outbox FOR EACH ROW EXECUTE FUNCTION public.finance_outbox_guard();
CREATE TRIGGER finance_outbox_no_truncate BEFORE TRUNCATE ON public.finance_outbox FOR EACH STATEMENT EXECUTE FUNCTION public.finance_outbox_guard();
`); }
 async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE public.finance_outbox; DROP FUNCTION public.finance_outbox_guard();'); }
}
