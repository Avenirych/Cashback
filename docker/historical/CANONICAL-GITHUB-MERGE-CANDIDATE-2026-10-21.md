# Canonical GitHub merge candidate — 21 October 2026

Status: **MERGE_CANDIDATE_VERIFIED**. NOT PUBLISHED. NOT DEPLOYED.

Exact local merge candidate: `c2542bcb3a4b6edbdd8f76bbcee18afa911eeb8a`. Both parents independently verified: `fb2cfee91e1d7cb113d301c69e48c9613e100e6c` and `d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f`. A report/verification-only child commit records this identity and checks staged archive bytes without changing tested application source.

## Owner approvals and identities

1. Narrow security-only adaptation: JWT payload/int32/nonblank-secret checks, sanitized mail logs, removal of public analytics handler, name-only profile object hardening. Existing authentication/verification/consent contracts remain.
2. Defer remote owner-phone PATCH, phone_verified/phone_verified_at, remote SMS revocation and migration 1792195200000. No schema activation.
3. Keep SQLite bonus API as inactive CI-only component, memory database only; no listener, website routing or published SQLite/WAL/SHM payloads.

Canonical HEAD: fb2cfee91e1d7cb113d301c69e48c9613e100e6c. Application baseline: a27fa64889bed8c9ed0d98903ab3ab8fe0f8c54f. Remote main/MERGE_HEAD: d14f76e9d8cd52de3aeffb3c6dc78c6639e1b28f. Common ancestor: 03573b7f47ba3c04dc50312bc71e0a7b904c0ce7. Both identities and the original 74 index-stage sets matched the approved manifest. Remote default/main was independently checked with ls-remote. Integration branch: integration/github-reconciliation-2026-10-21, in work/github-reconciliation-2026-10-21. Canonical branch/tag remain unchanged.

Recovery archive: C:\Users\serge\AppData\Local\CashbackRecovery\canonical-baseline-20261021-103933-e64f0f2eb0714720a6b38ed959d1591a. Existing source verification: 74,207 files / 2,085,204,753 bytes; 30 evidence hashes. canonical-final.bundle was reverified as complete history, SHA-256 274fcc29575a36b6f75fd42f738deb88cfc56162835371a4f5bb144b5c368bd6. No secret contents are included here. Per-path raw merge and stage backups: work/approved-merge-backup in this worktree. No backup or cleanup candidate deleted. This is source recovery, not a database backup.

## Security and compatibility decisions

JWT signature/expiry remain Passport/JwtService responsibilities. Malformed payloads and out-of-int32 IDs fail before lookup; missing/deleted/mismatched user fails 401; lookup failure returns sanitized 503; persisted email is authoritative, and unverified legitimate users retain verification access. There is no invented disabled-user column. The remote JWT configuration helper is retained solely for compatibility tests and is not wired into AppModule/AuthModule.

Mail logs no longer disclose recipients, verification links, tokens or transport secrets. Existing atomic consumeEmailToken, expiry, resend IP/email cooldown, no-store and SMTP/Mailpit settings are byte-preserved. GET /analytics is unregistered; tests verify anonymous and authenticated 404 without repository access. Internal analytics remains. Profile patch still accepts only name; exotic prototypes, inherited/accessor/extra/symbol fields are rejected.

Remote test adaptation is explicit: registration fixtures use current firstName/lastName/phone details; owned DTO phone data remains visible only under current private mappings; verification mocks use atomic consume; pre-existing duplicate registration remains 400 and creation failure remains sanitized 503, not remote 409; resend lookup failure retains canonical generic HTTP 500, other states retain capability-free response. No production auth contract changed to fit older tests. Country-mismatched numbers remain rejected. All 61 canonical backend test files remain byte-identical. Forum tests add logout/session assertions. Expanded search tests preserve safe internal links, localization, content fallback, malformed-index handling and existing assertions. Current privacy/cookie route/link tests remain.

