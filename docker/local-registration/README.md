# Isolated registration environment — stage A only

Status: CONFIGURATION PREPARED; RUNTIME AND SCHEMA BLOCKED. No resources have been
created, no database has been contacted and no schema is installed by these files.
The standalone Compose document uses JSON, which is valid Compose YAML syntax.
Do not combine it with compose.yaml or existing overrides. Do not launch it yet.

## Proposed resource inventory

Project: `cashback-registration-20261016-4f8c2a96b17d`.
Volume: `cashback-registration-20261016-4f8c2a96b17d-pg17-data`.
Networks use the same project prefix with `-database`, `-application`, `-mail`,
and `-mail-ui`. The first three are internal; only the fixed-upstream UI proxy
joins the bridge network. No shared/external network, external volume, host network,
container_name, Docker socket, data bind mount, or existing cluster is referenced.

Proposed containers: postgres-test (PostgreSQL 17), backend, frontend, mailpit,
mailpit-ui. Only PostgreSQL is outside the explicit
`registration-after-schema-approval` profile. Profiles are grouping, NOT approval
enforcement. Even starting PostgreSQL alone requires separate authorization.
There is no bonus-api/SQLite, finance service, supervisor, SMS transport or Google
OAuth service. Frontend explicitly disables Google OAuth; its unavailable button
retains existing fail-closed behavior. Bonus API is not supplied. REACT_APP_REGISTRATION_ISOLATED=true blocks both bonus
clients before fetch; the provider does not start auto-refresh, focus/visibility
refresh or timers. Manual bonus requests are refused; no financial data is invented.

Future published ports are only 127.0.0.1:3000 (frontend), :3001 (backend), :8025
(Mailpit UI). PostgreSQL 5432 and SMTP 1025 are internal only. No process may be
stopped to claim these ports without approval. Canonical browser origin is
http://localhost:3000, as required by the existing Mailpit guard.

Mailpit messages and avatars use bounded tmpfs, not existing files or volumes.
Frontend uses the repository's existing Dockerfile and may write its own container
cache. Backend is read-only except bounded tmpfs. Neither backend nor Mailpit has
an external-routed network. Existing .dockerignore excludes dotenv, databases,
backups and work directories; no env_file is embedded in Compose.

## Freshness and credentials are mandatory runtime admission checks

Unique-looking names do not prove freshness. Before any future create/start,
obtain permission for read-only Docker inventory and verify that the project,
volume, networks and proposed containers do not already exist. Refuse reuse on
any collision; prepare and review a new suffix rather than delete or adopt them.
Do not use -p/COMPOSE_PROJECT_NAME to share an existing project. Explicit volume
and network names must also match this inventory. No such inventory was run in A.

The example is intentionally empty. All four REGISTRATION_* values are required
by Compose interpolation; missing values cause refusal. Provision fresh independent
bootstrap/app/JWT secrets outside source control, not production credentials.
Before use reject placeholder, equal or weak secrets. Pin a reviewed PostgreSQL
17 image digest; the PG image field has no fallback. Image-version/digest checks,
secret quality, resource freshness and effective Compose rendering remain explicit
future admission checks, not claims made by the current configuration.

POSTGRES_USER=registration_bootstrap initializes only a new empty cluster and
cashback_docker_test database. The application uses a DISTINCT cashback_test role
with its own password. That role is intentionally not auto-created. It must later
be separately authorized with least privileges on the approved completed schema;
do not run the app as the bootstrap superuser. pg_isready only checks server
readiness, not role identity, credentials or schema readiness.

## Mailpit guard compatibility

The unchanged validateLocalDemoMailpit function is exercised directly by static
tests with this backend environment. It requires development mode, exact scenario
cashback-local-mailpit-registration, postgres-test:5432, cashback_docker_test,
mailpit:1025, no SMTP credentials, no DATABASE_URL, USE_ETHEREAL=false,
SMTP_SECURE=false and FRONTEND_URL=http://localhost:3000. These values match.
The database NAME is the same as the older test environment solely to satisfy
the guard; the proposed cluster/volume/networks are separate. The hostname is a
service alias scoped to the new network, not the existing container's hostname.
Only synthetic example.test recipients are accepted, both by app policy and
Mailpit. Tests do not send mail. Runtime network and recipient behavior is unproven.

