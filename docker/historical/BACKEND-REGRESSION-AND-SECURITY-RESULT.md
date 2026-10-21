# Backend regression and security validation

20 October 2026. **BACKEND_REGRESSION_CLEAN**.

Canonical Git baseline remains `03573b7f47ba3c04dc50312bc71e0a7b904c0ce7`. Existing uncommitted work was preserved. This report supersedes the regression/deployment status in `FINANCE-COMPLETION-AND-SECURITY-RELEASE.md`; that earlier report and its evidence remain historical records.

## Original 27 failures

| Failures | Root cause | Resolution |
|---|---|---|
| 24 constructor scaffold assertions | Test modules registered the subject controller/service but omitted its injected repositories and collaborating services. Nest failed during compilation before the original assertion. | Retained every original test/assertion; added Nest `useMocker(scaffoldDependencyMock)` to supply missing injection tokens without instantiating real services, SMTP or database clients. The helper supplies strict Jest methods that throw on unexpected calls. The real subject is still instantiated by Nest. |
| 2 deleted-user JWT HTTP assertions | JwtStrategy accepted a valid signature and returned the token subject without looking up the account. A signed token for a deleted account therefore reached marketing handlers. | JwtStrategy now checks the current account for every protected request. Missing/mismatched account is 401; database failure is sanitized 503. The original two assertions now pass unchanged. |
| 1 public forum username-profile assertion | The test repository implemented `findOne` only. Production `getByUsername` correctly uses a parameterized, case-insensitive `createQueryBuilder(...).where(...).getOne()` lookup. The incomplete mock threw a TypeError, producing HTTP 500 in the test. | Added the real query-builder contract to the fixture, retained the 200/public-access assertion, added authenticated coverage and private-field exclusions. Production forum code was not changed. Live anonymous and authenticated public profile requests both returned 200. |

The exact 24 scaffold files are listed below. They were not deleted, skipped, or reclassified as obsolete.

## JWT behavior

* Passport still validates signature and expiration using the unchanged JWT secret. Existing legitimate sessions remain valid when their account exists.
* Subject must be a positive safe integer. Invalid subjects fail before database lookup.
* `UsersService.getById` resolves the current account. Missing/deleted/mismatched IDs are denied. The returned identity uses the current database email rather than a stale token claim.
* Lookup errors return `503 Authentication temporarily unavailable`, with no underlying database detail and no protected operation executed.
* Existing unverified accounts can still authenticate for verification/status/resend flows; verification-dependent profile/forum operations retain their existing checks.
* **Disabled account status is not supported by the current User schema.** No status/disabled column was invented. `email_verified=false` and a forum-only ban are not application-account disable flags. No general per-token denylist/revocation feature is claimed; removing the account now revokes its JWT access immediately on the next lookup.
* Tests cover active/verified and active/unverified accounts, deleted/missing/mismatched identity, invalid subject, invalid/expired JWT, cross-account access and database failure. The loopback HTTP test reuses a previously issued JWT after its mock account is deleted and verifies 401. No real account was deleted for testing.

## Tests and builds

| Check | Result |
|---|---|
| Complete backend Jest source suite, guarded against child processes, active database/network access | **483/483 passed; 58/58 suites passed** |
| Backend TypeScript | Passed, `tsc --noEmit --incremental false` |
| Backend production build | Passed, `npm run build`; complete emitted artifacts additionally verified with `tsc -p tsconfig.build.json --incremental false` |
| Frontend complete Jest | **208/208 passed; 15/15 suites passed** |
| Frontend TypeScript | Passed |
| Frontend production build | Passed with existing Register regex/emailValidator lint warnings; no frontend production code or deployment changed |
| Isolated Nest HTTP/JWT security tests | **15 checks passed**, mock repositories, loopback ephemeral server, no database or active services |
| Original live security checks before deployment | **21/21 passed** |
| Live post-deployment security checks | **27/27 passed**: original 21 plus missing-account JWT on auth/marketing/forum, expired JWT, anonymous/authenticated public forum profile |
| Real isolated PostgreSQL finance integration | **22/22 service-level groups passed**, restricted runtime test role, synthetic authorities only |
| Finance source preservation | All eight files in `finance-completion-source-manifest.json` match their recorded hashes; financial business logic unchanged |
| Node syntax / git diff --check | Passed |

