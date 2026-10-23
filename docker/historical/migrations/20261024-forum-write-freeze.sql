-- First step BEFORE any moderation DDL. Prepared only, psql legacy_runtime_role.
-- Fail-closed fence survives a partial migration or accidental old-binary restart.
BEGIN;
REVOKE SELECT ON forum_topics,forum_posts FROM :"legacy_runtime_role";
REVOKE INSERT,UPDATE,DELETE ON forum_topics,forum_posts,forum_users FROM :"legacy_runtime_role";
REVOKE UPDATE(username,avatar_url,agreed_to_rules,agreed_to_rules_at,banned,ban_reason,updated_at) ON forum_users FROM :"legacy_runtime_role";
GRANT UPDATE(user_id) ON forum_users TO :"legacy_runtime_role";
COMMIT;
