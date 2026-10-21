# Security activation and isolated financial operations

20 October 2026. Canonical source baseline: `03573b7f47ba3c04dc50312bc71e0a7b904c0ce7`, with preserved uncommitted work.

**TASK A: SECURITY_ACTIVE. TASK B: FINANCE_ISOLATED_PARTIAL.**

The four-file security release is live. This is not a declaration that every application security or financial workflow is complete. Financial operations below are internal, isolated development code; they are not enabled in the running application.

## A. Security release

Verified source hashes (also in `SECURITY-ACTIVATION-RESULT.json`):

| File | SHA-256 |
|---|---|
| src/users/users.controller.ts | 47ca9a6b8416ea0af26cce568f172fdc2dd21c46cede5b479ce766cf45c8a412 |
| src/users/users.dto.ts | 03ba1221c21a4b9e6e5061f40a1eec4c46b5520ac1ac1d26c06ebe093019a86b |
| src/topics.controller.ts | 15bd1b382aeaf6c7d963711c665048cad2c0f3ae722e9ce0214081e658abf20c |
| src/posts.controller.ts | d932b672ab6d346d7718f2b60e4db94c2f41e13067b3026f4255b1b5c0b6c189 |

Old backend: `b5910499569e8becd7a03408d77a2f2af265f650afc673d8f29eb33cd1db2419`, image `sha256:671f4b577d213ed06f2abd052fec289078f980226515fc743b1f49d74c6b8538`.

Active backend: `feb2181f7ababf41d35968ede8a4d325cf6d1257752ab4b15f9397c755fdc0f6`, image `sha256:9975cdeabba8f95f774fb23cf5133bf89bd26967ff47b4814d34718c5a0db153`. Canonical container name: `cashback-historical-03573b7-local-backend-1`. Backend URL: http://127.0.0.1:3006/. Frontend remains http://localhost:3004/.

Backup: `C:\Users\serge\cashback+\work\security-activation-5ee2c121-4ead-435c-8a0d-d299d9c6278c`.

* `backend-inspect.dpapi`: encrypted CurrentUser DPAPI configuration; encrypt/decrypt roundtrip checked in memory. No plaintext credentials in this report.
* `backend-before.tar`: saved image, loaded back and independently checked against its exact original image ID.
* `historical-compose.before.json`, `compose-config-change.json`: original Compose configuration and recorded source-config change.
* `release.json`, `database-before.json`: release and database comparison evidence.
* Old backend retained stopped under `cashback-historical-03573b7-local-backend-1-rollback-5ee2c121-4ead-435c-8a0d-d299d9c6278c`.

The release image derives from the exact old image and copies only four TypeScript files and their compiled JS/map/declaration artifacts. JWT, registration, email, forum, marketing, database configuration and dependencies were compared with the old image; no finance sources or migrations were copied into the release. Image environment, mounts, loopback port, capabilities, security options and network configuration were checked before stopping the old backend. `docker/historical/compose.json` now references the verified security image tag, preventing a subsequent ordinary activation from silently choosing the old image. The protected root `compose.yaml` was not modified.

`activate-legacy-security.cjs` contains bounded identity-checked rollback on failed startup/checks: stop only the staged release container, retain it, rename/start the retained original backend. A future manual rollback must first reverify these exact IDs, images, ownership and port ownership; stop the current release, preserve it under a distinct name, restore the retained old container's canonical name and start that exact old container. Restore only the archived backend image reference in Compose. Do not restore the database or invoke broad Compose teardown. Rollback was **not needed**; the archive roundtrip and retained artifacts were verified, not a live rollback drill.

### Live checks

21 checks passed, recorded individually in `SECURITY-ACTIVATION-RESULT.json`:

* Anonymous/invalid JWT denied; cross-account read and update denied.
* Own safe DTO returned without password/token/private fields; forbidden balance assignment rejected.
* Legacy users list/create/balance, Topics and Posts unsafe routes unavailable (404).
* Protected auth/profile: anonymous 401, authorized 200.
* Registration/login invalid empty requests: 400; malformed email token: 400.
* Forum rules public 200; protected discussion anonymous 401 and verified member 200; empty topic rejected before write.

Short-lived diagnostic JWTs were generated only in backend memory using the unchanged existing secret and existing identities. No test accounts, posts, marketing messages or emails were created. This proves JWT/route/DTO behavior, **not** positive password login, valid email confirmation or successful forum posting; those write-capable journeys were not executed. No browser verification is claimed.

