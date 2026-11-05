# B02 synthetic PostgreSQL baseline — prepared, NOT applied

This is independent SQL authored for a NEW, EMPTY, synthetic PostgreSQL17 cluster/database. No historical scripts are included, rewritten or executed. No historical rows/dump, real email/password/JWT, finance migrations or UUID enrollment. No application startup integration.

## Files and order

- apply.sql: psql transaction wrapper, ON_ERROR_STOP, no echo, session-only log suppression for password-bearing statement; all failures roll back transactional roles/DDL/data.
- 00-preflight.sql: mandatory independent cluster/OID/data-directory pins, approval B02_SYNTHETIC_ONLY, exact database cashback_staging_app/owner cashback_staging_owner, direct Unix socket, PG17, no existing public objects/custom schemas/roles/extensions or foreign user DB, advisory transaction lock. No missing-variable defaults. Reject known historical cluster. This guard intentionally REFUSES rerunning on an installed/partial schema.
- 10-schema.sql:18 public tables + private staging_meta.baseline; empty application tables, only version/policy constants inserted.10 registered TypeORM entities covered;8 raw-SQL activity tables covered. Empty legacy bonus tables exist solely for entity metadata compatibility; no runtime access or data. No finance/finance_identity or account_uuid.
- 20-runtime.sql: exact role and grants. STAGING_RUNTIME_PASSWORD comes from a protected environment file bridge, not CLI arguments or committed SQL. Use the SAME secret as backend db_password; >=32 characters, no CR/LF. No passwords have been generated here.
- 30-verify.sql: owner-side role/ownership/membership, forbidden financial/DDL/private access, empty-user-state and table-count checks before COMMIT.
- 40-runtime-negative.sql: future separate DIRECT runtime TLS connection; guarded negative DDL/escalation/financial access/nonzero-balance/private-schema/foreign-DB checks, always ROLLBACK. Not included in apply.sql and not executed now.
- grant-policy.json: exact expected explicit runtime grants, checked against parsed GRANT statements.
- validate.cjs: offline PG17 grammar + TypeORM metadata + ACL allowlist and negative mutations. No database connections. Set STAGING_SQL_PARSER to an externally installed libpg-query17 path and STAGING_SQL_REPORT to a D: JSON path. Parser package and diagnostic cache belong outside Git.

## Roles / grants

| Role | Ownership / permissions | Explicitly excluded |
|---|---|---|
| cashback_staging_owner | Isolated cluster bootstrap DBA only; executes prepared baseline through Unix socket | Never passed to backend; no working-cluster use |
| cashback_staging_schema | NOLOGIN, no superuser/createdb/createrole/replication/bypassrls/inherit; owns new app objects and private marker | No LOGIN or memberships; runtime cannot SET ROLE to it |
| cashback_staging_runtime | LOGIN with all elevated attributes false, no memberships/ownership | DDL, CREATE/TEMP on DB, schema CREATE, foreign DB CONNECT, finance, private marker, grants/admin options |

Runtime grants:
- database cashback_staging_app CONNECT; public schema USAGE.
- users SELECT/INSERT; UPDATE only email,name,first_name,last_name,phone_e164,avatar_url,password,email_verified,email_token,email_token_expires_at. No balance UPDATE or DELETE. Whole-row INSERT is needed by current TypeORM INSERT/RETURNING; balance CHECK=0 prevents financial value insertion. Email CHECK accepts only synthetic @example.invalid. These restrictions apply ONLY to this synthetic DB, never to historical data.
- forum_users/forum_topics/forum_posts/topic/post SELECT only. B01 closes forum mutations; no insert/update/delete or sequence grants are needed.
- marketing_preferences SELECT/INSERT; UPDATE only accountUpdates,specialOffers,partnerRecommendations,smsMarketing,smsMarketingGrantedAt,smsMarketingRevokedAt,smsMarketingConsentVersion,updatedAt.
- activity_limits_schema/activity_limit_policies/activity_user_plans SELECT only.
- activity_limit_usage/activity_limit_operations/activity_security_events/activity_limit_appeals SELECT/INSERT/UPDATE/DELETE for existing security quotas, appeals and retention.
- activity_partner_events SELECT/INSERT only (quota events, no money).
- users_id_seq/marketing_preferences_id_seq USAGE only. Identity sequences on activity tables need no separate privilege for ordinary INSERT; no setval/UPDATE privilege.
- pg_catalog.pg_control_system() EXECUTE only for B01 cluster identity query. No pg_monitor/pg_read_all_data/admin role membership.
- No privileges on bonus_items/bonus_transfers/analytics_events/staging_meta; no default future runtime grants. analytics is unexposed in current controller. Revoke PUBLIC database/schema/table/sequence/custom-function access; PostgreSQL catalog metadata and safe builtin functions remain available normally.

