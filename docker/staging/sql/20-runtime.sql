-- Secret comes from a protected process environment, never command arguments/echo.
\getenv runtime_password STAGING_RUNTIME_PASSWORD
SELECT length(:'runtime_password')>=32 AND position(chr(10) in :'runtime_password')=0 AND position(chr(13) in :'runtime_password')=0 AS password_ok \gset
\if :password_ok
\else
 \quit 3
\endif
CREATE ROLE cashback_staging_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD :'runtime_password';
REVOKE ALL ON DATABASE cashback_staging_app FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
REVOKE ALL ON DATABASE template1 FROM PUBLIC;
GRANT CONNECT ON DATABASE cashback_staging_app TO cashback_staging_runtime;
REVOKE ALL ON SCHEMA public,staging_meta FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cashback_staging_runtime;
REVOKE ALL ON ALL TABLES IN SCHEMA public,staging_meta FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public,staging_meta FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public,staging_meta FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE cashback_staging_schema IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE cashback_staging_schema IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE cashback_staging_schema IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
GRANT SELECT,INSERT ON public.users TO cashback_staging_runtime;
GRANT UPDATE(email,name,first_name,last_name,phone_e164,avatar_url,password,email_verified,email_token,email_token_expires_at) ON public.users TO cashback_staging_runtime;
GRANT SELECT ON public.forum_users,public.forum_topics,public.forum_posts,public.topic,public.post TO cashback_staging_runtime;
GRANT SELECT,INSERT ON public.marketing_preferences TO cashback_staging_runtime;
GRANT UPDATE("accountUpdates","specialOffers","partnerRecommendations","smsMarketing","smsMarketingGrantedAt","smsMarketingRevokedAt","smsMarketingConsentVersion","updatedAt") ON public.marketing_preferences TO cashback_staging_runtime;
GRANT SELECT ON public.activity_limits_schema,public.activity_limit_policies,public.activity_user_plans TO cashback_staging_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.activity_limit_usage,public.activity_limit_operations,public.activity_security_events,public.activity_limit_appeals TO cashback_staging_runtime;
GRANT SELECT,INSERT ON public.activity_partner_events TO cashback_staging_runtime;
GRANT USAGE ON SEQUENCE public.users_id_seq,public.marketing_preferences_id_seq TO cashback_staging_runtime;
GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system() TO cashback_staging_runtime;
-- No grants on bonus_items/bonus_transfers, no finance schema, no UUID-enrollment.
