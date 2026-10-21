# Isolated UQ_users_email integration stand — historical run passed

This stand does not use AppModule, root .env, DATABASE_URL or production DB_*.
It must run in the existing Docker database network where postgres-test resolves.
No integration is launched by importing the DataSource or running normal Jest
unit tests. `run.integration.ts` is an explicit CLI with CB_EMAIL_IT_RUN=yes gate.

## Historical verification — 2026-10-13

One explicitly approved run completed successfully against a newly created,
isolated PostgreSQL 17.11 database. The runner exited with code 0 and checked:

- All six explicit migrations applied in order using transaction mode all.
- PostgreSQL enforced the named UQ_users_email UNIQUE(email) constraint.
- A repository duplicate failed with driverError.code=23505 and
  driverError.constraint=UQ_users_email.
- Two concurrent HTTP registrations returned 201 and 409; exactly one users row,
  one mock email invocation and one mock JWT-sign invocation were produced.
  The other nine application tables remained empty.
- The sixth migration's down() and repeated up() completed successfully.
- After another down(), synthetic duplicate rows caused the expected migration
  refusal (23505). The failed reapplication rolled back: two synthetic users and
  five migration-history entries remained, with UQ_users_email absent.

The existing integration database was retained, not automatically cleaned or
removed. This final negative-test state is intentional; do not assume that it
currently has UQ_users_email or a six-entry migration history. This audit does
not re-inspect that database. Historical success does not authorize another run.
The protected cashback_docker_test database was unchanged by this integration
run; its later separately approved sixth migration is a different operation.

## Repeat execution — separate approval and a fresh target

Do not rerun this CLI against the retained, nonempty integration database. Its
initial emptiness gate must reject that target. A future full rerun requires
separate approval, a newly created disposable database, and a new creation
receipt. Do not clear, recreate or repair the existing database to bypass the gate.
Approval must also cover creation of the new database and the transient runner.
Before executing, independently verify the actual container, volume, database
name/OID, role, IP, cluster ID, PostgreSQL version and empty application schema.
The receipt and environment variables are operator-supplied inputs; the runner
checks their correspondence to PostgreSQL, but does not prove creation provenance
by itself. Never substitute cashback_docker_test, a production database or another
existing database, and never weaken the name/OID/identity/emptiness checks.

## Procedure for a separately approved new run

1. Read-only verify the existing postgres-test container ID
   02cabe6180fc651b16c87afc8dbd29b7209157d71d89545e51f6005c1f01aed4,
   project cashback-docker-test, healthy status, database network and volume
   cashback-docker-test_postgres-test-data. Other application services stay stopped.
2. Generate 15 cryptographically random bytes as 30 lowercase hex characters.
   Use only `cashback_email_unique_it_<30 hex>` (55 ASCII bytes, below PG limit).
   Check SHOW max_identifier_length and exact database-name absence before creation.
   Never reuse a pre-existing database, even if its name matches this prefix.
3. Using a separately approved maintenance connection to this same container,
   create that one database with TEMPLATE template0 and OWNER cashback_test.
   Do not alter cashback_docker_test or any existing disposable database.
   Read back the exact name and OID. Retain a nonsecret creation receipt binding
   container ID, cluster system ID, generated name, database OID and creation time.
4. Prepare a separate temporary runner in work/ with backend locked dependencies
   and TypeScript 5.9.3. A transient runner container attached ONLY to the existing
   database network, with no published ports, requires explicit approval. It must
   never start NestJS AppModule/backend, frontend or bonus-api. The Nest testing
   application contains only AuthController and mocked external providers.
5. Supply only these explicit variables (no automatic dotenv):
   CB_EMAIL_IT_RUN=yes; CB_EMAIL_IT_HOST=postgres-test;
   CB_EMAIL_IT_DATABASE=the newly created name;
   CB_EMAIL_IT_DATABASE_OID=the OID from that creation receipt;
   CB_DOCKER_DB_PASSWORD=in-memory value from docker/compose.test.env.
   Never print the credential, JWT, password hashes or verification tokens.
6. From the project snapshot in the isolated runner, explicitly invoke
   `node node_modules/ts-node/dist/bin.js --project test/email-unique/tsconfig.json test/email-unique/run.integration.ts`.
   The file is NOT a normal Jest integration spec; the regular unit suite cannot
   start it. Run only after the created-database receipt has been independently
   verified. No database provisioning occurs in this CLI.

## Checks

- Before writes: actual database/OID/role/IP/port/cluster/version and READ ONLY
  session check, then empty application schemas/relations/functions/types.
- Six explicit migrations with transaction all, ordered names/history and exact
  UQ_users_email UNIQUE(email) catalog definition.
- Two actual HTTP registration requests with synchronized successful pre-lookups:
  real AuthService, UsersService, bcrypt and PostgreSQL; statuses 201 and 409,
  exactly one users row, one mock email invocation, one mock JWT-sign invocation.
- The losing request has only the fixed conflict response. Other nine application
  tables remain empty. Raw repository duplicate gives driverError.code=23505 and
  driverError.constraint=UQ_users_email without exposing its detail.
- TypeORM down/repeated up for the sixth migration only, then duplicate fixture
  after down. Reapplying the sixth migration must fail/rollback, preserve two
  synthetic rows and five history entries, with the constraint absent.

The final database deliberately retains the duplicate-fixture failure state for
inspection. There is NO automatic deletion, repair, retry or migration to another
database on errors. Synthetic credentials are fixture-only.

SMTP delivery, real JWT signatures, frontend, external integrations and production
worker behavior are not tested. Mock counters check server call-side effects, not
actual delivery. Existing JWT unit tests remain responsible for signer/verifier.

## Future cleanup — separate explicit permission

After reporting results, get approval for deletion of the exact generated name
and OID. Verify the creation receipt and server/container identity again. Stop only
the disposable runner, close its connections, and verify no unexpected connections
to the disposable database. If there are any, stop; do not force-terminate them.
Drop only the exact approved disposable database (no FORCE), then verify its name
is absent. Never delete Docker volumes, postgres-test, cashback_docker_test, other
databases or backup VHDX. Do not perform cleanup as part of the test CLI.

## Static validation (does not connect)

- `node node_modules/typescript/bin/tsc -p test/email-unique/tsconfig.json`
- `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath test/email-unique/config.spec.ts`
- Existing backend typecheck/build/unit suite in an isolated validation snapshot.

This stand uses only its own explicit six-migration DataSource. Do not change
AppModule or other migration DataSources to execute it, and do not weaken their
guards. The main-test preflight expects the state BEFORE the sixth migration;
it is not a repeat-run path for an already-upgraded cashback_docker_test database.
