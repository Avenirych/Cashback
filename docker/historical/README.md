# Historical local start — PREPARED, NOT ACTIVATED

Base commit: 03573b7f47ba3c04dc50312bc71e0a7b904c0ce7. Work only in this historical worktree. Original registration (single name), email verification, JWT expiry and forum logic/UI are unchanged. Marketing preferences are absent at this commit.

## Resources and configuration
Project: cashback-historical-03573b7-local. Four new services: historical-postgres, historical-mailpit, backend, frontend. No existing containers or external/shared volumes are referenced.
- Frontend http://localhost:3004, published 127.0.0.1:3004 -> 3000.
- API http://127.0.0.1:3006, published 127.0.0.1:3006 -> 3006.
- Mailpit http://127.0.0.1:8036, published 127.0.0.1:8036 -> 8025; SMTP 1025 only inside the project.
- PostgreSQL 17 has NO published port. Database cashback_historical_03573b7; owner cashback_hist_owner; app role cashback_hist_runtime.
- Dedicated new volume cashback-historical-03573b7-local-pgdata.
- New networks cashback-historical-03573b7-local-database (internal: PostgreSQL/backend only) and cashback-historical-03573b7-local-application (frontend/backend/Mailpit). The latter is an ordinary bridge, not firewall-enforced egress isolation. No protected network, host directory or Docker socket is mounted.

Backend: explicit env only, ignoreEnvFile=true, synchronize=false, migrationsRun=false, installExtensions=false, no startup retries, pool max 3. Required isolated DB identity and SMTP hostname are pinned; no default credentials. Container wildcard bind is permitted only inside the container opt-in; host publications are strictly loopback. JWT secret must be explicit (expiry and auth logic unchanged). CORS and FRONTEND_URL are http://localhost:3004; auth, profile and forum share REACT_APP_API_BASE. USE_ETHEREAL=false and SMTP points only to the new Mailpit.

.historical.env is ignored by Git and excluded from Docker context. Credentials have NOT been generated. Keep it private and use independent random values >=32 characters. Owner credentials are not passed to backend/frontend. Never print raw docker inspect/config or environment files.

## Required schema — NOT EXECUTED
Historical migrations AddEmailVerification1735000000000 and AddForumUsers1791394800000 are incomplete for a fresh database: they assume base tables previously created by synchronize.
schema.sql supplies an explicit final baseline for seven historical entities: users, forum_users, forum_topics, forum_posts, topic, post, analytics_events. Email and membership migration effects are included directly. This is NOT execution of those migration classes and does NOT fabricate TypeORM migration history. historical_schema_baseline records the exact commit.
SQL is one explicit transaction, rejects wrong DB/owner/PG major, nonempty public schema or existing runtime role. Runtime grants are bounded to named tables/sequences, with no DDL, ownership, superuser, role/database creation or replication. No data is imported from existing databases. Never run the general historical migration command later: email columns already exist. No automatic schema script is mounted into PostgreSQL initialization.

## Validation and limits
Read-only preflight passed: desktop-linux, daemon ec3d6303-4d66-4410-8317-b739cebc046c, exact protected inventory 12/10/4. Proposed ports were unoccupied at inspection time, not reserved. Pinned Node/PostgreSQL/Mailpit images are locally present linux/amd64. Compose source validation passed without secret interpolation.
Backend full TypeScript and emitted build PASS; frontend TypeScript and production build PASS (existing lint warnings). Node syntax and git diff --check PASS. Backend offline: 4 suites/27 tests; frontend mock: 3 suites/49 tests. The offline guard forbids child processes, TCP connections and listeners; Jest's feature probe is mocked. HTTP-listener integration suites are excluded, not deleted.
Backend root tsconfig now includes src/test only; frontend retains its own compiler config. This fixes accidental backend compilation of JSX without changing application logic.
Validation uses existing dependency junctions only. Installed backend versions differ from the historical declared/locked versions; clean npm ci and Docker image builds remain UNVERIFIED. Both lockfile root dependency maps match package.json. Do not silently substitute dependency versions if a future image build fails.
SQL runtime behavior, new-container effective bindings, real email/registration/forum remain UNVERIFIED until separately authorized activation. Existing databases were not connected to and are not approved for reuse.

