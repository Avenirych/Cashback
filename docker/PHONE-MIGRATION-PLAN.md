# Isolated phone migration — source implementation only

## Independent permissions

* A: source implementation, isolated mock unit tests and no-emit typecheck, granted.
* B: read-only preflight on an explicitly approved isolated PostgreSQL target, NOT GRANTED.
* C: application of the seventh migration on that exact target, NOT GRANTED.

A does not grant B/C. A B receipt cannot authorize apply; a C receipt cannot silently
authorize another operation. No connection, provisioning, test or migration is authorized
by this document. Finance-security permissions/gates are unrelated and unchanged.

## Target and admission

Use a separately provisioned synthetic-only database named
`cashback_phone_migration_check_<30 lowercase hexadecimal characters>` on
`postgres-test:5432`, role `cashback_test`. This pattern alone is NOT approval.
An owner-reviewed receipt must bind the exact database, database OID, server address,
PostgreSQL cluster system identifier, exact PostgreSQL 17 server_version_num,
operation `phone-seventh-only`, and permission B or C. No actual target or fingerprints
are approved or supplied by this implementation. Never reuse the main test database,
production, or the retained email integration database.

The receipt requires schemaFormat `PHONE_SCHEMA_V2`, independently reviewed beforeObjects
and afterObjects inventories (exact kind/key pairs), plus distinct independently reviewed
before/after SHA-256 values of the canonical catalog result used by `inspectPhoneDatabase`.
Missing, extra, duplicate or unknown object kinds are refused. Review these against
the migration sources and independently approved synthetic baseline, including table
roster, column types/nullability/defaults, constraints, indexes, ownership/ACLs, triggers,
RLS, types, routines, extensions, view/materialized-view definitions, rewrite rules,
sequence parameters (not current values), FK/dependency edges, default ACLs, effective
schema/table/sequence privileges and role memberships. Do not compute a fingerprint from an unknown
target and approve it merely because it matches itself. Fingerprints are sensitive to
PostgreSQL version, generated names and some catalog identifiers; they are target-bound,
not portable schema proofs. The table roster is fixed to the eleven tables created by
the six baseline migrations including history. Catalog families outside the supported
surface cause BLOCKED: additional user schemas, foreign servers/wrappers, event triggers,
publications, partitioning/inheritance, unsupported relation/type/routine kinds and custom
public collations/operators/operator families/classes/conversions/text-search objects.
Failure or insufficient privileges while inspecting any catalog also causes BLOCKED.
This is not a complete audit of a PostgreSQL server or privileged interference.
B/C remain BLOCKED until owner approval of an exact target and independent baselines.
Missing catalog-query privileges, including pg_control_system access, cause refusal;
do not grant privileges automatically or bypass the query.

Exactly these six history rows, in id order, are required:

1. InitialApplicationTables1733927999000
2. AddMarketingPreferences1733928000000
3. AddEmailVerification1735000000000
4. AddForumUsers1791394800000
5. CreateBonusTables1791630000000
6. AddUsersEmailUnique1791888000000

The timestamps must match their names. `UQ_users_email` must be a validated,
non-deferrable unique constraint on email with a valid/ready backing index.
Phone/SMS columns and phone/SMS constraints must be absent; all other catalog
objects must match the reviewed baseline. Existing users need not be deleted.
Future integration must use synthetic users only, including legacy NULL phones;
never copy actual user records or credentials.

## Invocation boundary and transactions

There is deliberately no executable CLI entry point, default approved receipt,
environment-based permission, dotenv loading, DATABASE_URL or production fallback.
`runPhoneMigration(mode, receipt, password)` is an internal API for a future separately
approved trusted caller, not an authorization service. An arbitrary object supplied
by a caller is not proof of owner approval. The default call refuses before connecting.
Only `preflight` and `apply` are accepted. No generic TypeORM CLI/runMigrations or down.

Preflight: one QueryRunner, REPEATABLE READ read-only transaction, catalog SELECTs and
explicit existing-history SELECT only; rollback, release, destroy. No discovery,
table creation, schema synchronization or migration execution.