54 remote-only non-data source blobs are retained byte-exact under docker/legacy-remote/source with original paths, blob IDs and SHA-256 in activation-manifest.json. Deferred phone/schema/demo tests are preserved as reference, not counted as executed. Executable remote CLI data sources and migrations are absent from application source roots. Application migrations remain empty; synchronize/migrationsRun false. All 16 isolated finance migrations and 71 finance source files, policy manifests/scenario sources, AppModule, auth/registration/verification, entity, current routing, lockfile family and main Compose remain canonical. A source guard verifies 141 unchanged files and all 54 archives. The source-archive-only attributes preserve original bytes/EOF spacing across Windows checkouts.

SQLite CI tests use memory databases; direct CLI/server startup and persistent paths fail closed. The full original server is also retained as provenance; its inactive HTTP reference is uncalled and unexported. No website route points to 3002, no legacy service is activated in Compose. Three original local SQLite payloads remain untouched and ignored, excluded from the final Git index. Clean-copy npm ci (offline cache, no inherited node_modules or data files), syntax check and npm test pass. Existing source contains no new copied credentials.

## New verification results

| Check | Result |
| --- | --- |
| Complete guarded backend Jest | 761/761 PASS; 71 suites; 0 skipped, 0 failed |
| Complete frontend Jest | 270/270 PASS; 21 suites; 0 skipped, 0 failed |
| Backend TypeScript | PASS |
| Backend production build and nonincremental emitted build | PASS; dist/finance verified |
| Frontend TypeScript | PASS |
| Strict CI=true production build | PASS |
| Standard CI=false production build | PASS |
| Legacy clean-copy npm ci + Node tests | 6/6 PASS, 0 skipped; no data files |
| Dormant launcher mock tests | 16/16 PASS, no real process/socket/browser |
| Node syntax checks | PASS: legacy server/tests, generator, launcher, source guard |
| Isolated PostgreSQL scenarios | 97/97 PASS |
| Finance migration readiness | 16 migrations / 11 checks PASS |
| Source/finance/provenance guard | PASS; 15 public indexed pages, no staged SQLite |
| Conflict markers / unmerged entries | 0 / 0 |
| Whitespace checks | PASS; application checks unchanged, exact archive EOF spacing retained |
| Protected resources after tests | All 18 containers plus original images, volumes and networks unchanged |

Finance disposable cluster: 7699113594403258412, database finance_completion_isolated, restricted test role finance_app. Protected cluster 7698666936429441062 was excluded by the runner. Test resources were internal-network/tmpfs only and exact-owned containers/network removed; no persistent volume was created. Protected active database was not accessed. One test image/archive remains for evidence; no protected image cleanup occurred.

Open handles: backend and frontend --detectOpenHandles JSON both contain empty arrays; processes exited. Backend Supertest emits MaxListenersExceededWarning for repeated mock HTTP server request listeners; no surviving handle was reported. Frontend existing test console warnings and build fs.F_OK deprecation are separate nonfailure diagnostics. No warning/assertion was suppressed to pass strict production builds.

Initial failures were fixture/API-version mismatches and strict typing in remote tests; corrected within test adaptation. Additional legacy launcher assertion targeted obsolete root demo npm start and is now checked against canonical Nest startup without changing scripts. First finance attempt stopped before creating resources because Nest incremental build produced no dist after cache reuse; nonincremental build emitted and verified actual files, then all scenarios passed. Docker info initially timed out; daemon later responded without restart, and final resource comparison passed. Sandbox-only npm cache/backup access used approved tool escalation, without OS elevation, ACL changes or security exclusions.

Evidence logs/JSON are retained locally under work/approved-* with hashes in CANONICAL-GITHUB-MERGE-RESOLUTIONS-2026-10-21.json; current finance result is tracked in FINANCE-SERVICE-TEST-RESULT.json. No previous baseline result was counted as a new test run.

## 74 per-file conflict resolutions

