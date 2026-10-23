-- Follow-up to 20261022-content-moderation.sql. Never automatic; isolated review first.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE forum_event_details(event_id bigint PRIMARY KEY REFERENCES forum_moderation_events(id) ON DELETE CASCADE,reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000));
CREATE TABLE forum_event_identities(event_id bigint PRIMARY KEY REFERENCES forum_moderation_events(id) ON DELETE CASCADE,subject_id integer REFERENCES users(id) ON DELETE CASCADE,actor_id integer REFERENCES users(id) ON DELETE SET NULL);
INSERT INTO forum_event_details SELECT id,reason FROM forum_moderation_events;
INSERT INTO forum_event_identities SELECT id,subject_id,actor_id FROM forum_moderation_events;
ALTER TABLE forum_moderation_events DROP COLUMN reason,DROP COLUMN subject_id,DROP COLUMN actor_id;
-- Only table owner executing an explicit maintenance procedure can bypass immutability.
-- Runtime setting the same GUC is insufficient. Owners can already alter/drop triggers.
CREATE OR REPLACE FUNCTION forum_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('cashback.privacy_maintenance',true)='on' AND current_user=(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'MODERATION_AUDIT_IMMUTABLE';
END $$;
CREATE TRIGGER forum_details_immutable BEFORE UPDATE OR DELETE ON forum_event_details FOR EACH ROW EXECUTE FUNCTION forum_audit_immutable();
-- Identity links deliberately support FK anonymization; runtime has no UPDATE/DELETE grant.
CREATE FUNCTION forum_erase_personal_data(subject integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE old_mode text;
BEGIN
 IF subject IS NULL OR subject<=0 THEN RAISE EXCEPTION 'INVALID_SUBJECT'; END IF;
 PERFORM pg_advisory_xact_lock(62022,subject);
 old_mode:=current_setting('cashback.privacy_maintenance',true);
 PERFORM set_config('cashback.privacy_maintenance','on',true);
 -- Purge reasons/appeals/reports and journal events that may identify this person.
 -- Also remove reports/appeals by other people on this person's material.
 DELETE FROM public.forum_moderation_events e WHERE e.case_id IN(SELECT id FROM public.forum_content_cases WHERE author_id=subject) OR e.id IN(SELECT event_id FROM public.forum_event_identities WHERE subject_id=subject OR actor_id=subject);
 DELETE FROM public.forum_rule_acceptances WHERE user_id=subject;
 DELETE FROM public.forum_content_reports WHERE reporter_id=subject OR case_id IN(SELECT id FROM public.forum_content_cases WHERE author_id=subject);
 DELETE FROM public.forum_content_appeals WHERE user_id=subject OR reviewer_id=subject OR case_id IN(SELECT id FROM public.forum_content_cases WHERE author_id=subject);
 -- Preserve graph/FKs, remove authored text and prevent republication.
 UPDATE public.forum_posts SET content='[removed]',"authorId"=NULL WHERE "authorId"=subject;
 UPDATE public.forum_topics SET "authorId"=NULL,title='[removed]',review_body=CASE WHEN category='cashback-review' THEN '[Personal data removed]' ELSE NULL END WHERE "authorId"=subject;
 UPDATE public.forum_content_cases SET author_id=NULL,state='hidden',needs_review=false,signals='[]',request_key='erased:'||id,request_hash='erased' WHERE author_id=subject;
 UPDATE public.forum_content_cases SET decision_by=NULL WHERE decision_by=subject;
 DELETE FROM public.forum_moderators WHERE user_id=subject;
 -- Main account/financial deletion is separate: do not erase financial obligations here.
 LOOP
  BEGIN
   UPDATE public.forum_users SET username='Removed_'||substr(replace(gen_random_uuid()::text,'-',''),1,22),avatar_url=NULL,ban_reason=NULL,agreed_to_rules=false,agreed_to_rules_at=NULL,rules_version=NULL WHERE user_id=subject;
   EXIT;
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
 END LOOP;
 PERFORM set_config('cashback.privacy_maintenance',coalesce(old_mode,''),true);
END $$;
REVOKE ALL ON FUNCTION forum_erase_personal_data(integer) FROM PUBLIC;
CREATE FUNCTION forum_before_user_erasure() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN PERFORM public.forum_erase_personal_data(OLD.id);DELETE FROM public.forum_users WHERE user_id=OLD.id;RETURN OLD;END $$;
REVOKE ALL ON FUNCTION forum_before_user_erasure() FROM PUBLIC;
CREATE TRIGGER forum_before_user_erasure BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION forum_before_user_erasure();
-- Explicit owner maintenance only. Cutoff is supplied by an approved retention policy,
-- never inferred as a legal basis from immutability. No automatic deletion job enabled.
CREATE FUNCTION forum_purge_expired_details(cutoff timestamptz) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE removed bigint;old_mode text;
BEGIN
 IF cutoff IS NULL OR cutoff>clock_timestamp() THEN RAISE EXCEPTION 'INVALID_CUTOFF'; END IF;
 old_mode:=current_setting('cashback.privacy_maintenance',true);PERFORM set_config('cashback.privacy_maintenance','on',true);
 DELETE FROM public.forum_event_details d USING public.forum_moderation_events e WHERE e.id=d.event_id AND e.created_at<cutoff;GET DIAGNOSTICS removed=ROW_COUNT;
 DELETE FROM public.forum_event_identities i USING public.forum_moderation_events e WHERE e.id=i.event_id AND e.created_at<cutoff;
 DELETE FROM public.forum_content_reports WHERE created_at<cutoff;
 DELETE FROM public.forum_content_appeals WHERE resolved_at IS NOT NULL AND resolved_at<cutoff;
 DELETE FROM public.forum_rule_acceptances a WHERE accepted_at<cutoff AND NOT EXISTS(SELECT 1 FROM public.forum_users f WHERE f.user_id=a.user_id AND f.rules_version=a.version AND f.agreed_to_rules=true);
 PERFORM set_config('cashback.privacy_maintenance',coalesce(old_mode,''),true);RETURN removed;
END $$;
REVOKE ALL ON FUNCTION forum_purge_expired_details(timestamptz) FROM PUBLIC;
REVOKE ALL ON forum_event_details,forum_event_identities FROM PUBLIC;
ALTER TABLE forum_moderation_schema DROP CONSTRAINT forum_moderation_schema_version_check;
UPDATE forum_moderation_schema SET version=2;
ALTER TABLE forum_moderation_schema ADD CHECK(version=2);
COMMIT;
