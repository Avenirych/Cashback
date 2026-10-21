# Isolated registration Phone Harness integration — SOURCE ONLY

No Docker/SQL command, role creation or migration was executed by this implementation.
The new collector has no CLI, no import-time IO and no env-based authorization.
Expected identity is in src/docker-phone-registration-target.ts and is NOT evidence.

## Target admission

The original cashback_phone_migration_check_<30 lowercase hex> scenario and role,
version, address, OID and system-identifier constraints are unchanged. No arbitrary
DB name is permitted. cashback_docker_test is a separate branch requiring an opaque
in-process proof issued only by collectRegistrationPhoneTarget. Plain objects,
environment variables, serialized tokens and B/C receipt fields cannot mint a proof.
Test IO injection, like the existing Docker admission collector, is a trusted source
composition boundary; it must never be exposed through HTTP, CLI or env input.

A future separately authorized trusted caller must supply a separately owner-reviewed
registration-phone-target receipt with an independent securitySha256, plus the NEW
bootstrap password via protected secret supply. No approved hash is shipped here.
The collector observes context, daemon, exact full container ID/name/project/service,
health, pinned image (descriptor digest and platform), attached volume, private network,
network identity and IP. It checks Docker again after read-only SQL through the exact
container ID. Password goes through stdin, never command arguments. SQL uses PGOPTIONS
read-only defaults and BEGIN READ ONLY, and verifies system identifier, DB OID/name,
owner and exact server version. Roles/memberships, DB/schema/default ACLs must match
an independently reviewed fingerprint. No live observation is promoted to approval.

The opaque proof expires after 30 seconds and binds all PhoneTarget fields. The
migration session repeats SQL identity/security checks before baseline DDL and every
seventh-migration schema inspection. Original address/port/role checks still apply.
Docker observations and SQL snapshots are NOT an atomic exclusion of external DDL;
the unchanged concurrency gate therefore remains essential and CLOSED.

## Baseline and seventh migration

runPhoneBaselineBootstrap remains the sole first-six implementation in the existing
runner. phoneBaselineMigrations fixes and checks this exact source order:
1. InitialApplicationTables1733927999000
2. AddMarketingPreferences1733928000000
3. AddEmailVerification1735000000000
4. AddForumUsers1791394800000
5. CreateBonusTables1791630000000
6. AddUsersEmailUnique1791888000000

BASELINE receipt and independent afterSixSha256 are required. Empty public schema,
unsupported catalog objects, subscriptions, large objects and history checks remain.
No synchronize, generic CLI, manual application tables or seventh migration is used.
Baseline is currently BLOCKED: CONCURRENCY_UNVERIFIED before datasource construction.

AddUserPhoneAndSmsConsent1792195200000 still requires exact ordered six-entry history,
email unique constraint, approved before/after inventory and schema hashes and a
separately reviewed B (preflight) or C (apply) receipt. Missing/extra/reordered history,
extra tables/roles/ACL and mismatched identity fail closed. The migration itself is
unchanged: additive nullable legacy phones, E.164 checks, SMS-consent consistency,
no user-row updates, no phone uniqueness or automatic consent/verification.

## Concurrency protocol design — NOT IMPLEMENTED/VERIFIED, gate remains false

Advisory locks and table locks do not prevent an administrator/owner from changing
ACLs, role membership, sequence/view definitions or creating new objects. A hash
check before/after cannot rule out a concurrent change followed by reversal.

Before any future proposal to open the gate, a separately approved integration stage
must establish an exclusive maintenance boundary for this exact new cluster:
- independently inventory ALL login/superuser/ownership/SET ROLE paths and active
  sessions, including bootstrap and Docker administrators;
- enforce reviewed connection admission so only a dedicated migration controller
  can perform DDL/ACL changes; merely closing app connections is insufficient;
