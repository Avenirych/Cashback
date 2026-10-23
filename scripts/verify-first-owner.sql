-- Prepared read-only operator check, after a separately authorized bootstrap.
-- psql -X -v ON_ERROR_STOP=1 -v owner_id=<account ID> -v privacy_sha256=<approved file SHA256> -f scripts/verify-first-owner.sql
-- Connection secrets must never be supplied in command arguments/output.
BEGIN TRANSACTION READ ONLY;
SELECT current_database()='cashback_historical_03573b7'
 AND (SELECT system_identifier::text FROM pg_control_system())='7698666936429441062' AS target_valid \gset
\if :target_valid
\else
ROLLBACK;
\quit 3
\endif
SELECT EXISTS(SELECT 1 FROM public.forum_owner_bootstrap b
 JOIN public.forum_moderators m ON m.user_id=b.owner_user_id
 JOIN public.users u ON u.id=m.user_id JOIN public.forum_users f ON f.user_id=u.id
 WHERE b.singleton=true AND b.consumed_at IS NOT NULL AND b.privacy_acknowledged_at IS NOT NULL
 AND b.privacy_document_sha256=:'privacy_sha256' AND b.owner_user_id=:'owner_id'::integer
 AND m.active=true AND u.email_verified=true AND f.banned=false
 AND f.agreed_to_rules=true AND f.rules_version='2026-10-22-reviews-v1') AS owner_appointment_valid,
 NOT (has_table_privilege('cashback_hist_moderated_runtime','public.forum_moderators','INSERT')
 OR has_table_privilege('cashback_hist_moderated_runtime','public.forum_moderators','UPDATE')
 OR has_table_privilege('cashback_hist_moderated_runtime','public.forum_moderators','DELETE')
 OR has_table_privilege('cashback_hist_moderated_runtime','public.forum_owner_bootstrap','INSERT')
 OR has_table_privilege('cashback_hist_moderated_runtime','public.forum_owner_bootstrap','UPDATE')
 OR has_table_privilege('cashback_hist_moderated_runtime','public.forum_owner_bootstrap','DELETE')) AS runtime_cannot_appoint;
ROLLBACK;
-- Both booleans must be true. This does NOT prove MFA, real mailbox control or human availability.