## Future activation commands — REQUIRE SEPARATE OWNER AUTHORIZATION
Nothing below has been executed. Each nonzero exit is STOP; preserve resources, no automatic retry/cleanup.

~~~powershell
$ErrorActionPreference='Stop'
Set-Location -LiteralPath 'C:\Users\serge\AppData\Local\Temp\cashback-snapshot-backup-20261019-161438-f6ba9fdddf9a4c34b13b4a55bf2f9e15\historical-03573b7f47ba'
$d='C:\Users\serge\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$dc=@('--context','desktop-linux','compose','--env-file','.historical.env','--file','docker/historical/compose.json')
node docker/historical/preflight.cjs "$d"
if($LASTEXITCODE -ne 0){throw 'STOP: baseline/ports/images mismatch'}
if(Test-Path -LiteralPath '.historical.env'){throw 'STOP: review existing credential file, do not overwrite'}
Copy-Item -LiteralPath 'docker/historical/env.example' -Destination '.historical.env' -ErrorAction Stop
# OWNER: fill all three NEW private values, >=32 characters, without printing them.
& $d @dc config --quiet
if($LASTEXITCODE -ne 0){throw 'STOP: configuration invalid'}
# APPROVAL: two new images and their npm downloads, using local pinned Node base.
& $d @dc build --pull=false backend frontend
if($LASTEXITCODE -ne 0){throw 'STOP: build failed; no dependency substitution'}
node docker/historical/preflight.cjs "$d"
if($LASTEXITCODE -ne 0){throw 'STOP: environment changed'}
# APPROVAL: create new PostgreSQL/Mailpit, new volume and two networks only.
& $d @dc up -d --wait --wait-timeout 60 --no-build --pull never historical-postgres historical-mailpit
if($LASTEXITCODE -ne 0){throw 'STOP: preserve resources; no retry'}
$pgId=(& $d @dc ps -q historical-postgres).Trim()
$mpId=(& $d @dc ps -q historical-mailpit).Trim()
if($pgId -notmatch '^[a-f0-9]{64}$' -or $mpId -notmatch '^[a-f0-9]{64}$'){throw 'STOP: full IDs missing'}
$pg=(& $d --context desktop-linux inspect $pgId | ConvertFrom-Json)[0]
$mp=(& $d --context desktop-linux inspect $mpId | ConvertFrom-Json)[0]
# Do not output raw inspect: it contains credentials.
if($pg.Config.Labels.'com.docker.compose.project' -ne 'cashback-historical-03573b7-local' -or
   $pg.Config.Labels.'com.docker.compose.service' -ne 'historical-postgres' -or
   $mp.Config.Labels.'com.docker.compose.project' -ne 'cashback-historical-03573b7-local' -or
   $mp.Config.Labels.'com.docker.compose.service' -ne 'historical-mailpit' -or
   $pg.Config.Image -ne 'postgres:17-bookworm@sha256:66aafa11cf15800a3c94763f7e11d1e7b2e37e5e84bc4ce027cb6e1e4bfaf4df' -or
   $pg.Mounts.Count -ne 1 -or $pg.Mounts[0].Type -ne 'volume' -or
   $pg.Mounts[0].Name -ne 'cashback-historical-03573b7-local-pgdata' -or
   $pg.Mounts[0].Destination -ne '/var/lib/postgresql/data' -or
   $pg.HostConfig.PortBindings.PSObject.Properties.Count -gt 0 -or
   @($pg.NetworkSettings.Networks.PSObject.Properties.Name).Count -ne 1 -or
   $pg.NetworkSettings.Networks.PSObject.Properties.Name -ne 'cashback-historical-03573b7-local-database'){throw 'STOP: PostgreSQL boundary mismatch'}
$network=(& $d --context desktop-linux network inspect cashback-historical-03573b7-local-database | ConvertFrom-Json)[0]
$volume=(& $d --context desktop-linux volume inspect cashback-historical-03573b7-local-pgdata | ConvertFrom-Json)[0]
if($network.Internal -ne $true -or $network.Labels.'com.docker.compose.project' -ne 'cashback-historical-03573b7-local' -or
   @($network.Containers.PSObject.Properties.Name).Count -ne 1 -or $network.Containers.PSObject.Properties.Name -ne $pgId -or
   $volume.Labels.'com.docker.compose.project' -ne 'cashback-historical-03573b7-local' -or $volume.Driver -ne 'local'){throw 'STOP: new network/volume mismatch'}