The linked JSON records authoritative stage blob hashes, raw before/after SHA-256 and final staged blob for every path; canonical source retained individually unless the approved delta is stated. Both histories remain merge parents, not cherry-picked or discarded.

| Path | Reviewed resolution |
| --- | --- |
| .dockerignore | Combine secret/SQLite/context exclusions; retain SQL fixtures and canonical env examples. |
| .github/workflows/ci.yml | Retain full canonical backend/frontend CI and add real in-memory legacy test command. |
| .gitignore | Retain policy/archive rules; exclude all legacy SQLite payloads. |
| cashback-frontend/public/search-index.json | Regenerated canonical index: 15 public pages, including privacy/FAQ/cookies. |
| cashback-frontend/scripts/build-search-index.mjs | Retain canonical coverage and private-page allowlist. |
| cashback-frontend/src/App.test.tsx | Retain existing assertions; separately adapt useful additional public-navigation assertions. |
| cashback-frontend/src/App.tsx | Keep routes/guards; language fallback is a small optional UI improvement, not permission for route removal. |
| cashback-frontend/src/backend.ts | Keep canonical comment and identical request implementation. |
| cashback-frontend/src/bonusApi.ts | Hold: do not silently redirect bonus operations to the separate SQLite service. |
| cashback-frontend/src/components/Footer.tsx | Preserve restored information section and routes; evaluate only additive localization. |
| cashback-frontend/src/components/Header.tsx | Optional additive Shop/responsive change needs UI scope decision; retain all current controls. |
| cashback-frontend/src/components/MarketingPreferencesModal.tsx | Retain canonical independent consent and failed-save behavior. |
| cashback-frontend/src/components/MarketingPreferencesPanel.test.tsx | Keep canonical assertions; do not replace with the smaller older suite. |
| cashback-frontend/src/components/MarketingPreferencesPanel.tsx | Keep canonical consent UI. |
| cashback-frontend/src/components/PhoneInput.tsx | Retain recovered searchable selector and existing flags. |
| cashback-frontend/src/components/SiteSearch.css | Retain results-page/mobile styles. |
| cashback-frontend/src/components/SiteSearch.test.tsx | Adapt valuable security assertions to current link/results-route UI without replacing existing assertions. |
| cashback-frontend/src/components/SiteSearch.tsx | Preserve canonical search experience; retain existing path allowlist. |
| cashback-frontend/src/context/AuthContext.tsx | Retain canonical verification check and account contract; separately review compatible timeout/privacy improvements. |
| cashback-frontend/src/i18n.ts | Keep current keys/wording; defer phone-status keys until owner decides that feature; preserve optional untranslated additions for review. |
| cashback-frontend/src/onboarding.test.tsx | Retain canonical protected assertions; additional compatible public tests may be adapted, never delete stronger coverage. |
| cashback-frontend/src/pages/ForumBonusExchangePanel.tsx | Keep canonical demo disclosure; no change to transaction model. |
| cashback-frontend/src/pages/PrivacyPolicy.tsx | Keep canonical anchors. |
| cashback-frontend/src/pages/Profile.tsx | Do not replace approved profile or introduce unsupported columns/phone-write behavior. |
| cashback-frontend/src/pages/Register.tsx | Keep canonical registration/verification UX; remote-only isolation UX must not replace it. |
| cashback-frontend/src/pages/RegistrationOnboarding.test.tsx | Keep canonical flow; adapt additional privacy assertions only if compatible. |
| cashback-frontend/src/utils/phone.ts | Retain canonical country consistency validation. |
| docker/PHONE-MIGRATION-PLAN.md | Retain all immutable safety/provenance material; no execution. |
| docker/local-registration/README.md | Retain canonical evidence with explicit source-only status; do not treat either document as runtime authorization. |
| docker/local-registration/admission.spec.ts | Keep stronger canonical tests and unopened admission gates. |
| docker/local-registration/admission.ts | Preserve canonical admission code/template pair; no policy or fingerprint mutation. |
| docker/local-registration/compose.registration.json | Keep canonical reviewed template/hash pair; neither is the active historical stack. |
| docker/local-registration/config.spec.ts | Keep paired canonical configuration test. |
| package-lock.json | Keep verified lockfile unless a separate dependency migration is approved and fully tested. |
| package.json | Do not mix dependency families or change launch semantics during reconciliation. |
| scripts/start-frontend.cjs | Keep canonical dormant launcher; no execution and no active port change. |
| scripts/start-frontend.test.cjs | Preserve all mocked launcher assertions; correct root npm start contract to canonical Nest, keeping demo launcher dormant. |
| src/app.module.ts | Keep canonical isolated target and disabled finance; do not port DB defaults or migration wiring. |
| src/auth/auth.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/auth/auth.controller.ts | Keep canonical guards, throttles and request contract. |
| src/auth/auth.module.ts | Use nonblank JWT secret helper; retain canonical DI and 24-hour token signing. |
| src/auth/auth.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/auth/auth.service.ts | Never replace wholesale; owner-approved security-only port must preserve single-use tokens/rate limits/current registration contract. |
| src/auth/jwt.strategy.ts | Shape/int32 bounds; retain current-user lookup, identity equality and database email. |
| src/balance/balance.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/balance/balance.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/bonus-transfer/bonus-transfer.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/bonus-transfer/bonus-transfer.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/cashback/cashback.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/clicks/clicks.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/clicks/clicks.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/forum/forum-user.service.spec.ts | Keep canonical public-profile regression support and filesystem assertions. |
| src/mail/mail.service.ts | Sanitize success/failure/transport logs; retain SMTP configuration, timeouts and Russian templates. |
| src/marketing-preferences/marketing-preferences.security.spec.ts | Keep canonical security assertions; adapt any future JWT-provider test changes with the provider change. |
| src/notifications/notifications.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/notifications/notifications.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/partners/partners.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/partners/partners.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/products/products.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/products/products.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/promo/promo.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/promo/promo.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/search/search.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/search/search.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/transactions/transactions.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/transactions/transactions.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/user-settings/user-settings.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/users/user.entity.ts | Requires separate schema/feature review; do not assume columns exist or query live DB. |
| src/users/users.controller.ts | Keep current allowlist; defer owner phone-write API until separate approval. |
| src/users/users.dto.ts | Own-name-only data descriptor validation, no phone PATCH or writable-field expansion. |
| src/users/users.service.ts | Keep atomic verification and current schema; phone/SMS transaction is valuable but needs owner/schema decision. |
| src/withdrawal/withdrawal.controller.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| src/withdrawal/withdrawal.service.spec.ts | Retain current passing scaffold; the remote dependency-injection fix is already represented by canonical mocks. |
| tsconfig.json | Keep canonical compiler scope; do not switch dependency/test contracts. |

