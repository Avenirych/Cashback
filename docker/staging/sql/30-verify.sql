DO $verify$
DECLARE r record; t text;
BEGIN
 SELECT * INTO STRICT r FROM pg_roles WHERE rolname='cashback_staging_runtime';
 IF r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR r.rolinherit
 OR EXISTS(SELECT FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid)
 OR EXISTS(SELECT FROM pg_class WHERE relowner=r.oid)
 OR EXISTS(SELECT FROM pg_namespace WHERE nspowner=r.oid)
 OR EXISTS(SELECT FROM pg_database WHERE datdba=r.oid)
 OR has_database_privilege(r.oid,current_database(),'CREATE') OR has_database_privilege(r.oid,current_database(),'TEMP')
 OR has_schema_privilege(r.oid,'public','CREATE') OR has_schema_privilege(r.oid,'staging_meta','USAGE')
 OR has_database_privilege(r.oid,'postgres','CONNECT') OR has_database_privilege(r.oid,'template1','CONNECT')
 OR has_column_privilege(r.oid,'users','balance','UPDATE') OR has_table_privilege(r.oid,'users','DELETE')
 OR NOT has_function_privilege(r.oid,'pg_catalog.pg_control_system()','EXECUTE')
 THEN RAISE EXCEPTION 'STAGING_RUNTIME_ACL_REFUSED'; END IF;
 FOREACH t IN ARRAY ARRAY['bonus_items','bonus_transfers'] LOOP
  IF has_table_privilege(r.oid,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN RAISE EXCEPTION 'STAGING_FINANCIAL_PRIVILEGE_REFUSED'; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM pg_namespace WHERE nspname IN ('finance','finance_identity'))
 OR EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='account_uuid')
 OR EXISTS(SELECT FROM public.users) OR EXISTS(SELECT FROM public.bonus_items) OR EXISTS(SELECT FROM public.bonus_transfers)
 OR (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')<>18
 THEN RAISE EXCEPTION 'STAGING_SCHEMA_OR_SYNTHETIC_STATE_REFUSED'; END IF;
END $verify$;