Evidence: `work/backend-regression-jest.json`, `work/backend-regression-jest.log`, `work/frontend-regression-jest.json`, `work/frontend-regression-jest.log`, `work/frontend-regression-build.log`, `work/backend-regression-security-http.json`, `work/backend-regression-security-before.json`, `work/backend-regression-finance.json`, `JWT-SECURITY-ACTIVATION-RESULT.json`.

Final independent runtime evidence: `BACKEND-REGRESSION-RUNTIME-IDENTITIES.json` confirms one active backend and the stopped rollback backend. A final GET of the unchanged frontend returned 200; anonymous GET `/auth/profile` returned the required 401. Final backend Jest exited naturally with 483 passed, zero failures and zero detected open handles.

### Open handles and build warnings

Backend `--detectOpenHandles` reports an empty handle list. The final full backend run is executed without `--forceExit`. Frontend assertions all pass, but `--detectOpenHandles` identifies one existing **TCPWRAP** from `SiteSearch.tsx:77` fetching `/search-index.json` during App rendering (`App.test.tsx`). The frontend run used `--forceExit` after all assertions/output; it is not claimed to be handle-clean. This test-network fixture issue is separate from backend security and was not hidden by modifying production search behavior.

An initial frontend build inherited `CI=true` from the test command and treated existing lint warnings as errors. The ordinary production build was then run with `CI=false` and passed with those warnings disclosed. No lint rules, assertions or source validations were disabled.

## Deployment and live validation

Only `src/auth/jwt.strategy.ts` and its compiled JS/map/declaration artifacts were copied into a derived image of the exact previously active security backend. No production forum, registration, email, finance, entity, module or dependency changes were included. Current source hash: `3cfd1060ff5f54fb4e20fb94ade60fcb31780d849f07c9e3c6606016d3f78807`.

* Active backend: `ced2bf78f14226db06e758edb4cd7d1d9d99289e0ad4d89e4b6bc55cc6826c8a`.
* Active image: `sha256:ff1f7c5ffebb7d0850403e49e5ea9c61612eee3fb63c139cc86858a83b5bb337`.
* Container: `cashback-historical-03573b7-local-backend-1`.
* Backend URL: http://127.0.0.1:3006/.
* Frontend URL: http://localhost:3004/; existing frontend container was not restarted.
* Compose backend image reference only updated to `cashback-historical-security:2b1b3a03-9e8a-4918-aa88-b2c1ad42a830` after successful live checks. The protected root Compose file was not changed.

The release verified the exact daemon, old backend ID/image/name/labels, previous JWT source backup, unchanged dependent production sources and existing historical database environment. It encrypted the configuration with CurrentUser DPAPI and verified a decrypt roundtrip in memory. The old image was saved, loaded back and checked against its immutable image ID. A replacement was staged and environment/ports/security settings compared before stopping the old backend. Duplicate release labels were explicitly replaced with the new release identity. No second active backend was retained.

Live checks confirmed JWT/ownership/private DTO/mass assignment protections, unavailable unsafe legacy routes, auth profile access, invalid registration/login/email-token rejection, public rules/profile and protected discussion access. The existing verified member passes forum authorization; an empty topic request is rejected with 400 before creating a post. **Successful real forum posting, positive password login and valid email confirmation were not exercised**, because no real account/post/email mutations were needed. Those full user journeys are not claimed from HTTP 200 or mocks.

An initial automated approval review rejected the probe due to a suspected successful account PATCH. That command did not run. Source inspection distinguished the successful PATCH in the separate mock-only HTTP script from live checks, which send only a forbidden balance PATCH (400) and a cross-owner PATCH (403). After that evidence was provided, the live probe and bounded release were approved and completed. No successful real account PATCH was sent and no security control was bypassed.

## Database and finance preservation

Historical database: `cashback_historical_03573b7`, cluster `7698666936429441062`, PostgreSQL container `48dca500f37c30e2787c9510e8b9111917c19136ea970d036ff43ca4570bec84`, application role `cashback_hist_runtime`. Release checks used read-only transactions. Database table inventory, row counts and content digests matched before/after release. No user reset, balance change, schema synchronization, migration, seed or financial endpoint activation occurred.