# OWNER: record full pgId/mpId/network.Id; verify protected IDs still match protected-inventory.json.
# APPROVAL: initialize schema.sql ONLY in this verified NEW PostgreSQL.
$secure=Read-Host 'Same new runtime password as .historical.env' -AsSecureString
$env:HISTORICAL_RUNTIME_PASSWORD=[Net.NetworkCredential]::new('', $secure).Password
try {
 Get-Content -LiteralPath 'docker/historical/schema.sql' -Raw | & $d @dc exec -T -e HISTORICAL_RUNTIME_PASSWORD historical-postgres psql -X -v ON_ERROR_STOP=1 -U cashback_hist_owner -d cashback_historical_03573b7
 if($LASTEXITCODE -ne 0){throw 'STOP: SQL failed or unknown; never replay blindly'}
} finally {Remove-Item Env:HISTORICAL_RUNTIME_PASSWORD -ErrorAction SilentlyContinue}
& $d @dc exec -T historical-postgres psql -X -v ON_ERROR_STOP=1 -U cashback_hist_owner -d cashback_historical_03573b7 -c 'SELECT current_database(), (SELECT count(*) FROM users) AS users, (SELECT commit_sha FROM historical_schema_baseline) AS source_commit;'
if($LASTEXITCODE -ne 0){throw 'STOP: schema validation failed'}
# APPROVAL: start the NEW backend/frontend only.
& $d @dc up -d --no-build --pull never backend frontend
if($LASTEXITCODE -ne 0){throw 'STOP: preserve resources; no retry'}
& $d @dc ps --no-trunc
# Record new IDs, verify HostConfig AND actual NetworkSettings bindings are exact,
# never accept missing/null/empty bindings. Compare protected inventory again.
Invoke-WebRequest -Uri 'http://localhost:3004/register' -UseBasicParsing
Invoke-WebRequest -Uri 'http://127.0.0.1:3006/forum/rules' -UseBasicParsing
Invoke-WebRequest -Method Options -Uri 'http://127.0.0.1:3006/auth/register' -Headers @{Origin='http://localhost:3004';'Access-Control-Request-Method'='POST';'Access-Control-Request-Headers'='content-type'} -UseBasicParsing
~~~

Expected: frontend/rules GET 200, OPTIONS allows only configured origin, unauthenticated GET /auth/profile returns 401. Do not send registration/login requests until separately authorized. If initialization outcome is unknown, inspect this new database read-only rather than repeating SQL. Do not drop tables, reverse migrations, delete volumes or run blanket cleanup.

## Repeat offline checks
~~~powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.json
node cashback-frontend/node_modules/typescript/bin/tsc --noEmit --incremental false -p cashback-frontend/tsconfig.json
node docker/historical/run-offline.cjs
node docker/historical/run-offline.cjs frontend
node node_modules/typescript/bin/tsc --incremental false -p tsconfig.build.json
node docker/historical/build-frontend-offline.cjs
git --no-optional-locks diff --check
~~~

No live activation, SQL, dependency installation, Docker image build or Docker resource mutation was performed during preparation. No original application source, original dependency cache, existing ACL, owner policy or existing process was intentionally changed.

## Files changed in this worktree
- src/app.module.ts, src/main.ts, src/local-configuration.ts: explicit local configuration, TypeORM and CORS/binding.
- src/auth/auth.module.ts, src/auth/jwt.strategy.ts: explicit JWT configuration only.
- cashback-frontend/src/backend.ts, context/AuthContext.tsx, forum.ts, pages/Profile.tsx: one configured API origin only. Register.tsx, Login.tsx, VerifyEmail.tsx, entities and historical migrations are unchanged.
- tsconfig.json, .gitignore, .dockerignore: compiler scope, secret/cache/build exclusions.
- docker/historical/: compose.json, backend.Dockerfile, frontend.Dockerfile, env.example, schema.sql, preflight.cjs, protected-inventory.json, offline-guard.cjs, run-offline.cjs, build-frontend-offline.cjs, README.md.
- src/local-configuration.spec.ts, src/local-schema.spec.ts, src/local-forum.spec.ts, src/local-preflight.spec.ts, cashback-frontend/src/backend.config.test.ts: offline regressions.
