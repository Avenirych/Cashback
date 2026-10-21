# Extended registration restored and activated

Status: EXTENDED_REGISTRATION_READY

Recovered from d14f76e9: MUI PhoneInput, local SVG flags, libphonenumber-js/max normalization and the existing five password checks. Both dependency lockfiles pin libphonenumber-js 1.13.15. No second registration/auth system was introduced. Existing email-token flow, JWT secret, forum membership and bonus exchange remain in use.

## Interface and data

- Registration order: first name, last name, email, mandatory phone, password. Reference implementation did not contain password confirmation; none was invented.
- Password: at least 8 characters, uppercase Latin, lowercase Latin, digit, special character; identical frontend/backend checks. Existing users can still log in with their existing passwords.
- Phone: GB/+44 by default, GB pinned once, locale-aware names/order for ru/en/de/fr, name/calling-code search, local flags, existing MUI keyboard handling. Selection survives language changes. Valid numbers are normalized to E.164 using max metadata. No SMS/provider/phone-verified flag.
- Draft: only firstName, lastName, email, phone and country in localStorage; no password or confirmation. Restores after remount/refresh and clears after successful registration. Never updates a profile from a draft.
- Own /auth/profile returns separate names and phone. Profile displays these as read-only personal fields. Existing personal-field editing was not present; unrelated Wise controls were preserved.
- Separate forum registration prefills read-only names/email from the authenticated account. Username/avatar/rules/membership behavior remains intact. No phone is rendered publicly. New entity fields are select:false and explicitly selected only for own auth/profile flows.

## Database and backup

Only cashback_historical_03573b7, OID 16384, cluster 7698666936429441062 was used. Migration 20261020-extended-registration.sql was identity-guarded and committed once: three nullable columns, bounded checks; no account UPDATE/backfill, no destructive statements, no new grants, no automatic migration or synchronization. Existing name is kept for compatibility; historical names are not guessed/split.

Rollback/source archive and DPAPI encrypted backup: C:\Users\serge\AppData\Local\Temp\cashback-extended-1792506502143. Backup SHA-256: 726ada307969fd1854de2bb63c96c677356b447c9bde1a7cbbf46f06531d8fec. Encryption roundtrip, pg_restore listing and full archive scan succeeded. A trial database restore was not performed. Old application image IDs and rollback Compose are retained there. The additive schema is compatible with old application images and must not be destructively reversed.

## Validation and runtime

98 frontend / 117 backend tests passed. Full repository and frontend TypeScript, syntax, production frontend/backend Docker builds and git diff --check passed. Existing unrelated lint/dependency warnings remain; no automatic dependency remediation was attempted.

Live API/DB test with one disposable synthetic account passed: rejected invalid phone/short password without inserts, stored separate fields and normalized phone, delivered email to local Mailpit, consumed verification token once, logged in, loaded own profile, created separate forum membership, rejected duplicate membership, kept phone out of public forum output, preserved bonus snapshot endpoint. Exact cleanup removed only that account, membership and message. Original two user rows/verification state and forum inventory were unchanged.

Only historical frontend/backend were replaced; PostgreSQL/Mailpit and all other container IDs/images/start times were preserved. Credentials/JWT secret reused. Exact service identities, routes and checks are in EXTENDED-RESULT.json. HTTP 200 for protected SPA routes only confirms shell delivery; authenticated data behavior was separately tested through the API. Browser visual verification is for the owner, not claimed here. No existing-user password was requested or tested, and no password-reset endpoint was introduced or changed.

## Manual URLs

- http://localhost:3004/register
- http://localhost:3004/profile
- http://localhost:3004/forum/register
- Local test email: http://127.0.0.1:8036/

Full changed-file list and structured evidence: EXTENDED-RESULT.json.
