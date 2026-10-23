-- Prepared only. Apply manually ONLY to a verified isolated PostgreSQL during readiness.
-- No automatic startup migrations. Existing topics/posts become pending for human review.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE forum_moderation_schema(version integer PRIMARY KEY CHECK(version=1));
INSERT INTO forum_moderation_schema VALUES(1);
ALTER TABLE forum_users ADD COLUMN rules_version text;
CREATE TABLE forum_rule_acceptances(user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 version text NOT NULL, accepted_at timestamptz DEFAULT clock_timestamp(), PRIMARY KEY(user_id,version));
INSERT INTO forum_rule_acceptances(user_id,version,accepted_at)
 SELECT user_id,'legacy',agreed_to_rules_at FROM forum_users WHERE agreed_to_rules=true;
ALTER TABLE forum_topics ADD COLUMN category text NOT NULL DEFAULT 'discussion'
  CHECK(category IN ('discussion','cashback-review'));
ALTER TABLE forum_topics ADD COLUMN review_body text;
ALTER TABLE forum_topics ADD COLUMN review_rating smallint CHECK(review_rating BETWEEN 1 AND 5);
ALTER TABLE forum_topics ADD COLUMN review_attested_at timestamptz;
ALTER TABLE forum_topics ADD CONSTRAINT forum_review_material CHECK
 ((category='discussion' AND review_body IS NULL AND review_rating IS NULL) OR
  (category='cashback-review' AND review_body IS NOT NULL AND length(review_body) BETWEEN 20 AND 4000 AND review_rating IS NOT NULL AND review_attested_at IS NOT NULL));
CREATE TABLE forum_moderators(user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 active boolean NOT NULL DEFAULT true);
CREATE TABLE forum_content_cases(
 id bigserial PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('topic','post','review')),
 target_id integer NOT NULL, author_id integer REFERENCES users(id) ON DELETE SET NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','published','hidden')),
 signals jsonb NOT NULL DEFAULT '[]', request_key text NOT NULL, request_hash text NOT NULL,
 confirmed_at timestamptz, revoked_at timestamptz, decision_by integer REFERENCES users(id) ON DELETE SET NULL,
 needs_review boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(kind,target_id), UNIQUE(author_id,request_key),
 CHECK(confirmed_at IS NULL OR revoked_at IS NOT NULL OR state='hidden'),
 CHECK(revoked_at IS NULL OR confirmed_at IS NOT NULL));
CREATE UNIQUE INDEX forum_topic_case_once ON forum_content_cases(target_id) WHERE kind IN ('topic','review');
CREATE INDEX forum_case_queue ON forum_content_cases(needs_review,created_at);
CREATE INDEX forum_case_author ON forum_content_cases(author_id,confirmed_at) WHERE revoked_at IS NULL;
CREATE TABLE forum_moderation_events(
 id bigserial PRIMARY KEY, case_id bigint NOT NULL REFERENCES forum_content_cases(id),
 subject_id integer REFERENCES users(id) ON DELETE SET NULL,
 actor_id integer REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL, reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE FUNCTION forum_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'MODERATION_AUDIT_IMMUTABLE'; END $$;
CREATE TRIGGER forum_audit_immutable BEFORE UPDATE OR DELETE ON forum_moderation_events
 FOR EACH ROW EXECUTE FUNCTION forum_audit_immutable();
CREATE TRIGGER forum_acceptance_immutable BEFORE UPDATE OR DELETE ON forum_rule_acceptances
 FOR EACH ROW EXECUTE FUNCTION forum_audit_immutable();
CREATE TABLE forum_content_reports(
 id bigserial PRIMARY KEY, case_id bigint NOT NULL REFERENCES forum_content_cases(id),
 reporter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(case_id,reporter_id));
CREATE TABLE forum_content_appeals(
 id bigserial PRIMARY KEY, case_id bigint NOT NULL UNIQUE REFERENCES forum_content_cases(id),
 user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 2000),
 outcome text CHECK(outcome IN ('upheld','revoked')), reviewer_id integer REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), resolved_at timestamptz);
INSERT INTO forum_content_cases(kind,target_id,author_id,request_key,request_hash,signals)
 SELECT 'topic',id,"authorId",'legacy-topic:'||id,'legacy','["legacy-human-review"]' FROM forum_topics;
INSERT INTO forum_content_cases(kind,target_id,author_id,request_key,request_hash,signals)
 SELECT 'post',id,"authorId",'legacy-post:'||id,'legacy','["legacy-human-review"]' FROM forum_posts;
-- No moderator is provisioned by migration. Runtime must not grant its own role.
REVOKE ALL ON forum_moderators,forum_content_cases,forum_moderation_events,forum_content_reports,forum_content_appeals,forum_moderation_schema,forum_rule_acceptances FROM PUBLIC;
COMMIT;