- verify no external administrator can concurrently reconnect/change that boundary;
- capture/recheck identity and complete role/ACL/catalog inventories under the boundary;
- exercise two-connection adversarial DDL, ACL, ownership, memberships, rules, views,
  sequences, lock waits, disconnects and uncertain commit acknowledgements;
- specify fail-closed lease lifetime, loss handling and restoration as separately
  authorized operations, with no automatic cleanup/retry after uncertain commits.

This would require real connection/ACL/operational-control changes and integration
experiments. Source-only permission cannot establish them. There is deliberately
no verified=true switch, no proof made from an advisory lock, and no code path that
opens PHONE_APPLY_CONCURRENCY_VERIFIED. B/C receipts are still separately required;
mock PASS is not an actual B/C approval. No B/C receipts are created in this task.

## Roles and readiness — future individually authorized sequence only

The Harness still connects as cashback_test, never as registration_bootstrap.
The new cluster currently lacks cashback_test. A role setup stage must be separately
approved and performed only after fresh exact Docker/SQL identity verification.
Do not supply bootstrap credentials as the application's datasource credentials.

1. Create cashback_test using only the NEW dedicated application secret, LOGIN,
   NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS, no memberships.
2. Review/restrict PUBLIC grants, including database TEMP/CONNECT and schema grants,
   so PUBLIC does not give runtime privileges beyond the readiness allowlist.
3. Approve a temporary migration privilege/ownership stage for cashback_test (the
   existing Harness role). Baseline needs schema CREATE and migrations 6/7 need object
   ownership. Never start backend during this stage. Approve fresh security hashes
   for the actual stage; never reuse the current empty-cluster observation as a hash.
4. Under the separately verified concurrency protocol and migration permissions,
   run baseline, review six-entry history/schema; obtain independent B/C receipts;
   only then consider the seventh migration through the SAME Harness.
5. Separately approve transfer of migrated object ownership to a reviewed NOLOGIN
   owner with NO membership granted to cashback_test. Keep DB owner
   registration_bootstrap. Revoke temporary CREATE and every unintended privilege;
   re-review PUBLIC/default ACLs. This ownership transition invalidates earlier
   catalog/security hashes and requires independent after-transition review.
6. Give runtime cashback_test exactly the readiness privileges:
   database CONNECT; public schema USAGE; SELECT/INSERT/UPDATE on users and
   marketing_preferences; USAGE on users_id_seq and marketing_preferences_id_seq;
   SELECT on migrations. No TEMP, CREATE, DELETE, TRUNCATE, REFERENCES, TRIGGER,
   MAINTAIN, elevated role attributes, memberships or object ownership.
7. Review the narrow EXECUTE permission on pg_catalog.pg_control_system() needed by
   identity checks for a non-superuser. Without it, the collector/session/probe fails
   closed; do not grant a broad pg_monitor/admin role or SECURITY DEFINER bypass.
8. Only after separately authorized successful Harness apply and role transition,
   review registration policy provenance/schema/privileges/SMTP peer. Existing
   readiness requires exact seven-entry history, no ownership/membership, actual SMTP
   observation and reviewed policy. No readiness policy or Mailpit guard changed here.

Unresolved permissions are BLOCKERS, not authority to run the above. There is no SQL
or migration execution command in this document. Actual migration permission must
name the exact cluster, migration phase, role stage, reviewed fingerprints/receipts,
exclusive-control protocol and failure/commit-uncertainty handling. Old Cashback and
finance PostgreSQL remain forbidden. STOP until these conditions are independently
reviewed; do not run migrations even when all source tests pass.

## Implemented concurrency verifier (source-only)

The state/evidence verifier is now implemented in src/docker-phone-concurrency.ts
and wired into the existing runner's registration mutation boundaries. See
PHONE-CONCURRENCY-PROTOCOL.md for states, independent authority contract, TOCTOU
checks and the future real trial matrix. This supersedes only the absence of a
state verifier in the design above. Actual access enforcement, independent authority
and live concurrency trials remain unimplemented/unverified; no gate was opened.
