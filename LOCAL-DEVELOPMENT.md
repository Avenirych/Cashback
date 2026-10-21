# Local Cashback registration

Open this repository in VS Code. Run `npm start` in its terminal, or run task
`Cashback: frontend (localhost:3000)`. The same `npm start` works inside
`cashback-frontend`. Both use the existing frontend, defaulting to http://localhost:3000.
Open http://localhost:3000/register. The normal launcher bypasses search-index
generation; refresh public search content explicitly with
`npm --prefix cashback-frontend run search:index` when needed.

The launcher refuses an occupied port, never stops another process, never installs
packages and never starts backend, bonus-api, Docker or a database. Development
compilation can write caches under node_modules. Do not use a second frontend on
3002: that port belongs to bonus-api. localhost and 127.0.0.1 have different browser
storage; use localhost consistently, including links from Mailpit. Use a private
window for synthetic testing without clearing existing sessions.

To use the explicitly supported alternative port without touching an existing server:

```powershell
Set-Location -LiteralPath 'C:\Users\serge\cashback+\cashback-frontend'
$env:PORT = '3003'
$env:REACT_APP_REGISTRATION_ISOLATED = 'true'
npm start
```

Open http://localhost:3003/register. Only 3000 and 3003 are accepted; 3002 is reserved
for bonus-api. The launcher checks the selected port on IPv4/IPv6 and refuses a
collision without fallback or process termination. It always passes
REACT_APP_REGISTRATION_ISOLATED=true to CRA, so bonus API traffic stays disabled.
Unset PORT with `Remove-Item Env:PORT` to return to the default on a later launch.
This alternative frontend port does not change backend/CORS, Docker containers or
Mailpit guards. Mailpit's existing FRONTEND_URL still points to localhost:3000;
using 3003 does not establish full email-registration integration readiness.

Safe launcher tests (no sockets or applications):
`node --test scripts/start-frontend.test.cjs` from the repository root.

## Backend and URLs

Previously the root `npm start` meant `nest start`, not the frontend. That command
is now explicitly `npm run start:backend`; watch/debug remain `start:dev` and
`start:debug`. These commands connect to configured PostgreSQL and must not be
used until the database target is separately approved. `start:prod` requires a
previous backend build producing dist/main.js; no compiled entry exists in the
current checkout. Running a source entry with plain node, running from the wrong
directory, or starting production without that artifact causes MODULE_NOT_FOUND.
The earlier error stack is unavailable, so its exact cause is unconfirmed.

Auth, profile, own-phone and marketing settings share REACT_APP_API_BASE, default
http://localhost:3001. Requests are direct browser requests; no CRA proxy is
configured. Backend currently enables CORS and listens on 3001. Bonus-api is a
separate service on 3002 and is not required for guest registration. The frontend
reports transport timeouts and server failures without displaying server internals.
HTTP validation/auth failures retain their existing messages. Never configure the
browser API base with credentials or a database address.

Routes: /register -> pending email verification -> /verify-email?token=... ->
/profile. /login now opens /profile; guards still require verified email. Phone is
required for registration. Phone verification and SMS sending are not enabled.
Mailpit testing uses synthetic recipients at example.test only. Without a ready
backend, only the UI and client validation can be exercised.

## Separate database approval is required

The root dotenv selects a loopback PostgreSQL target; its contents are not proof of
isolation. Do not connect to it. SQLite is not used by Nest's configured datasource.
Both synchronize and migrationsRun are false; startup cannot create missing schema.
The phone migration adds users.phone_e164, phone_verified, phone_verified_at and
four SMS consent columns on marketing_preferences with consistency constraints.
Register/profile will fail if these or the existing baseline tables are missing.

Plan only, no commands have been executed:

1. Obtain approval to provision a new PostgreSQL 17 cluster in a new Compose project
   with a new empty volume and internal network. No existing mounts, records,
   credentials, published DB ports, or finance components. Use synthetic users only.
2. Keep the existing Mailpit guard unchanged: backend sees postgres-test:5432,
   database cashback_docker_test, SMTP mailpit:1025, NODE_ENV=development,
   LOCAL_DEMO_MAILPIT=true and the exact existing scenario/transport settings.
   The database name is safe only inside the separately approved new cluster.
   Reusing the current Compose project/volume is not part of this plan.
3. Review a new isolated bootstrap specification for the full baseline and phone
   schema before granting any schema-write permission. Existing migration lists
   are not a complete fresh-database bootstrap. Do not use synchronize or an
   automatic startup migration as a substitute.
4. The existing Phone Migration Harness has a different target-name contract.
   It cannot simply be pointed at the Mailpit database. Permissions B/C remain
   ungranted and PHONE_APPLY_CONCURRENCY_VERIFIED remains false. A seventh-migration
   test through that harness remains blocked; this plan grants no alternative apply
   path. Resolve the schema preparation method explicitly before provisioning/apply.
5. After separate approval and readiness validation, start only the approved
   backend and Mailpit services. Check a synthetic registration, required phone,
   pending session, captured email, verification, logout/login and owner profile.
   Confirm unverified access remains denied, no SMS is sent and secrets/tokens
   are absent from logs. No full registration readiness claim precedes this test.
