\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $check$
BEGIN
 IF current_database()<>'cashback_docker_test' OR current_user<>'registration_bootstrap'
 OR (SELECT oid FROM pg_database WHERE datname=current_database())<>16384
 OR (SELECT system_identifier::text FROM pg_control_system())<>'7697703338450784294'
 OR current_setting('server_version_num')<>'170011'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'registration_bootstrap'
 OR (SELECT jsonb_agg(jsonb_build_array(timestamp::text,name) ORDER BY id) FROM public.migrations) IS DISTINCT FROM
 '[ ["1733927999000","InitialApplicationTables1733927999000"], ["1733928000000","AddMarketingPreferences1733928000000"], ["1735000000000","AddEmailVerification1735000000000"], ["1791394800000","AddForumUsers1791394800000"], ["1791630000000","CreateBonusTables1791630000000"], ["1791888000000","AddUsersEmailUnique1791888000000"] ]'::jsonb
 OR (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.migrations'::regclass)<>'registration_migrator'
 OR EXISTS(SELECT FROM pg_roles WHERE rolname='cashback_test')
 THEN RAISE EXCEPTION 'STOP: verified baseline and fresh identity required'; END IF;
END $check$;
-- Exact names/order/fingerprints MUST additionally pass existing Harness before this grant.
GRANT SELECT ON public.migrations TO registration_observer;
COMMIT;
