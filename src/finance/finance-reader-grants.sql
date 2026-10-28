-- TEMPLATE ONLY: execute exclusively against a separately verified isolated DB first.
-- A DBA creates the new role; never grant new privileges to legacy roles.
CREATE ROLE cashback_finance_ro LOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
ALTER ROLE cashback_finance_ro SET default_transaction_read_only=on;
ALTER ROLE cashback_finance_ro SET statement_timeout='5s';
ALTER ROLE cashback_finance_ro SET lock_timeout='1s';
ALTER ROLE cashback_finance_ro SET idle_in_transaction_session_timeout='10s';
-- CONNECT is granted to the explicitly verified database by deployment tooling, not CURRENT_DATABASE from untrusted config.
GRANT USAGE ON SCHEMA public TO cashback_finance_ro;
GRANT SELECT(id,email_verified,account_uuid) ON public.users TO cashback_finance_ro;
GRANT SELECT(id,owner,kind,available,reserved) ON public.finance_bonus_lots TO cashback_finance_ro;
GRANT SELECT(id,currency,"balancePence") ON public.finance_accounts TO cashback_finance_ro;
GRANT SELECT(lot,version,basis,reference,started,until) ON public.finance_bonus_use_terms TO cashback_finance_ro;
-- History is restricted to own lot account postings; no event keys, hashes or bank evidence exposed.
GRANT SELECT(id,side,"amountPence","accountId","journalId") ON public.finance_postings TO cashback_finance_ro;
GRANT SELECT(id,sealed,"createdAt") ON public.finance_journals TO cashback_finance_ro;
-- Before use audit PUBLIC, memberships, function EXECUTE, default ACL, TEMP/CREATE and ownership.
-- New finance owner must be trusted NOLOGIN; execute identity migration as that owner,
-- using a temporary DBA-authorized ownership/DDL procedure, not a superuser-owned definer function.
