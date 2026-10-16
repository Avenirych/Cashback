# Cashback+ Docker: isolated local test environment

This is a local test environment, not a production deployment. Status below
records approved checks completed on 2026-10-13. It is not a live health report:
Docker and PostgreSQL were not queried while updating this documentation.

## Verified history and last reported state

- Compose project: `cashback-docker-test`; PostgreSQL service: `postgres-test`.
- PostgreSQL 17.11; database `cashback_docker_test`, role `cashback_test`, OID 16384.
- Volume: `cashback-docker-test_postgres-test-data`; cluster ID: 7695793866029359141.
- Six migrations applied; `UQ_users_email` and its valid/ready UNIQUE index confirmed.
- The ten application tables contain no synthetic records after approved cleanup.
  The `migrations` table retains six history entries. User sequence advancement
  was preserved; a nonzero sequence value does not imply existing users.
- Backend image was built, verified and deployed to the test environment.
  Registration HTTP checks returned 400, 201, 409, 409; the synthetic user and
  its Mailpit message were subsequently removed. Mailpit was empty after cleanup.
- Last reported: backend and PostgreSQL healthy, Mailpit healthy, UI proxy running,
  frontend stopped. Bonus API was not started. Recheck full IDs before any action.
- Frontend Jest: 228/228 tests, 8/8 suites. TypeScript 4.9.5 noEmit passed.
  A separate frontend production build passed with warnings, using a new
  `BUILD_PATH` inside `work/`; the existing frontend `build/` was preserved.
  This did not build or deploy a production-serving frontend Docker image.

Migration history and identity safeguards are documented in
[MIGRATION-TEST-PLAN.md](MIGRATION-TEST-PLAN.md) and the historical
[UQ-USERS-EMAIL-MANUAL.md](UQ-USERS-EMAIL-MANUAL.md).

## Base Compose and optional Mailpit configuration

`compose.yaml` defines four services: PostgreSQL, backend, frontend and bonus-api.
Application services use the `application` profile. Without it, the default
service is PostgreSQL; explicitly selecting a service can activate it without
its profile. This behavior is not permission to run `compose up`.

`docker/compose.mailpit.override.yaml` adds Mailpit and `mailpit-ui` (nginx proxy)
and connects backend to the internal `mail-test` network. The combined definition
has six services; the approved test setup used five original containers without
bonus-api. Transient CLI runners are separate and must be identified by full ID,
not just Compose labels.

Base backend SMTP_HOST is empty and USE_ETHEREAL is false. The override uses
`mailpit:1025`, without SMTP credentials, and restricts recipients to `example.test`.
Mailpit has no host SMTP port and stores messages in tmpfs, not a durable backup.
Only its UI proxy connects to `mail-ui`; the proxy publishes loopback port 8025,
runs as user 101 with a read-only root filesystem, and mounts
`docker/mailpit-ui.nginx.conf` read-only with `create_host_path: false`.

## Local demo production boundary

`docker/compose.mailpit.override.yaml` is for local demonstration only and MUST
NOT be included in production deployment. It explicitly enables LOCAL_DEMO_MAILPIT
and the local scenario marker. Neither NODE_ENV=development nor that marker proves
that the host or PostgreSQL database is a test environment. Before any launch,
independently confirm the environment and PostgreSQL destination/identity using
the existing approval safeguards below. Do not use production databases.

Mailpit captures synthetic example.test messages locally. Completing this demo
does not establish ownership of a real email address. Do not expose verification
tokens or links through the public API or diagnostics. This warning grants no
execution, database-write or deployment permission.

## Images, storage and connections

Dependencies are installed by locked `npm ci` inside images. Normal application
Compose does not bind-mount local source or node_modules. The base file declares
three project-scoped named volumes: PostgreSQL data, SQLite bonus data and avatars.
The Mailpit override adds the read-only configuration bind mount described above.
Do not assume every declared volume exists or contains data without inspection.

- Backend Dockerfile builds NestJS, then runs compiled code via `start:prod`.
  Compose overrides NODE_ENV to development; that does not enable migrations.
- Frontend Dockerfile uses TypeScript 4.9.5/react-scripts 5.0.1 and `npm start`.
  It is a development server, not production-serving. `prestart` regenerates the
  index; local `npm run build` separately runs `prebuild` and produces static assets.
- Bonus API uses Node 24/node:sqlite. Its SQLite store and main PostgreSQL backend
  are separate; do not infer shared balances or migrations between them.
- `.dockerignore` excludes local dependencies, environment files, databases,
  uploaded avatars, logs, backups and source control from build contexts.

| Connection | Address |
| --- | --- |
| Browser to frontend, when started | http://127.0.0.1:3000 |
| Browser to backend | http://127.0.0.1:3001 |
| Browser to bonus-api, when started | http://127.0.0.1:3002 |
| Browser to Mailpit UI proxy | http://127.0.0.1:8025 |
| Backend to PostgreSQL | postgres-test:5432 |
| Backend to Mailpit with override | mailpit:1025 |

Application ports bind only to loopback. PostgreSQL has no published host port;
its database network is internal. Backend also joins the application network.
Both DB_* and DATABASE_URL in base Compose select `cashback_docker_test`;
the local Mailpit override clears DATABASE_URL and validates the explicit DB_* destination.
AppModule and DataSource explicitly set `synchronize=false` and `migrationsRun=false`;
Compose retains `DB_MIGRATIONS_RUN=false`. Starting the app must not apply migrations.
Backend health checks an unauthenticated 401, not database schema integrity.
PostgreSQL readiness likewise does not prove full data integrity.

## Existing environment versus initial bootstrap

Preserve existing containers, volume identities, private credentials and backups.
Do not generate replacement credentials for an existing PostgreSQL volume:
initialization variables do not rotate its stored role password. Use the existing
private dedicated Docker env file; never publish it or substitute root `.env`.
Shell CB_DOCKER_* variables can override the dedicated env file and require review.

Initial preparation used a separate credential template and isolated bootstrap
process. Those steps are historical, not instructions to repeat against the
existing volume. A new environment needs a separately approved identity, storage,
credential, migration and backup plan. The general AppModule/CLI migration subsets
are not the complete fresh-database bootstrap list.

No unconditional build/up/stop/recreate commands are supplied here. Before any
future operation, obtain scope-specific approval and verify full container IDs,
project, volumes, database name/OID, role, IP, cluster ID, schema/history and backup.
Never use `down -v`, prune, factory reset or delete volumes to repair this setup.
Never remove or overwrite existing backups. Do not restart or recreate additional
services as a side effect of a backend-only operation.

## Backup and production readiness limits

The verified VHDX backup is retained at
`C:\Users\serge\Backups\Cashback-Docker20261013-115332-2d77bf55`.
It was copied while Docker Desktop was stopped and verified by size/SHA-256.
It predates later database operations; it is not a current logical database backup.
No PostgreSQL logical restore or recovery from this VHDX has been demonstrated.
Never replace live Docker disks or automatically restore PostgreSQL from it.

Production-serving frontend, production secrets/network/TLS, logical backup and
restore testing require separate review. Build warnings remain in Register.tsx,
emailValidator.ts and a Node fs.F_OK deprecation; this documentation does not fix
or suppress them. Mutable base image tags and PostgreSQL/SQLite separation remain
review items. The successful checks above do not certify production readiness.
