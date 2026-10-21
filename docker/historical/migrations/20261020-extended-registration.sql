\set ON_ERROR_STOP on
-- Additive only. Existing names, phones, passwords and verification state are not rewritten.
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
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('first_name','last_name','phone_e164'))
 THEN RAISE EXCEPTION 'EXTENDED_IDENTITY_OR_PARTIAL_SCHEMA'; END IF;
END $guard$;
ALTER TABLE public.users
 ADD COLUMN first_name varchar(100) NULL CHECK (first_name IS NULL OR length(btrim(first_name)) BETWEEN 2 AND 100),
 ADD COLUMN last_name varchar(100) NULL CHECK (last_name IS NULL OR length(btrim(last_name)) BETWEEN 2 AND 100),
 ADD COLUMN phone_e164 varchar(16) NULL CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{1,14}$');
-- Existing table-level runtime grants cover these columns. No privileges added.
COMMIT;