The existing 22 finance scenarios ran in a separately identified fresh PostgreSQL cluster, internal network and tmpfs container with no published ports or persistent volumes. Exact owned test containers and the empty labelled network were removed afterward. Protected container IDs/images/start times/running states and persistent volume inventory remained unchanged. FinanceModule remains absent from live AppModule; financial migrations remain undeployed. Previously documented unresolved financial policies remain unchanged.

## Backup and rollback

Verified source/test/config backup: `work/backend-regression-backup-2026-10-20T20-00-02-096Z` (28 original files, original bytes/hash manifest), plus prior project backups retained.

Release archive: `work/security-regression-2b1b3a03-9e8a-4918-aa88-b2c1ad42a830`:

* `backend-inspect.dpapi`: verified encrypted configuration, no credentials in this report.
* `backend-before.tar`: load-verified previous working security image.
* `historical-compose.before.json`, `compose-config-change.json`: previous Compose and exact image-reference change.
* `release.json`, `database-before.json`, `context/`: release/database evidence and four copied JWT source/artifact files.

Previous working backend `feb2181f7ababf41d35968ede8a4d325cf6d1257752ab4b15f9397c755fdc0f6` is retained stopped as `cashback-historical-03573b7-local-backend-1-rollback-2b1b3a03-9e8a-4918-aa88-b2c1ad42a830`. Its image is `sha256:9975cdeabba8f95f774fb23cf5133bf89bd26967ff47b4814d34718c5a0db153`.

Rollback was **not needed**. `activate-jwt-security.cjs` contains identity-checked failure rollback. A future rollback must reverify both exact IDs/images and port ownership, stop only the new backend, retain it under a distinct name, restore the old container's canonical name/start that exact old container, and restore the archived backend image reference. Do not restore or modify PostgreSQL, frontend, Mailpit, databases or volumes. Artifact/config restore roundtrips were verified; a disruptive live rollback drill was not performed.

## Changed files and remaining limits

Production logic: **only `src/auth/jwt.strategy.ts`**. No forum production change was required.

Tests: `src/auth/jwt-active-user.spec.ts`, `src/forum/forum-read-access.spec.ts`, `test/scaffold-mocks.ts`, and the 24 constructor scaffold files listed below. Existing assertions are preserved.

Release/support files: `docker/historical/legacy-security-http.cjs`, `activate-jwt-security.cjs`, `jwt-security-release.json`, `JWT-SECURITY-ACTIVATION-RESULT.json`, `compose.json` (backend image only), this report, runtime evidence and archived logs/manifests. `FINANCE-SERVICE-TEST-RESULT.json` records the new passing run; finance source and rules are unchanged.

No remaining backend regression/security-release blocker was found within this scope. Separate remaining items: frontend test TCPWRAP and preexisting lint warnings; full write-capable user journeys not repeated; no unsupported account-disabled field or per-token revocation system; previously unresolved finance policies remain isolated/pending. No claim of complete financial activation or full browser end-to-end verification is made.

### Exact scaffold files

- `src/auth/auth.controller.spec.ts`
- `src/auth/auth.service.spec.ts`
- `src/balance/balance.controller.spec.ts`
- `src/balance/balance.service.spec.ts`
- `src/bonus-transfer/bonus-transfer.controller.spec.ts`
- `src/bonus-transfer/bonus-transfer.service.spec.ts`
- `src/cashback/cashback.service.spec.ts`
- `src/clicks/clicks.controller.spec.ts`
- `src/clicks/clicks.service.spec.ts`
- `src/notifications/notifications.controller.spec.ts`
- `src/notifications/notifications.service.spec.ts`
- `src/partners/partners.controller.spec.ts`
- `src/partners/partners.service.spec.ts`
- `src/products/products.controller.spec.ts`
- `src/products/products.service.spec.ts`
- `src/promo/promo.controller.spec.ts`
- `src/promo/promo.service.spec.ts`
- `src/search/search.controller.spec.ts`
- `src/search/search.service.spec.ts`
- `src/transactions/transactions.controller.spec.ts`
- `src/transactions/transactions.service.spec.ts`
- `src/user-settings/user-settings.controller.spec.ts`
- `src/withdrawal/withdrawal.controller.spec.ts`
- `src/withdrawal/withdrawal.service.spec.ts`