Apply preparation: one READ COMMITTED transaction/QueryRunner; check actual isolation,
receipt and baseline; lock history then users then marketing_preferences (ACCESS EXCLUSIVE);
check isolation again and repeat baseline inspection after all locks. New statement
snapshots replace the previous SERIALIZABLE snapshot. A changed history/schema or lock
failure blocks the operation without retry. Multi-statement catalog inspection is not
an atomic freeze of all DDL/ACLs and roles, even with these table locks.

`PHONE_APPLY_CONCURRENCY_VERIFIED=false` therefore blocks apply before up(), history writes
or commit, with rollback/release/destroy. It cannot be enabled by a receipt or runtime
argument. A future separately authorized source change and isolated PostgreSQL integration
review must establish the full concurrent-DDL/privilege exclusion protocol; simply
observing unchanged hashes or receiving permission C is insufficient to open the gate.
The dormant tail retains only the fixed seventh migration up(), resulting-schema check,
one history insert and final verification in the same transaction. There is no path
around the concurrency gate in runPhoneMigration.
No user-row DML. Existing NULL phones and existing marketing preferences are preserved
by the additive migration. No retry, bootstrap, replay of six migrations or automatic down.

Connection timeout is 5 seconds, statement timeout 10 seconds, lock timeout 3 seconds,
idle transaction timeout 15 seconds. These are server/driver limits, not an absolute
wall-clock termination guarantee. Rollback/release/destroy are attempted on failure.
Cleanup uncertainty blocks PASS. Commit acknowledgement failure is
COMMIT_OUTCOME_UNKNOWN: a subsequent rollback cannot prove the commit did not occur.
Stop, retain the target unchanged, obtain separate read-only investigation permission;
never retry apply or invoke down against an unknown state. No raw exception text,
SQL diagnostics, credential or user data is returned by the runner.

## Historical email scenario

Do not extend or reuse docker-main-test-data-source/preflight or the email integration
runner: their exact six-migration guard and special email-unique starting state are a
different operation. The phone runner requires email uniqueness already present and
six completed migrations. Registration tests preserve this distinction.

## Outstanding verification

Build, real PostgreSQL tests and migration execution are NOT EXECUTED.
Real PostgreSQL catalog serialization, permissions, timeout/lock behavior, atomicity,
history sequence behavior, resulting CHECK definitions, preservation of synthetic
legacy users/preferences and disconnect/commit uncertainty require separate B/C
authorization and an isolated integration plan. No runtime success is claimed.

## Fingerprint V2 format and integration stop conditions

UTF-8 SHA-256 input is canonical JSON `{format,objects}`. Object keys are recursively
sorted by JavaScript code-unit order; kind/key pairs are sorted independently of incoming
catalog row order. JSON escaping and explicit nulls are retained. Arrays retain order
(including enum labels and ACL representations); undefined/non-JSON values, non-safe
numbers, missing/duplicate/unknown inventory entries cause refusal. Large sequence
parameters are selected as decimal strings. Format changes invalidate all old hashes.
No user rows, materialized-view contents, sequence current values or credential catalogs
are queried. Expected inventories/hashes are independent trusted inputs; no learning mode.

Before any future apply, integration must verify catalog SQL on the exact server version,
two-connection history/DDL races, lock acquisition order/timeouts, actual READ COMMITTED
snapshots after waiting, privilege changes and sequence/view/rule races. If other sessions
cannot be reliably excluded from relevant DDL/ACL changes, STOP: apply remains BLOCKED.
Test commit-acknowledgement uncertainty separately with synthetic state; never interpret
rollback as proof that an unacknowledged commit failed. Only synthetic users may be used.

## Source hardening validation (A only)

Backend no-emit TypeScript typecheck passed. The isolated
`src/docker-phone-migration-preflight.spec.ts` passed 42/42 mock unit cases, with explicit
src roots, exact test path and work/config-backups/infra exclusions. No other tests,
PostgreSQL connections, migrations, Docker, application or production build were run.
These results do not validate PostgreSQL catalog SQL or open the concurrency gate.
B/C remain NOT GRANTED; PHONE_APPLY_CONCURRENCY_VERIFIED remains false.
