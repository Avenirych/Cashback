# Registration source changes — runtime remains blocked

No Docker, database, SMTP, migration, registration or account operation is authorized
by these source changes. No default target receipt, secret or approved image is supplied.

## Request consent

POST /auth/register now requires termsAccepted === true (not a truthy string/number).
The existing unchecked frontend checkbox supplies the field; both route and service
refuse absent/false consent. /terms and /privacy links and translations are preserved.
There is no new storage or backfill. Validation of a request is not a persisted legal
audit trail, and must not be described as one.

Proposed persistence change, NOT an executable migration or applied schema:
- Add nullable users.registration_terms_accepted_at timestamptz and
  users.registration_terms_version varchar(64).
- CHECK: both are NULL, or both are non-NULL with a nonempty version.
- Existing users remain NULL; no default true, timestamp or synthetic acceptance.
- For future new accounts only, after strict true validation, write server time and
  an independently published document version in the same account insert.
- Requires separate schema/API review and a new post-phone migration authorization.
  Do not include this proposal in the six-migration bootstrap or phone-seventh-only
  Harness operation. It changes fingerprints and migration history; the exact current
  readiness policy must be separately revised before such a schema could be accepted.

## Mailpit at localhost:3003

The one explicit cashback-local-mailpit-registration scenario now requires
FRONTEND_URL=http://localhost:3003. Other frontend URLs refuse, including 3000.
Outside LOCAL_DEMO_MAILPIT=true ordinary MailService behavior is unchanged.
SMTP remains mailpit:1025, no authentication, secure=false, USE_ETHEREAL=false,
exact synthetic sender, DB_HOST=postgres-test and DB_NAME=cashback_docker_test.
Both recipient checks remain; relay stays disabled. Compose frontend publishes
127.0.0.1:3003:3000 (internal CRA port 3000). Do not start it together with the host
frontend on 3003. Config tests and the independently fixed admission template digest
were updated only for the exact frontend port/link changes, not to accept arbitrary config.
The older retained email scenario using 3000 is no longer an approved Mailpit launch
under this guard; do not run or silently rewrite its integration environment.

## Trusted readiness composition

AuthModule now registers REGISTRATION_PROBE and REGISTRATION_POLICY via
registrationReadinessProviders(). The default policy is null, deliberately: no
reviewed cluster, OID, PostgreSQL minor, full catalog hash, privileges, SMTP peer or
Harness provenance has been approved. No env READY flag or observed-state learning.
A future reviewed composition may pass a RegistrationPolicy to that factory. Caller
objects/fixtures are not proof of approval. It freezes a defensive copy of the policy.

DatabaseRegistrationProbe checks the configured connection target before acquiring a
QueryRunner, uses REPEATABLE READ + READ ONLY, verifies actual isolation/read-only state,
identity, closed catalog surface, full PHONE_SCHEMA_V2 fingerprint, seven-row history,
effective PUBLIC/inherited/table/column/sequence/routine privileges, memberships and
role/object ownership flags. It reuses the existing Harness catalog SQL; it does not
execute migrations or read user rows. Unsupported catalog families refuse. Query or
cleanup uncertainty refuses. PostgreSQL queries have 1s statement and 500ms lock limits;
the existing readiness service retains its 3s deadline/AbortSignal and 5s freshness.
Abort prevents subsequent queries; it is not a guarantee of immediate pool acquisition
or server-side cancellation. A future runtime review must validate pool/timeouts and
cleanup on the exact driver/server; no integration success is claimed.

SMTP probe resolves mailpit to the independently reviewed private IPv4 address and
connects to that address on 1025, confirms the actual remote peer, then reads 220,
sends EHLO, reads 250 and sends QUIT/reads 221. No MAIL FROM, RCPT TO, DATA, AUTH or
message is sent. Socket lifetime is bounded to 1.5s and reply bytes to 16KiB; abort
closes the socket. DNS completion after cancellation cannot open a socket.
Unit tests replace DB, DNS and sockets; no live probe was run. Missing policy,
provenance, schema, SMTP or privileges continues to produce HTTP 503.

## Existing Harness: first-six bootstrap source API

runPhoneBaselineBootstrap in src/docker-phone-migration-runner.ts is an extension
of the existing guarded Harness, not a parallel migration framework or generic CLI.
It accepts only a separately owner-reviewed phone-baseline-six-only/BASELINE receipt,
with the unchanged PhoneTarget identity/name contract and an independently reviewed
resulting catalog SHA-256. It reuses the guarded datasource, explicitly lists only
migrations 1–6, validates identity/empty catalog, creates genuine migration history,
runs those six in one transaction and validates exact resulting history/catalog.
It never calls the seventh migration or generic runMigrations/down.

CURRENTLY BLOCKED BEFORE CONNECTION: PHONE_APPLY_CONCURRENCY_VERIFIED is still false.
The bootstrap also respects that existing gate; neither a receipt nor an env value
can enable it. Its dormant SQL/application tail has NOT been integration-validated.
Permission for source preparation does not authorize applying a baseline. A separately
reviewed concurrency/exclusivity protocol and isolated integration tests are required
before any future source change can open that gate. No CLI/automatic startup hook is
installed. The original runPhoneMigration preflight/apply contract is unchanged.

The bootstrap target remains cashback_phone_migration_check_<30 lowercase hex>;
Compose/Mailpit/readiness still require cashback_docker_test. Therefore there is
currently NO approved end-to-end same-database execution path. Do not rename the DB,
relax guards, fake history, replay the seventh with TypeORM CLI, use synchronize,
manual phone DDL or dump/restore as a shortcut.

Target-resolution proposal for separate design approval: prove the six-baseline and
seventh Harness execution on its approved synthetic-only target, then independently
review whether a schema-only promotion to the new Mailpit database can preserve
provenance, exact constraints/history, ownership and effective privileges with no
users/passwords/tokens. No promotion implementation or permission is supplied.
If that cannot meet existing protective contracts, leave E2E blocked and request
explicit contract-design approval. A matching database name alone is not identity proof.

## Before the first new PostgreSQL launch

1. Separately authorize read-only Docker inventory and image verification. Confirm
   daemon/context, full stopped/running container/network/volume inventory and absence
   of the reserved cashback-registration-20261016-4f8c2a96b17d resources. Do not touch
   cashback-finance-security-9f-pg-1 or adopt/remove any existing resources.
2. Review a postgres:17-bookworm digest/platform; create three fresh independent
   synthetic secrets outside Git/build context only with separate authorization.
3. Implement/review the trusted resource-admission collector/adapter; it is still absent.
   Use the existing admitRegistrationResources pure gate, fresh <=30s evidence and
   exact normalized config. No caller-generated verified=true receipts.
4. Obtain explicit creation/start permission for only the new PostgreSQL project,
   private network and volume. Single Compose file, no overrides/profiles, only
   postgres-test. Stop on any collision or failed admission, never reuse resources.
5. Separately authorize read-only identity/catalog inspection of the new cluster.
   Creation grants no schema writes. Keep bootstrap/phone apply/backend/Mailpit/E2E
   blocked until their independent approvals and the open design issues are resolved.
