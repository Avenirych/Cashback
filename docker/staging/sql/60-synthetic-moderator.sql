\set ON_ERROR_STOP on
-- Repeatable operator appointment of an ALREADY verified synthetic forum member.
\if :{?expected_system_identifier}
\else
 SELECT 1/0 AS staging_guard_refused;
\endif
\if :{?synthetic_email}
\else
 SELECT 1/0 AS staging_guard_refused;
\endif
SELECT current_database()='cashback_staging_app' AND system_identifier::text=:'expected_system_identifier' AND system_identifier::text<>'7698666936429441062' AND :'synthetic_email' ~ '^[A-Za-z0-9._+%-]+@example[.]invalid$' AS target_ok FROM pg_control_system() \gset
\if :target_ok
\else
 SELECT 1/0 AS staging_guard_refused;
\endif
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(62023,1);
SELECT u.id AS synthetic_id FROM users u JOIN forum_users f ON f.user_id=u.id WHERE u.email=:'synthetic_email' AND u.email_verified=true AND f.banned=false AND f.agreed_to_rules=true AND f.rules_version='2026-10-22-reviews-v1' \gset
\if :{?synthetic_id}
\else
 SELECT 1/0 AS staging_guard_refused;
\endif
SELECT consumed_at IS NULL OR owner_user_id=:synthetic_id AS appointment_ok FROM forum_owner_bootstrap WHERE singleton=true \gset
\if :appointment_ok
\else
 SELECT 1/0 AS staging_guard_refused;
\endif
SET LOCAL ROLE cashback_staging_schema;
INSERT INTO forum_moderators(user_id,active) VALUES(:synthetic_id,true) ON CONFLICT(user_id) DO UPDATE SET active=true;
UPDATE forum_owner_bootstrap SET owner_user_id=:synthetic_id,consumed_at=clock_timestamp(),privacy_acknowledged_at=clock_timestamp(),privacy_document_sha256='00a8978677c4a0d716799b94214ff1a3e87a307ac39bfab8e9ae50b592f938ec' WHERE singleton=true AND consumed_at IS NULL;
-- Marker is strictly synthetic workflow acknowledgement, not production privacy appointment evidence.
COMMIT;