## Full schema preparation plan — blocked, not an executable runner

1. After separate provisioning permission, establish the exact new PostgreSQL 17
   cluster identity and prove it is empty, synthetic-only and isolated. Approve
   independent baseline/catalog inventories and an exact target before SQL writes.
2. Review a dedicated bootstrap for an empty database, in this exact order:
   InitialApplicationTables1733927999000,
   AddMarketingPreferences1733928000000,
   AddEmailVerification1735000000000,
   AddForumUsers1791394800000,
   CreateBonusTables1791630000000,
   AddUsersEmailUnique1791888000000. Migration history must accurately describe
   executed migrations; do not fake rows. The baseline owns eleven tables including
   history. Existing default migration lists omit parts of this fresh bootstrap;
   they must not be used as a complete bootstrap command. No bootstrap implementation,
   SQL file, initdb mount or migration command is supplied here.
3. The seventh migration is AddUserPhoneAndSmsConsent1792195200000. It adds nullable
   users.phone_e164, phone_verified=false, nullable phone_verified_at, E.164 and
   verification-consistency constraints; marketing_preferences gets smsMarketing=false,
   smsMarketingGrantedAt, smsMarketingRevokedAt, smsMarketingConsentVersion and its
   consent-consistency constraint. Legacy NULL phones remain permitted in storage;
   new registration still requires a valid phone. This does not enable SMS sending.
4. STOP before seventh migration: the existing Phone Migration Harness only admits
   cashback_phone_migration_check_<30 lowercase hex> targets. Mailpit guard only
   admits cashback_docker_test. They cannot operate on the same named database
   under the unchanged contracts. B/C are NOT GRANTED and
   PHONE_APPLY_CONCURRENCY_VERIFIED=false independently blocks apply. Approval alone
   cannot turn that flag on. Do not use generic TypeORM CLI, schema sync, init SQL,
   manual DDL, a full-schema dump or an alternate bootstrap to evade this gate.
5. Before a full registration test, obtain a separately reviewed resolution of
   this target mismatch and concurrency block. A possible future design is an
   authorized harness validation on its own synthetic target followed by a separately
   approved, independently verified schema-only promotion into the new Mailpit DB.
   This is a proposal, NOT an approved alternative apply path: no dump/restore,
   rename, promotion scripts or permission are included. It requires explicit owner
   approval and review, including provenance, schema fingerprints, roles/ACLs and
   absence of copied users/tokens. If it cannot meet the harness requirements, remain
   BLOCKED rather than substitute a different application path.
6. Only after the method is approved and completed: verify all baseline objects,
   phone/SMS constraints, correct migration history and application role privileges.
   Keep synchronize=false/migrationsRun=false. Backend startup is not schema proof.

## Later independent permissions

Separate authorization is needed for Docker inventory/image inspection, image
pull/build and NEW resource creation; read-only identity/schema connections to the
exact new cluster (including any harness B receipt); baseline schema/role writes;
any harness C operation (still subject to the unchanged concurrency gate); any
schema promotion or target-contract resolution; and starting backend/frontend/
Mailpit plus a synthetic end-to-end registration test. Cleanup/destruction is not
authorized by any of these permissions. Existing volumes/accounts remain untouched.

The future browser test must use a fresh synthetic example.test identity and valid
test phone: register, confirm pending status/access denial, inspect captured email,
follow verification, logout/login, inspect the owner's phone. Confirm no SMS/Google
operation and no verification token or private values in diagnostics. Full readiness
requires real integration evidence, not just this configuration or mocked tests.

## Stage A static validation

The config/admission unit tests operate only on in-memory inputs and local sources.
It parses JSON and YAML in memory, checks resource isolation, profile separation,
loopback publication, no migration hooks, source guards and the actual Mailpit
policy. It imports no datasource/AppModule and does not inspect dotenv or contact
Docker, PostgreSQL, SQLite or SMTP. Docker Compose's own schema/runtime validation
has NOT been performed. No start command is provided while admission remains blocked.

