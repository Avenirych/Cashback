-- PREPARED ONLY. Separate explicit migration approval required. No account/role provisioned.
BEGIN;
CREATE TABLE forum_owner_bootstrap (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 consumed_at timestamptz,
 owner_user_id integer REFERENCES users(id) ON DELETE SET NULL,
 privacy_acknowledged_at timestamptz,
 privacy_document_sha256 text CHECK(privacy_document_sha256 ~ '^[a-f0-9]{64}$'),
 CHECK ((consumed_at IS NULL AND owner_user_id IS NULL AND privacy_acknowledged_at IS NULL AND privacy_document_sha256 IS NULL)
 OR (consumed_at IS NOT NULL AND privacy_acknowledged_at IS NOT NULL AND privacy_document_sha256 IS NOT NULL))
);
INSERT INTO forum_owner_bootstrap(singleton) VALUES(true);
REVOKE ALL ON forum_owner_bootstrap FROM PUBLIC;
-- Minimal owner linkage is cleared on account deletion; consumed marker remains used.
-- Runtime receives SELECT only, never appointment/update access.
GRANT SELECT ON forum_owner_bootstrap TO cashback_hist_moderated_runtime;
COMMIT;
