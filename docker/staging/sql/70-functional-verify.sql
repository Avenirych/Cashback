\set ON_ERROR_STOP on
BEGIN READ ONLY;
DO $$ DECLARE r record; BEGIN
 SELECT * INTO STRICT r FROM pg_roles WHERE rolname='cashback_staging_runtime';
 IF r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolinherit OR r.rolreplication OR r.rolbypassrls OR EXISTS(SELECT FROM pg_auth_members WHERE member=r.oid OR roleid=r.oid) OR EXISTS(SELECT FROM pg_class WHERE relowner=r.oid) OR EXISTS(SELECT FROM pg_namespace WHERE nspowner=r.oid) OR EXISTS(SELECT FROM pg_database WHERE datdba=r.oid) THEN RAISE EXCEPTION 'RUNTIME_ADMIN_REFUSED'; END IF;
 IF current_database()<>'cashback_staging_app' OR (SELECT system_identifier::text FROM pg_control_system())<>'7703264865117007916' THEN RAISE EXCEPTION 'WRONG_TARGET'; END IF;
 IF has_table_privilege(r.oid,'forum_moderators','INSERT') OR has_table_privilege(r.oid,'forum_moderators','UPDATE') OR has_table_privilege(r.oid,'forum_moderators','DELETE') OR has_table_privilege(r.oid,'forum_owner_bootstrap','UPDATE') OR has_column_privilege(r.oid,'users','balance','UPDATE') OR has_table_privilege(r.oid,'bonus_items','INSERT') OR has_table_privilege(r.oid,'bonus_transfers','INSERT') OR has_schema_privilege(r.oid,'public','CREATE') OR has_database_privilege(r.oid,current_database(),'CREATE') OR has_database_privilege(r.oid,current_database(),'TEMP') THEN RAISE EXCEPTION 'UNSAFE_RUNTIME_GRANT'; END IF;
 IF NOT EXISTS(SELECT FROM staging_functional_schema WHERE version=1) OR NOT EXISTS(SELECT FROM forum_moderation_schema WHERE version=3) THEN RAISE EXCEPTION 'WRONG_SCHEMA'; END IF;
 IF EXISTS(SELECT FROM users WHERE email !~ '^[A-Za-z0-9._+%-]+@example[.]invalid$' OR balance<>0) OR EXISTS(SELECT FROM bonus_items) OR EXISTS(SELECT FROM bonus_transfers) THEN RAISE EXCEPTION 'FINANCIAL_OR_REAL_DATA'; END IF;
END $$;
ROLLBACK;
