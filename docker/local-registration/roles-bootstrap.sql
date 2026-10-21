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
 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN ('registration_migrator','registration_observer','registration_schema_owner','cashback_test'))
 OR EXISTS(SELECT FROM pg_class WHERE relnamespace='public'::regnamespace)
 THEN RAISE EXCEPTION 'STOP: exact empty registration cluster/roles required'; END IF;
END $check$;
CREATE ROLE registration_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
CREATE ROLE registration_observer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
-- No membership or LOGIN path to the future object owner is granted.
CREATE ROLE registration_schema_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
REVOKE ALL ON DATABASE cashback_docker_test FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE cashback_docker_test TO registration_migrator,registration_observer;
GRANT USAGE,CREATE ON SCHEMA public TO registration_migrator;
GRANT USAGE ON SCHEMA public TO registration_observer;
GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system() TO registration_migrator,registration_observer;
GRANT SELECT(subdbid) ON pg_catalog.pg_subscription TO registration_migrator,registration_observer;
GRANT SELECT(oid) ON pg_catalog.pg_largeobject_metadata TO registration_migrator,registration_observer;
GRANT pg_read_all_stats TO registration_observer WITH ADMIN FALSE, INHERIT TRUE, SET FALSE;
ALTER ROLE registration_observer SET default_transaction_read_only=on;
ALTER ROLE registration_observer SET statement_timeout='1000ms';
ALTER ROLE registration_observer SET lock_timeout='500ms';
ALTER ROLE registration_observer SET idle_in_transaction_session_timeout='2000ms';
COMMIT;
-- No passwords or LOGIN. Independently provision each credential and HBA/broker boundary later.