## 57 remote additions

| Path | Reviewed disposition |
| --- | --- |
| .vscode/tasks.json | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| cashback-frontend/REGISTRATION-DEMO.md | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| cashback-frontend/bonus-api/.gitignore | Retain compatible source/test for adaptation; original also preserved as provenance |
| cashback-frontend/bonus-api/data/bonuses.sqlite | Exclude SQLite payload from Git index; leave local original untouched and ignored |
| cashback-frontend/bonus-api/data/bonuses.sqlite-shm | Exclude SQLite payload from Git index; leave local original untouched and ignored |
| cashback-frontend/bonus-api/data/bonuses.sqlite-wal | Exclude SQLite payload from Git index; leave local original untouched and ignored |
| cashback-frontend/bonus-api/package-lock.json | Retain compatible source/test for adaptation; original also preserved as provenance |
| cashback-frontend/bonus-api/package.json | Retain compatible source/test for adaptation; original also preserved as provenance |
| cashback-frontend/bonus-api/server.mjs | Retain compatible source/test for adaptation; original also preserved as provenance |
| cashback-frontend/src/backend.test.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| cashback-frontend/src/bonus-access.test.tsx | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| cashback-frontend/src/components/OwnPhonePanel.tsx | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| cashback-frontend/src/components/PhoneInput.test.tsx | Retain compatible source/test for adaptation; original also preserved as provenance |
| cashback-frontend/src/pages/LocalRegistrationFlow.test.tsx | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| cashback-frontend/src/pages/RegistrationFields.test.tsx | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| cashback-frontend/src/registrationIsolation.test.tsx | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| cashback-frontend/src/services/bonusApi.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| cashback-frontend/src/utils/phone.test.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| src/auth/auth-email-uniqueness.spec.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| src/auth/auth-registration-security.spec.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| src/auth/auth-resend-security.spec.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| src/auth/auth-users-contract.spec.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| src/auth/jwt-configuration.spec.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| src/auth/jwt-configuration.ts | Unwired compatibility module retained for remote configuration regressions; not application configuration authority. |
| src/auth/jwt-user-existence.spec.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| src/auth/registration-readiness.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/auth/registration-readiness.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/data-source.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/docker-main-test-data-source.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/docker-main-test-preflight.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/docker-main-test-preflight.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/docker-phone-migration-data-source.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/docker-phone-migration-preflight.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/docker-phone-migration-preflight.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/docker-phone-migration-runner.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/docker-test-data-source.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/legacy-routes-security.spec.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| src/mail/local-demo-mailpit.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/mail/mail-security.spec.ts | Retain compatible source/test for adaptation; original also preserved as provenance |
| src/migration-registration.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/migrations/1733927999000-InitialApplicationTables.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/migrations/1733928000000-AddMarketingPreferences.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/migrations/1791888000000-AddUsersEmailUnique.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/migrations/1792195200000-AddUserPhoneAndSmsConsent.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/migrations/CreateBonusTables.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/migrations/user-phone.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/migrations/users-email-unique.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/users/email-normalization.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/users/phone-normalization.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/users/users-email-normalization.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/users/users-phone.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| src/users/users.controller.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| test/email-unique/README.md | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| test/email-unique/config.spec.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| test/email-unique/data-source.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| test/email-unique/run.integration.ts | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |
| test/email-unique/tsconfig.json | Relocate exact remote-only unactivated source to non-executable .source.txt; original bytes retained locally and in remote Git parent |

