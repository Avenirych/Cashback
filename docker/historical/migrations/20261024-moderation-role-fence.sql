-- Requires separately provisioned, restricted new_runtime_role (not owner).
-- Revoke legacy forum writes even if an old binary is accidentally restarted.
SELECT (:'legacy_runtime_role'<>:'new_runtime_role' AND (SELECT count(*)=2 FROM pg_roles WHERE rolname IN (:'legacy_runtime_role',:'new_runtime_role') AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND rolinherit) AND NOT pg_has_role(:'legacy_runtime_role',:'new_runtime_role','MEMBER') AND NOT EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND pg_get_userbyid(relowner) IN (:'legacy_runtime_role',:'new_runtime_role'))) AS fence_roles_valid \gset
\if :fence_roles_valid
\else
\quit 3
\endif
BEGIN;
REVOKE SELECT ON forum_topics,forum_posts FROM :"legacy_runtime_role";
GRANT :"legacy_runtime_role" TO :"new_runtime_role";
REVOKE INSERT,UPDATE,DELETE ON forum_topics,forum_posts,forum_users,forum_content_cases,forum_content_appeals,forum_moderation_events,forum_content_reports,forum_rule_acceptances,forum_event_details,forum_event_identities FROM :"legacy_runtime_role";
REVOKE UPDATE(agreed_to_rules,agreed_to_rules_at,rules_version) ON forum_users FROM :"legacy_runtime_role";
-- Allows the existing bonus SELECT FOR UPDATE locks, not a profile mutation.
GRANT UPDATE(user_id) ON forum_users TO :"legacy_runtime_role";
GRANT SELECT,INSERT,UPDATE,DELETE ON forum_topics,forum_posts,forum_users TO :"new_runtime_role";
GRANT SELECT ON forum_moderation_schema,forum_moderators TO :"new_runtime_role";
GRANT SELECT,INSERT,UPDATE ON forum_content_cases,forum_content_appeals TO :"new_runtime_role";
GRANT SELECT,INSERT ON forum_moderation_events,forum_content_reports,forum_rule_acceptances,forum_event_details,forum_event_identities TO :"new_runtime_role";
GRANT USAGE,SELECT ON SEQUENCE forum_topics_id_seq,forum_posts_id_seq,forum_users_id_seq,forum_content_cases_id_seq,forum_content_appeals_id_seq,forum_moderation_events_id_seq,forum_content_reports_id_seq TO :"new_runtime_role";
REVOKE ALL ON forum_retention_holds FROM :"legacy_runtime_role",:"new_runtime_role";
REVOKE ALL ON FUNCTION forum_erase_personal_data(integer),forum_erase_personal_data_unchecked(integer),forum_purge_expired_details(timestamptz),forum_before_user_erasure(),forum_hold_lock() FROM :"legacy_runtime_role",:"new_runtime_role";
COMMIT;
