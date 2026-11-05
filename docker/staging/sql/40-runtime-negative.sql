-- Future isolated rehearsal ONLY, connect directly as runtime over verified TLS. No SET ROLE shortcut.
\set ON_ERROR_STOP on
\set ECHO none
\if :{?expected_system_identifier}
\else
 \quit 3
\endif
BEGIN;
SELECT set_config('staging.expected_cluster', :'expected_system_identifier', true);
DO $guard$
BEGIN
 IF current_database()<>'cashback_staging_app' OR current_user<>'cashback_staging_runtime' OR session_user<>current_user
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR current_setting('staging.expected_cluster')='7698666936429441062'
 OR (SELECT system_identifier::text FROM pg_catalog.pg_control_system())<>current_setting('staging.expected_cluster')
 OR NOT EXISTS(SELECT FROM pg_stat_ssl WHERE pid=pg_backend_pid() AND ssl)
 THEN RAISE EXCEPTION 'STAGING_DIRECT_RUNTIME_TLS_REQUIRED'; END IF;
END $guard$;
DO $negative$
DECLARE t text;
BEGIN
 BEGIN EXECUTE 'CREATE TABLE public.should_never_exist(id int)'; RAISE EXCEPTION 'DDL_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'CREATE SCHEMA should_never_exist'; RAISE EXCEPTION 'SCHEMA_DDL_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'CREATE ROLE should_never_exist'; RAISE EXCEPTION 'ROLE_DDL_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'SET ROLE cashback_staging_schema'; RAISE EXCEPTION 'OWNER_ESCALATION_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'UPDATE public.users SET balance=1 WHERE false'; RAISE EXCEPTION 'BALANCE_UPDATE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'DELETE FROM public.users WHERE false'; RAISE EXCEPTION 'USER_DELETE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN EXECUTE 'INSERT INTO public.users(email,name,balance) VALUES(''negative@example.invalid'',''Synthetic negative'',1)'; RAISE EXCEPTION 'NONZERO_BALANCE_ALLOWED'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN EXECUTE 'SELECT * FROM staging_meta.baseline'; RAISE EXCEPTION 'PRIVATE_SCHEMA_READ_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 FOREACH t IN ARRAY ARRAY['bonus_items','bonus_transfers'] LOOP
  BEGIN EXECUTE format('SELECT * FROM public.%I',t); RAISE EXCEPTION 'FINANCIAL_READ_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE format('INSERT INTO public.%I DEFAULT VALUES',t); RAISE EXCEPTION 'FINANCIAL_INSERT_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE format('UPDATE public.%I SET amount=amount WHERE false',t); RAISE EXCEPTION 'FINANCIAL_UPDATE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE format('DELETE FROM public.%I WHERE false',t); RAISE EXCEPTION 'FINANCIAL_DELETE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE format('TRUNCATE public.%I',t); RAISE EXCEPTION 'FINANCIAL_TRUNCATE_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 IF has_database_privilege(current_user,'postgres','CONNECT') OR has_database_privilege(current_user,'template1','CONNECT')
 THEN RAISE EXCEPTION 'FOREIGN_DATABASE_CONNECT_ALLOWED'; END IF;
END $negative$;
-- Deliberately rollback even successful rehearsal. Separate positive auth/ownership E2E still required.
ROLLBACK;