## Isolation scope (do not overclaim)

This shared backend role necessarily reads multiple synthetic user records for login, email verification, foreign keys and user lookup. There is NO per-user DB RLS/session UUID context in the present app. JWT/ownership tests enforce client user isolation at API level; direct runtime credentials must never reach a browser/tester. This baseline restricts access to the single synthetic database and named app objects, not arbitrary per-user SQL sent with backend credentials.
B01 DEMO_ONLY closes registration, forum is read-only, public reviews disabled. Do not bypass these flags during rehearsal; B05 needs separate review. Missing moderation tables intentionally keep admin/moderation unavailable. Legacy bonus snapshot reads will be refused by DB ACL if called directly; do not mistake this for a working financial GET API or fabricate balances.

## Future separately approved rehearsal (not authorized now)

1. Inspect labels/mounts/networks/ports against compose.staging.yaml and prove no live resource attachments. Review source hashes, image digests and this baseline. No DB populated from historical sources.
2. Start ONLY the isolated PG17 (separate future permission). Attest system identifier, database OID and data_directory independently from that cluster; confirm empty application schema and roles. Never pass a production connection URL. Check owner secret remains local to DBA.
3. Use psql17 -X -w --no-psqlrc over the container-local Unix socket as cashback_staging_owner to cashback_staging_app. Supply expected_system_identifier, expected_database_oid, expected_data_directory and approval using nonsecret psql variables. Provide owner PGPASSWORD and STAGING_RUNTIME_PASSWORD only via protected process environment loaded from separate files. Disable shell tracing, psql echo and pg audit query capture. Never put secret values in arguments/logs. Do not enable include-all SQL logging. No DB URL fallback.
4. Run ONLY apply.sql. On any error, ON_ERROR_STOP disconnect/ROLLBACK; do not continue to later files or remove guards. Verify transaction rollback/absence of partial roles/objects. If schema exists, stop for diagnosis; no automatic drop/retry/reset. Do not run this again over retained history.
5. Read-only inspect constraints/indexes/FKs/types/defaults/ACLs against SQL-VALIDATION.json and grant-policy.json. Verify marker/version/policy values and zero users/bonus rows. Test pg_control_system as actual runtime role over TLS with certificate verification, wrong CA/cluster/DB/user tests must refuse B01.
6. Connect DIRECTLY as runtime via TLS and run40-runtime-negative.sql with the independently approved cluster pin. Verify every caught permission/check violation is expected; connection to postgres/template1 must also fail. Negative script ROLLBACKs. Test extra unrelated sentinel table and schema (DBA-owned) read denial in this isolated fixture, then remove only fixture via rollback.
7. As DBA, provision only approved synthetic user fixtures through a separately reviewed transaction; no real PII or finance records. Exercise login, verification, marketing preference update, limits/appeals/cleanup and cross-user JWT denials. Ordinary auth/marketing need nonfinancial writes; this is not a financial read-only role.
8. All19 finance migrations/enrollment/grants remain absent. Run unchanged B04 service/HTTP suite and confirm68 command denials, no financial updates and inaccessible old writer routes; no requests to live ports3004/3005/3006.
9. Interrupt/retry on fresh test fixtures to prove rollback; successful installed baseline must REFUSE rerun, never erase records. No DROP schema/role/database rollback script provided. Tear down only proven owned ephemeral resources after separate authorization, preserving existing Docker resources.

PG17 parser checks outer SQL grammar; DO-body compilation, actual execution, permissions, real constraints/locks and lifecycle must be proven by this future rehearsal. No runtime readiness follows from static validation.
