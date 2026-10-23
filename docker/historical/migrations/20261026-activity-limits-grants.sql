-- Explicit owner command: psql -v runtime_role=<verified current application role>
BEGIN;
GRANT SELECT ON activity_limits_schema,activity_limit_policies,activity_user_plans TO :"runtime_role";
REVOKE INSERT,UPDATE,DELETE ON activity_limits_schema,activity_limit_policies,activity_user_plans FROM :"runtime_role";
GRANT SELECT,INSERT,UPDATE,DELETE ON activity_limit_usage,activity_limit_operations,activity_security_events,activity_limit_appeals TO :"runtime_role";
GRANT SELECT,INSERT ON activity_partner_events TO :"runtime_role";
GRANT USAGE,SELECT ON SEQUENCE activity_security_events_id_seq,activity_limit_appeals_id_seq TO :"runtime_role";
COMMIT;
