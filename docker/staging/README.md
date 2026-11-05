# R06 security preparation

The R06 SECURITY.md contract supersedes earlier HTTP/ingress/pin instructions below. SQL baseline is prepared in sql/, not applied. No runtime readiness or launch authorization.

# B02: isolated staging packaging (NOT deployment authorization)

Standalone file: docker/compose.staging.yaml. Do not combine with compose.yaml or historical overrides.
No existing Docker resources are reused. Project cashback-staging-b02 owns its two named volumes and three internal networks.
Only frontend is bound to host loopback 127.0.0.1:33004. PostgreSQL/backend/SMTP have no host bindings.
Mail UI binds only its container loopback, no host port; future UI inspection requires a separately reviewed access procedure.
No bonus-api service. No application source mounts, Docker socket, external resources or host networking.

## Provisioning inputs (not supplied; fail closed)

Provide an ACL-protected directory OUTSIDE the repository/build context via STAGING_SECRET_DIR.
Files: pg_owner_password, db_password, jwt_secret, smtp_password, pg_cert, pg_key, mail_cert, mail_key, mail_auth, staging_ca.
No credentials or certificates have been created by this task. Use distinct owner/runtime/SMTP secrets and a JWT secret of at least 32 characters.
Files must be readable by the intended container UID, not by unrelated host users. Compose local file secrets are file mounts, not an encrypted secret manager.
Do not place secrets in .env, image args, command arguments, Git or logs. Do not use shell tracing.
mail_auth uses Mailpit's password-file format and user cashback_staging_mail, corresponding to smtp_password. No accept-any/insecure authentication.
Only recipients matching synthetic @example.invalid addresses are accepted. No relay/forward config. All sink networks are internal; no internet egress is supplied.
SMTP uses mandatory STARTTLS on 587; per-container unprivileged-port sysctl allows its non-root UID to bind 587 without capabilities.
Mail data is temporary, in /tmp; restart discards synthetic messages.

Supply reviewed immutable image references, including tag AND @sha256 digest:
- STAGING_NODE_IMAGE: node:24-...@sha256:... (bookworm-slim required by runtime packaging)
- STAGING_POSTGRES_IMAGE: postgres:17...@sha256:... (bookworm)
- STAGING_NGINX_IMAGE: nginx:<version>-alpine@sha256:...
- STAGING_MAILPIT_IMAGE: axllent/mailpit:v1.32.0@sha256:...
No invented image digests in deployment files. The static tests use fake references ONLY as syntax fixtures.
Before any separately authorized build/start, run node docker/staging/validate.cjs with those environment values.
The validator pins image references syntactically; provenance, vulnerability review, platform and actual digests still require rehearsal approval.

Supply STAGING_FRONTEND_ORIGIN as a canonical approved HTTPS origin, identical for frontend and verification.
Supply STAGING_DB_SYSTEM_IDENTIFIER only AFTER independent DBA verification of the NEW synthetic cluster. Never derive/accept it automatically at backend startup.
Missing/incorrect identity, TLS, schema or secret means backend must fail. B01 is unchanged.

## TLS

CA bundle staging_ca must trust ONLY the approved isolated PostgreSQL and SMTP certificates. Backend uses NODE_EXTRA_CA_CERTS and B01 rejectUnauthorized=true.
Certificate SANs must include postgres and mail respectively; verify their validity/chain/hostname in rehearsal. Do not use auto-generated rotating sink certificates.
Postgres entrypoint copies its mounted key into root-created tmpfs, chowns postgres and chmods 0600 before official entrypoint drops privileges.
pg_hba.conf rejects every non-TLS TCP connection and every TCP role except the explicit runtime role in cashback_staging_app.
The PG owner is reachable only by local Unix socket inside its container. No historical database or dump is used.
Node/backend/frontend/mail are non-root. PostgreSQL official bootstrap runs root for volume/key ownership then drops to postgres; this exception is intentional.

## Separate schema provisioning procedure — NEVER automatic

