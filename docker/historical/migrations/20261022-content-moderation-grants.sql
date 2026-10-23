-- Prepared only. psql -v runtime_role=<verified restricted application role> -f this-file
-- Never provision a moderator or broaden legacy bonus/account privileges here.
BEGIN;
GRANT SELECT ON forum_moderation_schema,forum_moderators TO :"runtime_role";
REVOKE INSERT,UPDATE,DELETE ON forum_moderators,forum_moderation_schema FROM :"runtime_role";
GRANT SELECT,INSERT,UPDATE ON forum_content_cases,forum_content_appeals TO :"runtime_role";
GRANT SELECT,INSERT ON forum_moderation_events,forum_content_reports,forum_rule_acceptances TO :"runtime_role";
REVOKE UPDATE,DELETE ON forum_moderation_events,forum_content_reports,forum_rule_acceptances FROM :"runtime_role";
GRANT UPDATE(agreed_to_rules,agreed_to_rules_at,rules_version) ON forum_users TO :"runtime_role";
GRANT USAGE,SELECT ON SEQUENCE forum_content_cases_id_seq,forum_content_appeals_id_seq,forum_moderation_events_id_seq,forum_content_reports_id_seq TO :"runtime_role";
COMMIT;
