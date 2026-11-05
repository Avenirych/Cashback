\set ON_ERROR_STOP on
-- New synthetic-only extension. Never include historical migrations. Owner/operator only.
\if :{?expected_system_identifier}
\else
 SELECT 1/0 AS staging_guard_refused;
\endif
SELECT current_database()='cashback_staging_app' AND system_identifier::text=:'expected_system_identifier' AND system_identifier::text<>'7698666936429441062' AS target_ok FROM pg_control_system() \gset
\if :target_ok
\else
 SELECT 1/0 AS staging_guard_refused;
\endif
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(62023,1);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM users WHERE email !~ '^[A-Za-z0-9._+%-]+@example[.]invalid$' OR balance<>0) THEN RAISE EXCEPTION 'NON_SYNTHETIC_DATA'; END IF;
 IF NOT EXISTS(SELECT 1 FROM staging_meta.baseline WHERE version=1 AND purpose='synthetic-only') THEN RAISE EXCEPTION 'BASELINE_REFUSED'; END IF;
END $$;
SELECT to_regclass('public.staging_functional_schema') IS NULL AS install_needed \gset
\if :install_needed
SET LOCAL ROLE cashback_staging_schema;
CREATE TABLE public.staging_functional_schema(version integer PRIMARY KEY CHECK(version=1));
INSERT INTO public.staging_functional_schema VALUES(1);
ALTER TABLE forum_users ADD COLUMN rules_version text;
ALTER TABLE forum_topics ADD COLUMN category text NOT NULL DEFAULT 'discussion' CHECK(category IN ('discussion','cashback-review')),
 ADD COLUMN review_body text, ADD COLUMN review_rating smallint CHECK(review_rating BETWEEN 1 AND 5), ADD COLUMN review_attested_at timestamptz;
