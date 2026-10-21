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
 OR EXISTS(SELECT FROM pg_roles WHERE rolname='cashback_test')
 OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='registration_schema_owner'
   AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
   AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit)
 OR EXISTS(SELECT FROM pg_auth_members WHERE roleid=(SELECT oid FROM pg_roles WHERE rolname='registration_schema_owner')
   OR member=(SELECT oid FROM pg_roles WHERE rolname='registration_schema_owner'))
 OR (SELECT jsonb_agg(jsonb_build_array(timestamp::text,name) ORDER BY id) FROM public.migrations) IS DISTINCT FROM
 '[ ["1733927999000","InitialApplicationTables1733927999000"], ["1733928000000","AddMarketingPreferences1733928000000"], ["1735000000000","AddEmailVerification1735000000000"], ["1791394800000","AddForumUsers1791394800000"], ["1791630000000","CreateBonusTables1791630000000"], ["1791888000000","AddUsersEmailUnique1791888000000"], ["1792195200000","AddUserPhoneAndSmsConsent1792195200000"] ]'::jsonb
 OR EXISTS(SELECT FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','S') AND pg_get_userbyid(relowner)<>'registration_migrator')
 OR (SELECT array_agg(relname::text ORDER BY relname::text COLLATE "C") FROM pg_class
   WHERE relnamespace='public'::regnamespace AND relkind='r') IS DISTINCT FROM
   ARRAY['analytics_events','bonus_items','bonus_transfers','forum_posts','forum_topics','forum_users','marketing_preferences','migrations','post','topic','users']::text[]
 OR (SELECT array_agg(relname::text ORDER BY relname::text COLLATE "C") FROM pg_class
   WHERE relnamespace='public'::regnamespace AND relkind='S') IS DISTINCT FROM
   ARRAY['analytics_events_id_seq','forum_posts_id_seq','forum_topics_id_seq','forum_users_id_seq','marketing_preferences_id_seq','migrations_id_seq','post_id_seq','topic_id_seq','users_id_seq']::text[]
 OR (SELECT array_agg(typname::text ORDER BY typname::text COLLATE "C") FROM pg_type
   WHERE typnamespace='public'::regnamespace AND typtype='e') IS DISTINCT FROM
   ARRAY['bonus_items_source_enum','bonus_items_status_enum']::text[]
 OR (SELECT count(*) FROM public.users)<>0
 THEN RAISE EXCEPTION 'STOP: known seven-migration outcome/empty users/ownership required'; END IF;
END $check$;
-- Exact application roster only: no REASSIGN OWNED and no database-owner change.
ALTER SCHEMA public OWNER TO registration_schema_owner;
ALTER TABLE public.analytics_events OWNER TO registration_schema_owner;
ALTER TABLE public.bonus_items OWNER TO registration_schema_owner;
ALTER TABLE public.bonus_transfers OWNER TO registration_schema_owner;
ALTER TABLE public.forum_posts OWNER TO registration_schema_owner;
ALTER TABLE public.forum_topics OWNER TO registration_schema_owner;
ALTER TABLE public.forum_users OWNER TO registration_schema_owner;
ALTER TABLE public.marketing_preferences OWNER TO registration_schema_owner;
ALTER TABLE public.migrations OWNER TO registration_schema_owner;
ALTER TABLE public.post OWNER TO registration_schema_owner;
ALTER TABLE public.topic OWNER TO registration_schema_owner;
ALTER TABLE public.users OWNER TO registration_schema_owner;
ALTER SEQUENCE public.analytics_events_id_seq OWNER TO registration_schema_owner;
ALTER SEQUENCE public.forum_posts_id_seq OWNER TO registration_schema_owner;
ALTER SEQUENCE public.forum_topics_id_seq OWNER TO registration_schema_owner;
ALTER SEQUENCE public.forum_users_id_seq OWNER TO registration_schema_owner;
ALTER SEQUENCE public.marketing_preferences_id_seq OWNER TO registration_schema_owner;
ALTER SEQUENCE public.migrations_id_seq OWNER TO registration_schema_owner;
ALTER SEQUENCE public.post_id_seq OWNER TO registration_schema_owner;
ALTER SEQUENCE public.topic_id_seq OWNER TO registration_schema_owner;
ALTER SEQUENCE public.users_id_seq OWNER TO registration_schema_owner;
ALTER TYPE public.bonus_items_source_enum OWNER TO registration_schema_owner;
ALTER TYPE public.bonus_items_status_enum OWNER TO registration_schema_owner;
CREATE ROLE cashback_test NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
REVOKE ALL ON DATABASE cashback_docker_test FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE cashback_docker_test TO cashback_test;
GRANT USAGE ON SCHEMA public TO cashback_test;
GRANT SELECT,INSERT,UPDATE ON public.users,public.marketing_preferences TO cashback_test;
GRANT USAGE ON SEQUENCE public.users_id_seq,public.marketing_preferences_id_seq TO cashback_test;
GRANT SELECT ON public.migrations TO cashback_test;
GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system() TO cashback_test;
GRANT SELECT(subdbid) ON pg_catalog.pg_subscription TO cashback_test;
GRANT SELECT(oid) ON pg_catalog.pg_largeobject_metadata TO cashback_test;
REVOKE ALL ON SCHEMA public FROM registration_migrator;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM registration_migrator;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM registration_migrator;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM registration_migrator;
ALTER ROLE registration_migrator NOLOGIN;
ALTER ROLE registration_bootstrap NOLOGIN;
DO $verify$
BEGIN
 IF (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='public')<>'registration_schema_owner'
 OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database())<>'registration_bootstrap'
 OR EXISTS(SELECT FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','S') AND pg_get_userbyid(relowner)<>'registration_schema_owner')
 OR EXISTS(SELECT FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e' AND pg_get_userbyid(typowner)<>'registration_schema_owner')
 OR EXISTS(SELECT FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('cashback_test','registration_schema_owner')))
 OR has_schema_privilege('cashback_test','public','CREATE') OR has_database_privilege('cashback_test',current_database(),'CREATE')
 OR has_database_privilege('cashback_test',current_database(),'TEMP')
 THEN RAISE EXCEPTION 'STOP: runtime ownership/privilege transition mismatch'; END IF;
END $verify$;
COMMIT;
-- NOLOGIN does NOT terminate sessions, disable Docker exec or constrain a host administrator.
-- Enable runtime LOGIN only via approved separate credential/ingress provisioning after readiness review.
