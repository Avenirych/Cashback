-- Values are supplied by separately approved isolated DBA procedure; no defaults.
\if :{?expected_system_identifier}
\else
 \quit 3
\endif
\if :{?expected_database_oid}
\else
 \quit 3
\endif
\if :{?expected_data_directory}
\else
 \quit 3
\endif
\if :{?approval}
\else
 \quit 3
\endif
SELECT set_config('staging.expected_cluster', :'expected_system_identifier', true),
 set_config('staging.expected_oid', :'expected_database_oid', true),
 set_config('staging.expected_directory', :'expected_data_directory', true),
 set_config('staging.approval', :'approval', true);
DO $guard$
BEGIN
 IF current_database()<>'cashback_staging_app' OR current_user<>'cashback_staging_owner'
 OR session_user<>current_user OR inet_server_addr() IS NOT NULL
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR current_setting('staging.approval')<>'B02_SYNTHETIC_ONLY'
 OR current_setting('staging.expected_cluster') !~ '^[0-9]{19,20}$'
 OR current_setting('staging.expected_cluster')='7698666936429441062'
 OR (SELECT system_identifier::text FROM pg_catalog.pg_control_system())<>current_setting('staging.expected_cluster')
 OR (SELECT oid::text FROM pg_catalog.pg_database WHERE datname=current_database())<>current_setting('staging.expected_oid')
 OR current_setting('data_directory')<>current_setting('staging.expected_directory')
 OR EXISTS(SELECT FROM pg_catalog.pg_database WHERE NOT datistemplate AND datname NOT IN ('postgres','cashback_staging_app'))
 OR EXISTS(SELECT FROM pg_catalog.pg_namespace WHERE nspname NOT IN ('public','information_schema','pg_catalog','pg_toast'))
 OR EXISTS(SELECT FROM pg_catalog.pg_class WHERE relnamespace='public'::regnamespace)
 OR EXISTS(SELECT FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace)
 OR EXISTS(SELECT FROM pg_catalog.pg_type WHERE typnamespace='public'::regnamespace)
 OR EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname !~ '^pg_' AND rolname<>'cashback_staging_owner')
 OR EXISTS(SELECT FROM pg_catalog.pg_extension WHERE extname<>'plpgsql')
 OR EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname IN ('cashback_staging_schema','cashback_staging_runtime'))
 OR NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user)
 THEN RAISE EXCEPTION 'STAGING_NEW_EMPTY_IDENTITY_REQUIRED'; END IF;
 IF NOT pg_try_advisory_xact_lock(729901,20261029) THEN RAISE EXCEPTION 'STAGING_BASELINE_BUSY'; END IF;
END $guard$;
