-- PREPARED ONLY. NOT EXECUTED. Requires separate owner approval.
-- Derived from d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f:src/migrations/CreateBonusTables.ts (UP only).
-- Target: cluster 7698666936429441062, cashback_historical_03573b7 only.
\set ON_ERROR_STOP on
\if :{?approved_forum_bonus_schema}
\else
  \echo STOP_SEPARATE_SCHEMA_APPROVAL_REQUIRED
  \quit 3
\endif
SELECT :'approved_forum_bonus_schema' = 'owner-approved-forum-bonus-only' AS approval_ok \gset
\if :approval_ok
\else
  \quit 3
\endif
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $guard$
BEGIN
 IF current_database() <> 'cashback_historical_03573b7'
 OR (SELECT oid FROM pg_database WHERE datname=current_database()) <> 16384
 OR current_user <> 'cashback_hist_owner'
 OR (SELECT system_identifier::text FROM pg_control_system()) <> '7698666936429441062'
 OR current_setting('server_version_num')::integer / 10000 <> 17
 OR NOT EXISTS (SELECT 1 FROM public.historical_schema_baseline WHERE commit_sha='03573b7f47ba3c04dc50312bc71e0a7b904c0ce7')
 OR to_regclass('public.forum_users') IS NULL
 OR to_regclass('public.bonus_items') IS NOT NULL
 OR to_regclass('public.bonus_transfers') IS NOT NULL
 OR to_regprocedure('gen_random_uuid()') IS NULL
 OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname IN ('bonus_items_source_enum','bonus_items_status_enum'))
 OR EXISTS (SELECT 1 FROM public.forum_users GROUP BY lower(username) HAVING count(*)>1)
 OR to_regclass('public.forum_users_username_lower_key') IS NOT NULL THEN
   RAISE EXCEPTION 'FORUM_BONUS_TARGET_OR_EMPTY_ADDITION_GUARD_FAILED';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cashback_hist_runtime' AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) THEN
   RAISE EXCEPTION 'RESTRICTED_RUNTIME_ROLE_REQUIRED';
 END IF;
END $guard$;
SET LOCAL search_path = public, pg_catalog;
-- Reference exchange looks up LOWER(username); reject ambiguity without changing names/data.
CREATE UNIQUE INDEX forum_users_username_lower_key ON public.forum_users (lower(username));
CREATE TYPE bonus_items_source_enum AS ENUM
        ('ads', 'research', 'transfer', 'purchase', 'refund');

CREATE TYPE bonus_items_status_enum AS ENUM
        ('pending', 'confirmed', 'spent', 'expired', 'failed');

CREATE TABLE bonus_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" integer NOT NULL REFERENCES users(id),
        source bonus_items_source_enum NOT NULL,
        amount numeric(12, 2) NOT NULL CHECK (amount > 0),
        status bonus_items_status_enum NOT NULL DEFAULT 'confirmed',
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        "referenceId" varchar(100),
        "orderId" varchar(100),
        "transferMeta" jsonb
      );

CREATE INDEX "IDX_bonus_items_available"
      ON bonus_items ("userId", status, "expiresAt");

CREATE TABLE bonus_transfers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "fromUserId" integer NOT NULL REFERENCES users(id),
        "toUserId" integer NOT NULL REFERENCES users(id),
        "fromUsername" varchar(30) NOT NULL,
        "toUsername" varchar(30) NOT NULL,
        amount numeric(12, 2) NOT NULL CHECK (amount > 0),
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status varchar(20) NOT NULL DEFAULT 'completed',
        "idempotencyKey" varchar(100) NOT NULL,
        "requestHash" varchar(64) NOT NULL,
        "sourceBonusId" uuid NOT NULL UNIQUE
      );

CREATE INDEX "IDX_bonus_transfers_sender"
      ON bonus_transfers ("fromUserId", "createdAt");

CREATE INDEX "IDX_bonus_transfers_receiver"
      ON bonus_transfers ("toUserId", "createdAt");
-- Existing reference runtime uses SELECT/INSERT/UPDATE on items, SELECT/INSERT on transfers.
REVOKE ALL ON public.bonus_items, public.bonus_transfers FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.bonus_items TO cashback_hist_runtime;
GRANT SELECT, INSERT ON public.bonus_transfers TO cashback_hist_runtime;
-- UUID identifiers use native PostgreSQL 17 gen_random_uuid(); no extensions/sequences required.
COMMIT;
-- Never automatically DROP tables or reverse migration history to recover.