Database table inventory, row counts and server-side row-content digests matched before/after activation. Historical database `cashback_historical_03573b7`, cluster `7698666936429441062`, container `48dca500f37c30e2787c9510e8b9111917c19136ea970d036ff43ca4570bec84`, runtime role `cashback_hist_runtime` were verified. No synchronization, migration, seeding or account mutation ran. Final service evidence is in `FINAL-SECURITY-RUNTIME-IDENTITIES.json`: one active backend, old rollback stopped; frontend, PostgreSQL and Mailpit retain their identities.

## B. Implemented in isolation

Existing ledger, caller-owned TypeORM transaction, bank receipt and outbox services are reused. Defaults deny authority; synthetic verifiers exist only in the isolated test script. No financial controller/provider or migration was added to AppModule. The 43 restored original finance files remain covered by the earlier provenance manifest.

* `LotOperations`: immutable source/owner/origin/responsibility/confirmation time; separate available/reserved ledger accounts; partial reservation from one penny, concurrency protection, atomic move, verified-unused-failure release, no invented expiry. Immutable command payload/hash/result audit supports replay and conflict rejection.
* Existing purchase linkage: trusted click/buyer/partner/offer and multiple canonical partner orders; conflicting callback identity rejected. No guessed winning-order allocation or bonus consumption is performed.
* `ReceiptSettlement`: whole verified GBP receipt, exact commission basis, trusted order ownership for cashback, satisfied finality, independently verified classification/coverage/budget, paid expense evidence and positive margin. One transaction creates liabilities, platform portion, optional debt offset, immutable source/receipt allocation, ledger and outbox. Source/receipt uniqueness protects against alternate callback keys. Ratios: cashback/rewarded advertising 80/20; research referral 50/50; passive advertising 0/100, on verified income rather than product price.
* Customer obligations are credited gross. Banking, transfer and other expenses are separate debit expense accounts backed by sealed, already-paid whole journals from separately verified platform-owned cash. Expenses do not silently reduce customer promises; one expense journal cannot be attributed twice. Unknown future cost recognition or net/partial receipt allocation stays pending.
* Collector: all eligible free confirmed lots of the debtor, including bonus and withdrawal-only GBP, capped by one verified outstanding debt; serialized with incoming settlement, no double collection. Unapproved ordering between debts or competing source slices stays pending.
* Transfer: partial free bonus lot transfer preserves parent, origin, original responsible sender and confirmation age. Verified linked recovery is capped by the originating debt and that child's free funds. Reserved and unrelated recipient funds are protected. Incoming transfers requiring unresolved recipient-debt orchestration remain pending.
* Full/partial refund evidence has immutable identity/order binding and conflict checks, with no invented monetary correction. Original journals are never edited. Existing classification-correction infrastructure is retained; it is not represented as a completed customer refund.

### Prepared migrations — NOT applied to active PostgreSQL

* Existing core/outbox/receipt migrations, plus prior `1792500000000-AddPurchaseLinkage.ts`.
* New `1792510000000-AddIsolatedLotOperations.ts`: commands, immutable lots/lineage, reservations, externally verified debt records and pending refund evidence; deferred reservation-vs-ledger consistency checks on both reservation changes and reserved account balance changes.
* New `1792511000000-AddIsolatedReceiptSettlement.ts`: distinct expense account kinds, immutable receipt settlements and expense attribution, protective hook against reusing settled receipts for coverage if that subsystem is installed.

No destructive automatic down migration. These files are development-only; this report is **not** approval to deploy them. Production writer/permission cutover and coexistence with all classification/coverage writers require an independent review; the disposable fixture does not prove that deployment prerequisite.

### Real PostgreSQL service integration

**22 service-level groups passed** in the final run. See `FINANCE-SERVICE-TEST-RESULT.json` and archive `work/finance-completion-f737d8b7-bf14-4c1f-b6db-7230178a30d1` for the exact check list. The runner creates a uniquely labelled internal network, an independently checked fresh PostgreSQL 17 cluster using tmpfs (no persistent volume, no published ports), and a separate Node worker. It calls actual TypeORM transactions, `FinanceService`, `FinanceEventsService`, `BankReceiptsService`, `PurchaseLinkageService`, `LotOperations` and `ReceiptSettlement` with synthetic test authorities. The application test role has no SUPERUSER/CREATEDB/CREATEROLE/replication, and cannot create or modify verified debt records.