## 15 automatically merged paths

| Path | Reviewed disposition |
| --- | --- |
| cashback-frontend/package-lock.json | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/package.json | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/components/ForumHeader.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/context/AuthContext.test.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/pages/BonusAds.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/pages/BonusResearch.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/pages/Dashboard.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/pages/Forum.test.tsx | Add compatible forum-only logout/session-preservation assertions without removing canonical expectations. |
| cashback-frontend/src/pages/Login.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/pages/Profile.test.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/pages/Shop.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/pages/TopicsPage.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/src/pages/Welcome.tsx | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| cashback-frontend/tsconfig.json | Canonical version retained after individual auto-merge review; analytics receives approved endpoint removal separately |
| src/analytics/analytics.controller.ts | Remove unguarded GET registration; retain internal event access. |

## Publication boundary

No push, PR, deployment, active database access, financial endpoint wiring, live migration, balance changes, protected container rebuild/restart or destructive cleanup. The 259 pending cleanup candidates are untouched. Local merge commit and final index/parent checks are complete; future publication requires a separate owner instruction specifying the reviewed candidate SHA and PR target. No GitHub hosted Actions claim is made; equivalent local suites and clean legacy CI were executed.

Remaining blockers: none for the approved local candidate. Hosted GitHub Actions, PR/publication, live deployment, active database compatibility/backup and finance activation were not authorized or performed. Any future publication must refer to the exact reviewed candidate SHA above.
