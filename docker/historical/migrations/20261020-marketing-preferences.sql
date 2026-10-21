\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF current_database()<>'cashback_historical_03573b7'
 OR (SELECT oid FROM pg_database WHERE datname=current_database())<>16384
 OR (SELECT system_identifier::text FROM pg_control_system())<>'7698666936429441062'
 OR current_user<>'cashback_hist_owner'
 OR current_setting('server_version_num')::integer/10000<>17
 OR NOT EXISTS(SELECT 1 FROM public.historical_schema_baseline WHERE commit_sha='03573b7f47ba3c04dc50312bc71e0a7b904c0ce7')
 OR to_regclass('public.marketing_preferences') IS NOT NULL
 OR to_regclass('public.marketing_preferences_id_seq') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cashback_hist_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls)
 THEN RAISE EXCEPTION 'MARKETING_TARGET_OR_EXISTING_OBJECT'; END IF;
END $guard$;
CREATE TABLE public.marketing_preferences (
 id serial PRIMARY KEY,
 "userId" integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
 "accountUpdates" boolean NOT NULL DEFAULT true,
 "specialOffers" boolean NOT NULL DEFAULT false,
 "partnerRecommendations" boolean NOT NULL DEFAULT false,
 "smsMarketing" boolean NOT NULL DEFAULT false,
 "smsMarketingGrantedAt" timestamptz,
 "smsMarketingRevokedAt" timestamptz,
 "smsMarketingConsentVersion" varchar(64),
 "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT marketing_sms_consent_check CHECK (
 ("smsMarketingGrantedAt" IS NULL AND "smsMarketingRevokedAt" IS NULL AND "smsMarketingConsentVersion" IS NULL AND NOT "smsMarketing") OR
 ("smsMarketingGrantedAt" IS NOT NULL AND "smsMarketingConsentVersion" IS NOT NULL AND length("smsMarketingConsentVersion")>0 AND
 (("smsMarketing" AND "smsMarketingRevokedAt" IS NULL) OR (NOT "smsMarketing" AND "smsMarketingRevokedAt">="smsMarketingGrantedAt"))))
);
GRANT SELECT, INSERT, UPDATE ON public.marketing_preferences TO cashback_hist_runtime;
GRANT USAGE, SELECT ON SEQUENCE public.marketing_preferences_id_seq TO cashback_hist_runtime;
COMMIT;