ALTER TABLE forum_topics ADD CONSTRAINT synthetic_review_material CHECK((category='discussion' AND review_body IS NULL AND review_rating IS NULL) OR (category='cashback-review' AND review_body IS NOT NULL AND length(review_body) BETWEEN 20 AND 4000 AND review_rating IS NOT NULL AND review_attested_at IS NOT NULL));
CREATE TABLE forum_moderation_schema(version integer PRIMARY KEY CHECK(version=3));
INSERT INTO forum_moderation_schema VALUES(3);
CREATE TABLE forum_rule_acceptances(user_id integer REFERENCES users(id),version text NOT NULL,accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(user_id,version));
CREATE TABLE forum_moderators(user_id integer PRIMARY KEY REFERENCES users(id),active boolean NOT NULL DEFAULT true);
CREATE TABLE forum_owner_bootstrap(singleton boolean PRIMARY KEY CHECK(singleton),owner_user_id integer REFERENCES users(id),consumed_at timestamptz,privacy_acknowledged_at timestamptz,privacy_document_sha256 text);
INSERT INTO forum_owner_bootstrap(singleton) VALUES(true);
CREATE TABLE forum_content_cases(id bigserial PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('topic','post','review')),target_id integer NOT NULL,author_id integer REFERENCES users(id),state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','published','hidden')),signals jsonb NOT NULL DEFAULT '[]',request_key text NOT NULL,request_hash text NOT NULL,confirmed_at timestamptz,revoked_at timestamptz,decision_by integer REFERENCES users(id),needs_review boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),material_erased_at timestamptz,UNIQUE(kind,target_id),UNIQUE(author_id,request_key),CHECK(confirmed_at IS NULL OR revoked_at IS NOT NULL OR state='hidden'),CHECK(revoked_at IS NULL OR confirmed_at IS NOT NULL));
CREATE UNIQUE INDEX functional_topic_case_once ON forum_content_cases(target_id) WHERE kind IN ('topic','review');
CREATE INDEX functional_case_queue ON forum_content_cases(needs_review,created_at);
CREATE INDEX functional_case_author ON forum_content_cases(author_id,confirmed_at) WHERE revoked_at IS NULL;
CREATE TABLE forum_moderation_events(id bigserial PRIMARY KEY,case_id bigint NOT NULL REFERENCES forum_content_cases(id),action text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE forum_event_details(event_id bigint PRIMARY KEY REFERENCES forum_moderation_events(id),reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000));
CREATE TABLE forum_event_identities(event_id bigint PRIMARY KEY REFERENCES forum_moderation_events(id),subject_id integer REFERENCES users(id),actor_id integer REFERENCES users(id));
CREATE TABLE forum_content_reports(id bigserial PRIMARY KEY,case_id bigint NOT NULL REFERENCES forum_content_cases(id),reporter_id integer NOT NULL REFERENCES users(id),reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(case_id,reporter_id));
CREATE TABLE forum_content_appeals(id bigserial PRIMARY KEY,case_id bigint NOT NULL UNIQUE REFERENCES forum_content_cases(id),user_id integer NOT NULL REFERENCES users(id),reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),outcome text CHECK(outcome IN ('upheld','revoked')),reviewer_id integer REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),resolved_at timestamptz);
CREATE FUNCTION functional_audit_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'MODERATION_AUDIT_IMMUTABLE'; END $$;
CREATE TRIGGER functional_audit_immutable BEFORE UPDATE OR DELETE ON forum_moderation_events FOR EACH ROW EXECUTE FUNCTION functional_audit_immutable();
CREATE TRIGGER functional_details_immutable BEFORE UPDATE OR DELETE ON forum_event_details FOR EACH ROW EXECUTE FUNCTION functional_audit_immutable();
CREATE TRIGGER functional_acceptance_immutable BEFORE UPDATE OR DELETE ON forum_rule_acceptances FOR EACH ROW EXECUTE FUNCTION functional_audit_immutable();
RESET ROLE;
\endif
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.staging_functional_schema WHERE version=1) OR NOT EXISTS(SELECT 1 FROM forum_moderation_schema WHERE version=3) THEN RAISE EXCEPTION 'FUNCTIONAL_VERSION_REFUSED'; END IF;
END $$;
-- CHECK must reject missing review material rather than accept SQL UNKNOWN.
SET LOCAL ROLE cashback_staging_schema;
ALTER TABLE forum_topics DROP CONSTRAINT synthetic_review_material;
ALTER TABLE forum_topics ADD CONSTRAINT synthetic_review_material CHECK((category='discussion' AND review_body IS NULL AND review_rating IS NULL) OR (category='cashback-review' AND review_body IS NOT NULL AND length(review_body) BETWEEN 20 AND 4000 AND review_rating IS NOT NULL AND review_attested_at IS NOT NULL));
RESET ROLE;
REVOKE ALL ON forum_moderation_schema,forum_rule_acceptances,forum_moderators,forum_owner_bootstrap,forum_content_cases,forum_moderation_events,forum_event_details,forum_event_identities,forum_content_reports,forum_content_appeals FROM PUBLIC;
REVOKE ALL ON FUNCTION functional_audit_immutable() FROM PUBLIC;
GRANT SELECT ON public.staging_functional_schema,forum_moderation_schema,forum_moderators,forum_owner_bootstrap TO cashback_staging_runtime;
GRANT INSERT(id,user_id,username,avatar_url,agreed_to_rules,agreed_to_rules_at,banned,ban_reason,created_at,updated_at) ON forum_users TO cashback_staging_runtime;
GRANT UPDATE(agreed_to_rules,rules_version,agreed_to_rules_at) ON forum_users TO cashback_staging_runtime;
GRANT INSERT(title,"authorId",category,review_body,review_rating,review_attested_at) ON forum_topics TO cashback_staging_runtime;
GRANT INSERT(content,"authorId","topicId") ON forum_posts TO cashback_staging_runtime;
GRANT SELECT,INSERT ON forum_rule_acceptances,forum_content_cases,forum_moderation_events,forum_event_details,forum_event_identities,forum_content_reports,forum_content_appeals TO cashback_staging_runtime;
GRANT UPDATE(state,needs_review,decision_by,confirmed_at,revoked_at) ON forum_content_cases TO cashback_staging_runtime;
GRANT UPDATE(outcome,reviewer_id,resolved_at) ON forum_content_appeals TO cashback_staging_runtime;
GRANT USAGE ON SEQUENCE forum_users_id_seq,forum_topics_id_seq,forum_posts_id_seq,forum_content_cases_id_seq,forum_moderation_events_id_seq,forum_content_reports_id_seq,forum_content_appeals_id_seq TO cashback_staging_runtime;
-- No financial grants, balance updates, ownership, membership, SECURITY DEFINER or runtime DDL.
COMMIT;
