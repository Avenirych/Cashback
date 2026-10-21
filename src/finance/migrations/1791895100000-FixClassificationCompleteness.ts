import type { MigrationInterface, QueryRunner } from 'typeorm';
/** Follow-up for PostgreSQL record field resolution; retains applied migration history. */
export class FixClassificationCompleteness1791895100000 implements MigrationInterface {
 name='FixClassificationCompleteness1791895100000';
 async up(q:QueryRunner):Promise<void>{await q.query(`
CREATE OR REPLACE FUNCTION public.finance_check_classification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n bigint; amount numeric; cid uuid; saved jsonb;BEGIN
 cid:=CASE WHEN TG_TABLE_NAME='finance_receipt_classifications' THEN (to_jsonb(NEW)->>'id')::uuid ELSE (to_jsonb(NEW)->>'classificationId')::uuid END;
 SELECT result INTO saved FROM public.finance_receipt_classifications WHERE id=cid;
 SELECT count(*),COALESCE(sum("amountPence"),0) INTO n,amount FROM public.finance_receipt_classified_parts WHERE "classificationId"=cid;
 IF n<1 OR jsonb_array_length(saved->'parts')<>n OR saved->>'classifiedPence' IS DISTINCT FROM amount::text OR
 (SELECT count(DISTINCT j->>'partId') FROM jsonb_array_elements(saved->'parts') j)<>n OR
 EXISTS(SELECT 1 FROM jsonb_array_elements(saved->'parts') j WHERE NOT EXISTS(SELECT 1 FROM public.finance_receipt_classified_parts p WHERE p."classificationId"=cid AND p.id::text=j->>'partId' AND p."offsetPence"::text=j->>'offsetPence' AND p."amountPence"::text=j->>'amountPence' AND p.category=j->>'category')) THEN RAISE EXCEPTION 'Incomplete classification history' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
`);}
 async down():Promise<never>{throw Error('Do not restore unsafe classification completeness trigger');}
}
