-- Prepared only. v2 -> v3; no automatic execution.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE forum_content_cases ADD COLUMN material_erased_at timestamptz;
ALTER TABLE forum_content_cases ADD COLUMN retention_review_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '12 months');
CREATE TABLE forum_retention_holds(id bigserial PRIMARY KEY,case_id bigint NOT NULL REFERENCES forum_content_cases(id),basis text NOT NULL CHECK(basis IN ('legal_obligation','legal_claim','documented_safety_interest')),reference text NOT NULL CHECK(length(reference) BETWEEN 3 AND 200),approved_by text NOT NULL CHECK(length(approved_by) BETWEEN 3 AND 100),review_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,CHECK(review_at<=expires_at),CHECK(expires_at<=review_at+interval '12 months'));
ALTER TABLE forum_retention_holds ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE forum_retention_holds ADD CHECK(isfinite(review_at) AND isfinite(expires_at) AND expires_at<=created_at+interval '12 months');
CREATE INDEX forum_hold_case ON forum_retention_holds(case_id,expires_at);
-- Serialize owner hold changes with appeals, decisions, erasure and cleanup.
CREATE FUNCTION forum_hold_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE a integer;c bigint;
BEGIN
 IF TG_OP='UPDATE' AND NEW.case_id<>OLD.case_id THEN RAISE EXCEPTION 'HOLD_CASE_IMMUTABLE';END IF;
 PERFORM pg_advisory_xact_lock(62023,1);
 c:=CASE WHEN TG_OP='DELETE' THEN OLD.case_id ELSE NEW.case_id END;
 SELECT author_id INTO a FROM public.forum_content_cases WHERE id=c;
 IF a IS NOT NULL THEN PERFORM pg_advisory_xact_lock(62022,a);END IF;
 PERFORM 1 FROM public.forum_content_cases WHERE id=c FOR UPDATE;
 IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM public.forum_content_cases WHERE id=c AND (material_erased_at IS NOT NULL OR author_id IS NULL)) THEN RAISE EXCEPTION 'MATERIAL_ALREADY_ERASED';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
CREATE TRIGGER forum_hold_lock BEFORE INSERT OR UPDATE OR DELETE ON forum_retention_holds FOR EACH ROW EXECUTE FUNCTION forum_hold_lock();
REVOKE ALL ON forum_retention_holds FROM PUBLIC;
ALTER FUNCTION forum_erase_personal_data(integer) RENAME TO forum_erase_personal_data_unchecked;
REVOKE ALL ON FUNCTION forum_erase_personal_data_unchecked(integer) FROM PUBLIC;
CREATE FUNCTION forum_erase_personal_data(subject integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(62023,1);
 PERFORM pg_advisory_xact_lock(62022,subject);
 IF EXISTS(SELECT 1 FROM public.forum_content_cases c WHERE (c.author_id=subject OR c.decision_by=subject OR c.id IN(SELECT e.case_id FROM public.forum_moderation_events e JOIN public.forum_event_identities i ON i.event_id=e.id WHERE i.actor_id=subject OR i.subject_id=subject) OR c.id IN(SELECT case_id FROM public.forum_content_reports WHERE reporter_id=subject) OR c.id IN(SELECT case_id FROM public.forum_content_appeals WHERE user_id=subject OR reviewer_id=subject)) AND (EXISTS(SELECT 1 FROM public.forum_content_appeals a WHERE a.case_id=c.id AND a.outcome IS NULL) OR EXISTS(SELECT 1 FROM public.forum_retention_holds h WHERE h.case_id=c.id AND h.expires_at>clock_timestamp()))) THEN RAISE EXCEPTION 'PRIVACY_REVIEW_REQUIRED';END IF;
 PERFORM public.forum_erase_personal_data_unchecked(subject);
END $$;
REVOKE ALL ON FUNCTION forum_erase_personal_data(integer) FROM PUBLIC;
-- Replace unsafe global-date purge. Never remove pending appeal evidence or valid holds.
CREATE OR REPLACE FUNCTION forum_purge_expired_details(cutoff timestamptz) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE probe record;c record;resolved timestamptz;removed bigint:=0;old_mode text;
BEGIN
 IF cutoff IS NULL OR cutoff>clock_timestamp() THEN RAISE EXCEPTION 'INVALID_CUTOFF';END IF;
 PERFORM pg_advisory_xact_lock(62023,1);
 old_mode:=current_setting('cashback.privacy_maintenance',true);PERFORM set_config('cashback.privacy_maintenance','on',true);
 FOR probe IN SELECT id,author_id FROM public.forum_content_cases WHERE state<>'published' AND material_erased_at IS NULL ORDER BY author_id NULLS LAST,id LOOP
  IF probe.author_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(62022,probe.author_id);END IF;
  SELECT * INTO c FROM public.forum_content_cases WHERE id=probe.id FOR UPDATE;
  IF c.author_id IS DISTINCT FROM probe.author_id OR c.state='published' OR c.material_erased_at IS NOT NULL THEN CONTINUE;END IF;
  IF EXISTS(SELECT 1 FROM public.forum_content_appeals WHERE case_id=c.id AND outcome IS NULL) OR EXISTS(SELECT 1 FROM public.forum_retention_holds WHERE case_id=c.id AND expires_at>clock_timestamp()) THEN CONTINUE;END IF;
  SELECT greatest(c.created_at,c.confirmed_at,c.revoked_at,(SELECT max(created_at) FROM public.forum_moderation_events WHERE case_id=c.id),(SELECT max(resolved_at) FROM public.forum_content_appeals WHERE case_id=c.id)) INTO resolved;
  -- 180 days confirmed, 90 days revoked/unconfirmed; abandoned pending 30 days.
  IF resolved + (CASE WHEN c.confirmed_at IS NOT NULL AND c.revoked_at IS NULL THEN interval '180 days' WHEN c.state='pending' AND c.confirmed_at IS NULL THEN interval '30 days' ELSE interval '90 days' END) > cutoff THEN CONTINUE;END IF;
  DELETE FROM public.forum_moderation_events WHERE case_id=c.id;
  DELETE FROM public.forum_content_reports WHERE case_id=c.id;
  DELETE FROM public.forum_content_appeals WHERE case_id=c.id;
  IF c.kind='post' THEN UPDATE public.forum_posts SET content='[removed]' WHERE id=c.target_id;
  ELSE UPDATE public.forum_topics SET title='[removed]',review_body=CASE WHEN category='cashback-review' THEN '[Personal data removed]' ELSE NULL END WHERE id=c.target_id;END IF;
  UPDATE public.forum_content_cases SET material_erased_at=clock_timestamp(),state='hidden',needs_review=false,signals='[]',request_hash='erased',request_key='retained-case:'||id WHERE id=c.id;
  -- Preserve minimal non-revoked strike/date/account link; annual necessity review is mandatory.
  removed:=removed+1;
 END LOOP;
 DELETE FROM public.forum_retention_holds h WHERE h.expires_at<cutoff-interval '90 days' AND NOT EXISTS(SELECT 1 FROM public.forum_content_appeals a WHERE a.case_id=h.case_id AND a.outcome IS NULL);
 PERFORM set_config('cashback.privacy_maintenance',coalesce(old_mode,''),true);RETURN removed;
END $$;
REVOKE ALL ON FUNCTION forum_purge_expired_details(timestamptz),forum_hold_lock() FROM PUBLIC;
ALTER TABLE forum_moderation_schema DROP CONSTRAINT forum_moderation_schema_version_check;
UPDATE forum_moderation_schema SET version=3;
ALTER TABLE forum_moderation_schema ADD CHECK(version=3);
COMMIT;
