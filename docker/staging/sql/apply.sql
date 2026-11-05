-- MANUAL ONLY. Never mounted in initdb; never called by application/container startup.
\set ON_ERROR_STOP on
\set ECHO none
\set VERBOSITY terse
BEGIN;
SET LOCAL log_statement='none';
SET LOCAL log_min_error_statement='panic';
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
\ir 00-preflight.sql
\ir 10-schema.sql
\ir 20-runtime.sql
\ir 30-verify.sql
COMMIT;