Original stage A results: 22 config tests PASS; standalone no-emit TypeScript check PASS;
JSON/YAML parsing PASS; git diff whitespace check PASS. Safe static rerun from root:

```powershell
node node_modules/jest/bin/jest.js --runInBand --no-cache --roots docker/local-registration --runTestsByPath docker/local-registration/config.spec.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false --skipLibCheck --module NodeNext --moduleResolution NodeNext --target ES2023 --esModuleInterop --types node,jest docker/local-registration/config.spec.ts
```


## Source-only admission and readiness additions

`admission.ts` is a pure decision function, not a Docker command or approval grant.
It locks the exact reviewed template by canonical SHA-256 and requires exact project,
single config path, no overrides/profiles, and postgres-test as the only requested
service. It permits EMPTY RESOURCE CREATION ONLY; never app startup or SQL writes.
It requires fresh complete container/network/volume inventory (including stopped
containers), exact reviewed daemon/context, no reserved-name or project-label
collisions, and fresh verified image reference/major/platform matching an independently
reviewed PostgreSQL 17 digest. Four dedicated environment keys only; distinct secret
values have basic rejection checks. Secret strength/provenance still require review.

A later trusted read-only adapter must collect evidence and normalize the effective
Compose configuration into the exact template representation before comparison.
Unknown state fails closed. No such adapter/CLI is installed, and no Docker inventory,
registry inspection, digest verification or resource creation was performed. Supplying
caller-written JSON with verified=true is NOT proof or permission. Unit fixtures are
synthetic and their digest/credentials must NEVER be used for a real launch.
Any template change requires independent review and an explicit TEMPLATE_SHA256 update;
a failed comparison must not be resolved by accepting an observed config blindly.

Backend REGISTRATION_ISOLATED=true activates RegistrationReadiness before any register
validation, account lookup/write, password hashing or mail. The unchanged default path
outside isolated mode is preserved. Unknown isolated flag values refuse registration.
The composed backend has no trusted probe or policy provider, so registration returns
503. There is no env READY flag and no cached startup approval.

The pure readiness evaluator requires a fresh exact cluster/database OID/version,
complete seven-row history, independently reviewed full schema fingerprint (including
phone/SMS definitions/constraints), exact effective privilege inventory, no elevated
role flags/memberships/object ownership, actual SMTP handshake evidence bound to the
reviewed peer, and current compatibility with the unchanged Mailpit guard. Unknown
or missing evidence refuses. A role's apparent grants alone are insufficient: the
future collector must include effective PUBLIC/inherited privileges, all relevant
objects, sequences, defaults and ownership. A schema hash observed on an unknown DB
is not its own approval. The privilege allowlist is deliberately limited to registration,
verification and owner profile/preferences; other application modules may remain unavailable.

No live probe is implemented or registered in this stage: it would need separately
approved database/SMTP access and review of exact read-only collection, timeouts,
identity binding and freshness. No schema, role or privilege is created/changed here.
Default denial is intentional, not proof that the environment is runtime-ready.

The Mailpit/Harness target-name mismatch, missing trusted invocation boundary for
Harness, absent independent baseline/promotion evidence and
PHONE_APPLY_CONCURRENCY_VERIFIED=false remain OPEN BLOCKERS. Neither admission PASS
nor readiness test fixtures authorize an alternative seventh-migration path.
The earlier schema-only promotion discussion is still only an unapproved proposal.


`SOURCE-ALLOWLIST.txt` lists the exact 33 currently prepared source/config/test/doc
paths for a future separately authorized Git save, including earlier startup fixes.
It excludes the pre-existing root package-lock.json reorder and all unrelated finance,
work, bin/obj and runtime artifacts. This list is NOT staging/commit authorization.
The current source-only follow-up changes 15 paths (including this README/config,
existing config test and allowlist); the broader list includes earlier prepared work.


Source-only follow-up validation: 82 config/admission/readiness tests, 45 existing
auth regression tests and 28 selected frontend tests passed across focused runs.
Backend and frontend no-emit TypeScript passed. Readiness has a three-second deadline
and provides AbortSignal cancellation to the future trusted collector, with generic
503 refusal on errors. No live collector, registry verification or runtime was used.