Coverage includes penny/concurrent reserves, movement/release, transaction rollback, immutable transfer lineage, protected recipient funds, multiple-source/concurrent debt collection, multiple orders, receipt-without-finality and finality-without-receipt, all four ratios, duplicate/conflicting settlement, rollback of settlement/lot/outbox, separate paid expenses, rejecting reused expense evidence, pending refund policies and full ledger reconciliation. Final added checks reject a ledger-only reserved-balance bypass at commit and reconcile after expenses. No real merchant receipt, bank payment or partner callback is claimed.

Every test run removed only its positively identified owned disposable containers and empty labelled network. No volumes were created. Protected container IDs/images/start times/running states and persistent volume inventory remained unchanged. Earlier failed runs and redacted logs are retained as diagnostic evidence; only the final result is the passing release candidate. Disposable test images/archives remain eligible for separately reviewed cleanup; no broad deletion occurred.

### Checks and limitations

* Backend TypeScript: passed. Nest build: passed; explicit nonincremental `tsc -p tsconfig.build.json --incremental false` also passed to ensure complete emitted artifacts.
* Relevant strictly guarded offline backend tests: **251/251, 17 suites passed**.
* Complete source backend Jest run: **443 passed, 27 failed, 470 total; 31 suites passed, 26 failed**. All assertions ran. 24 failing scaffold suites omit required DI providers. Two assertions in `marketing-preferences.security.spec.ts` expect deleted-user JWT rejection, while the unchanged current JwtStrategy validates signature/payload without a user lookup. One `forum-read-access.spec.ts` public username-profile fixture returns 500 rather than expected 200. These are not hidden, skipped or weakened. The four-file release did not change JwtStrategy/forum profile implementation; `SECURITY_ACTIVE` describes the bounded release, not resolution of those broader failures.
* Complete backend tests use a separate guard: no child processes, database or external/active-service connections; HTTP mocks can use only ephemeral loopback servers owned by that same test process. The stricter finance-only guard remains unchanged. A first complete run under that strict no-network guard was blocked for HTTP-mock tests and is retained separately.
* Frontend TypeScript and production build: passed. Complete Jest: **208/208, 15 suites passed**. Existing build warnings remain in Register's control-character regex and emailValidator's unnecessary escapes. No production frontend change/deployment was needed.
* Full Jest runners reported open handles; final recorded runs use `--forceExit` after all assertions and JSON output. This is disclosed, not treated as a clean handle audit.
* Node syntax checks and `git diff --check`: passed.

## Remaining blockers, without guessed financial rules

1. Winning-order metric/group finality, ties, late higher orders and partial-return re-ranking are not sufficiently established. Orders/bonus consumption remain review-only; no double or excess bonus consumption can occur because that allocation is disabled.
2. Exact full-refund liability basis, partner reimbursement and fee allocation are unknown. No monetary reversal or new debt is inferred from a generic full-refund status. Partial-refund formula is also unresolved; evidence remains pending_review.
3. Multiple debts and contested source-slice priority are not assigned arbitrarily. Some recipient-debt transfer orchestration and future-cost recognition remain pending.
4. No production authority adapter, financial role/writer cutover, external partner/bank protocol or active seller-redirect integration has been enabled. Test-owned facts are not production evidence.
5. Complete backend regression suite is not green, including the deleted-user JWT expectation; positive password/email journeys and browser participation were not re-executed. These are explicit follow-up validation/security issues, not evidence of completed end-to-end operation.

## Files created/updated for this execution

Security tooling/evidence: `docker/historical/activate-legacy-security.cjs`, `compose.json` (backend image only), `SECURITY-ACTIVATION-RESULT.json`, `FINAL-SECURITY-RUNTIME-IDENTITIES.json`, this report and the archived release context. The four verified source fixes were already present; they were not blindly reapplied.

Finance additions: `src/finance/lot-operations.ts`, `receipt-settlement.ts`, migrations `1792510000000-AddIsolatedLotOperations.ts` and `1792511000000-AddIsolatedReceiptSettlement.ts`.

Test tooling: `docker/historical/finance-service-postgres.cjs`, `finance-service-scenarios.cjs`, `finance-full-suite-guard.cjs`, `jest.finance-full.json`, `FINANCE-SERVICE-TEST-RESULT.json`; logs/JSON under `work/`. Existing guarded test configuration and historical source backups are retained.

No active finance endpoints, active finance migrations, existing user balance adjustments, external messages/payments, PostgreSQL replacement or unrelated container restart occurred. Only the explicitly authorized backend security cutover changed a running application service.