No SQL is mounted under docker-entrypoint-initdb.d. No synchronize, financial migrations, UUID-enrollment or grants execute at backend startup.
Fresh PostgreSQL is therefore NOT an immediately usable application DB. Backend fails until reviewed application schema and runtime role exist.
For a future separately approved isolated rehearsal:
1. Verify project labels, fresh volume, private networks, absence of live attachments and approved synthetic-only inputs. Record cluster identifier independently.
2. Start ONLY the isolated PostgreSQL after permission; attest identity/version17/owner and zero application rows. Do not start backend yet.
3. Prepare a REVIEWED schema-only application baseline using existing application entities and existing nonfinancial DDL below, with staging identity guards and no historical data.
4. Existing docker/historical/schema.sql and extended-registration/marketing scripts contain explicit historical DB/role/cluster guards: DO NOT run or blindly replace names in these scripts. They are reference DDL, not a staging installer.
5. Required schema coverage: users (extended identity and email verification), marketing_preferences, forum_users/forum_topics/forum_posts/topic/post/analytics_events, and the activity schema/policies version1 from docker/historical/migrations/20261026-activity-limits.sql. Review any forum read paths for additional moderation dependencies. No real user fixtures.
6. Create cashback_staging_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT. It must not own tables/schema, inherit owner roles or have CREATE on public/database. Revoke PUBLIC database/schema/table/sequence privileges.
7. Grant only explicit per-table/per-column application privileges after inventory. Use the existing activity-limits-grants.sql as reference for activity DML; no financial schema/table/sequence grants. Do not grant ALL TABLES or default broad future privileges.
8. B01 identity SQL needs EXECUTE on pg_catalog.pg_control_system() for this runtime role. Grant only that function locally after confirming PostgreSQL17 permissions; never grant pg_monitor/superuser as a shortcut. Confirm there are no extra inherited privileges.
9. Independently approve cluster pin; verify backend TLS and identity with correct/wrong CA, SAN, cluster, DB and user. Expected wrong cases must fail before feature modules initialize.
10. Create only explicitly approved synthetic users (@example.invalid), then nonfinancial auth/forum/activity fixtures. Do not migrate or reconstruct financial balances. Do not copy production/historical records.

The final executable schema baseline and exact grants inventory are still a prerequisite for a runnable rehearsal, not silently implemented by this packaging.
If any prerequisite fails, stop without escalating runtime privileges or weakening B01.

## Frontend contract

The build stage derives a TS4.9-compatible tsconfig by removing only the root TS6 ignoreDeprecations option inside the image; the working/local config is unchanged. It runs the frontend lockfile compiler before CRA.
Dockerfile builds CRA production assets and copies only static files into nginx runtime (no Node/npm/dev dependencies).
REACT_APP_STAGING=true requires API_BASE=/api. Legacy catalog clients preserve local URLs outside staging, and use /api in staging.
nginx strips exactly the leading /api/: browser /api/auth -> backend /auth; browser /api/api/bonus -> backend /api/bonus.
No setupProxy.js runtime. SPA deep links fall back to index.html; /static missing files fail404.
Historical local mailbox and bonus snapshot exceptions are disabled. Registration remains isolated; local demo review bypass is false.
Build gate rejects local operational http URLs and source maps. Production bundle has NOT yet been built/validated in this task.
robots.txt disallows all and X-Robots-Tag is emitted. These are not access control or proof of B03.
No public TLS/ingress/tester authentication is implemented here; external staging remains NO-GO.

## Safe negative rehearsal matrix (future permission only)

Use only owned isolated server + synthetic DB; prove container labels/identity and baseline table counts before requests.
Run src/financial-write-deny.spec.ts unmocked against packaged source before image approval: 68 service commands, admin/user/anonymous, demo/env/prefix variations.
Then from the isolated backend network test POST /api/bonus/transfer and /api/bonus/spend-on-purchase with synthetic admin/user JWT and no JWT: expect FINANCIAL_WRITES_DISABLED403, no changed financial/user balances/events.
Legacy /balance/:id, /bonus-transfer, /withdrawal/:id, /withdrawal/approve/:id, /withdrawal/reject/:id must remain unregistered404 (or403 if deliberately mounted for a separate harness), never2xx. Do not register them for staging.
Repeat through frontend transport prefix; do not infer backend protection solely from ingress status.
Confirm FinanceModule/FinanceReadModule absent and /api/v1/my/bonus-data remains404. JWT/demo/admin/enable flags must never activate writers (unsafe flags are also rejected by B01).
Exercise backend missing secrets, wrong pin, absent runtime role/schema, TLS errors; all must refuse health/readiness.
No financial writes may be sent to ports3004/3005/3006 or the historical DB.

## Future gates

B03: real HTTPS, tester authentication, ingress/firewall, security headers and external noindex verification.
B05: approved nonfinancial registration/mail test flow without local demo bypass; this packaging does not claim that flow works.
B06: real browser+proxy+isolatedDB E2E, RU/EN/DE/FR, responsive matrix and auth/session ownership.
Runtime health probes are liveness gates, NOT proof of functional correctness or financial safety.
Stop after validation. No deployment, migration, UUID-enrollment, signing, financial activation or Git publication is authorized.
