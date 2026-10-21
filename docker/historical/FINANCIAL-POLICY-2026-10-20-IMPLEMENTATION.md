# FINANCIAL_BUSINESS_POLICY_2026_10_20 — isolated implementation

Status: **FINANCIAL_POLICY_PARTIAL**. Report date: 21 October 2026 (Europe/London).

Owner approval: 20 October 2026, exact supplied request preserved in
`work/policy-2026-10-20-backup-2026-10-20T21-01-35-805Z/OWNER-APPROVED-POLICY.txt`.
Application Git baseline remains `03573b7f47ba3c04dc50312bc71e0a7b904c0ce7`.
This is source and disposable-database implementation, **not deployment authority or production readiness**.
FinanceModule remains outside AppModule. Production proof authority denies by default.

## Decisions and implemented interpretations

The existing receipt-backed 80/20 cashback, 50/50 passive income, separate platform expenses,
immutable balanced journals, canonical click/order attribution, provenance and non-expiry of
confirmed bonuses remain. One click may have several orders: one purchase bonus winner does
not prevent independently receipt-backed cashback on other orders. No arbitrary reservation TTL,
price-proportional refund, universal finality period or second bonus allocation was introduced.

| Approved decision | Implementation and practical limit |
|---|---|
| Q1 Complete group | Seller evidence must identify all canonical group orders, terminal completeness and applicable merchant finality before selection. A confirmation alone is insufficient. |
| Q2 Late higher order | Before application, new canonical orders, revisions or changed first-ingestion ordering invalidate the old selection and require reselection. After application, review only; original journal and single-allocation guard remain. |
| Q3 Cancelled winner, choice B | Verified selected-winner cancellation returns own reserved entitlement before use, or uses a linked counter-journal for reconciled consumed entitlement. Idempotent, no reassignment. Spent/unreconciled and gifted-origin coordination remain pending. This explicitly supersedes the older no-return interpretation. |
| Q4 Minimum cap | Eligible value is after discounts and excludes delivery/ineligible items. Use minimum of that value, reservation and every verified mandatory merchant cap. Unknown/incomplete restrictions are pending, not unlimited. Multiple-lot partial source choice remains pending. |
| Q5 Release unused/excess | Only after complete final calculation; own-lot excess returns atomically to the original available account. Exact lot age and lineage remain; no expiry. Cancellation is the separately verified Q3 exception. |
| Q6 Attribution | Immutable canonical source/order attribution. Conflicting proposals are recorded and block allocation rather than rewriting the original click. |
| Q7 Tie | Higher eligible value first. For ties, trustworthy placement times first; absent/untrusted placement falls back to first verified seller-message receipt for the whole tied set. Database UTC microseconds captured before asynchronous verification/actor-lock waiting; first message receipt survives retries and later versions. Indistinguishable evidence is pending, no ID/random tie-break. |
| Q8 Finality | Explicit merchant/order-specific versioned terms and finality, plus verified receipt before income settlement. No global 14/30-day substitute. |
| Q9 Full refund | Recover full original accrued customer cashback, less prior cumulative recoveries. Reconcile original sealed journal, receipt, lot and 80% basis first. Recover available original funds, create only remaining capped debt if paid/missing. Unknown payout holds block correction. Immutable linked corrections; platform share, expenses and merchant remittance remain separate. |
| Q10 Partial refund | Verified revised merchant commission in GBP, customer entitlement at 80%, HALF_UP pennies; recover only the difference. A commission of 501p produces 401p retained cashback and 399p recovery from 800p originally accrued. Later full refund adds 401p, not another 800p. Missing basis, bonus-specific ambiguity, upward correction of an already recovered target remain pending. |
| Q11 Expenses | Actual bank and transfer expenses use separate company expense journals. Customer fee debt requires explicit applicable approved terms and verified actual provider expense, capped and assigned once. No automatic fee deduction from customer principal or platform-share conflation. |
| Q12 Debt order | Earliest independently verified original confirmation timestamp first. Multiple debts work with distinct times. Unknown/equal times remain pending; no row-ID ordering. Incoming confirmed income offsets verified-priority debts before free availability. |
| Q13 Own sources/reserves | All free confirmed own bonus and monetary sources are considered. Reserves stay protected; only a separate verified atomic purchase recalculation can close/replace a reservation on the same lot and apply capped debt recovery. Ambiguous partial source-slice priority stays pending. |
| Q14 Linked/external | Only proven direct related FREE lineage can repay the originating obligation. Reserved, unrelated, distant or unverified chains are protected. External repayment needs a registered verified GBP bank receipt and owned capped debt; no declared-cash proof. Separate coverage-writer coexistence is blocked pending shared atomic coordination. |
| Q15 Six months | Six UTC calendar months per original lot, clamped month ends and leap years, preserving microseconds and original transfer age. Not 180 days. Below-£10 mixed mature/young grouping remains pending with auditable mature amount and dates. |
| Q16 Payout | Exact current principal-bound fee quote, verified recipient/provider/coverage, no debt, separate full company fee funding for both triggers. Atomic liability + physical principal-bank + fee holds; one unresolved attempt per owner. Unknown outcome cannot retry before verified reconciliation. Exact provider principal/fees checked. Failure restores full customer principal and charges only independently verified company expense. Simulator only; no payment network calls. |

## Changed files

New isolated source:

- `src/finance/owner-policy.ts`, `owner-policy.spec.ts`: strict money/time helpers, eligible value, ranking, refund targets, debt priority.
- `src/finance/policy-context.ts`: caller-transaction validation, proof authority, actor locking, immutable command/evidence records, ledger/outbox reuse.
- `src/finance/policy-purchase.ts`: ingestion, selection, bonus application and winner cancellation.
- `src/finance/policy-debt-refund.ts`: customer corrections, capped debts, collections, related recovery, external receipts, expense liability, reservation recalculation.
- `src/finance/policy-payout.ts`: atomic holds and simulated/reconciled outcomes; server database clock by default, explicit isolated clock injection in tests only.
- `src/finance/migrations/1792530000000-AddOwnerPolicyRecords.ts`: policy/debt evidence and consumed reservation state, immutable-record protection. Applied **only to disposable test PostgreSQL**.

Existing isolated source adaptations:

- `src/finance/payout-policy.ts`: additive explicit calendar-policy eligibility; original default gates retained.
- `src/finance/receipt-settlement.ts`: canonical attribution-conflict gate and verified oldest-debt allocation for incoming income.
- `docker/historical/finance-service-scenarios.cjs`, `finance-service-postgres.cjs`: retain the original 33 scenarios and add the owner-policy migration/test module to disposable execution.
- `docker/historical/owner-policy-scenarios.cjs`: synthetic authority/provider scenarios, concurrency, rollback and global ledger reconciliation.
- `docker/historical/FINANCE-SERVICE-TEST-RESULT.json`: final isolated result.
- `docker/historical/financial-policy-2026-10-20-source-manifest.json`: exact source hashes and unchanged original 43-file evidence.
- This report.

No frontend, active Compose, AppModule, authentication/security release or live financial route changes were made for this task.

## Verification

Complete backend source suite uses `docker/historical/jest.finance-full.json`: all `src/**/*.spec.ts`,
no selected-test filtering. The guard blocks database/process access and allows HTTP tests only
against their own ephemeral loopback servers. Baseline 496 retained; 15 new policy unit assertions.

- Backend Jest: **511/511, 60 suites PASS**; `work/owner-policy-backend-jest-verified.json` and matching log. Natural exit; no reported backend open handles.
- Backend TypeScript: `npx tsc --noEmit --incremental false` PASS.
- Backend production build: `npm run build` and `npx tsc -p tsconfig.build.json --incremental false` PASS.
- Frontend complete Jest: **208/208, 15 suites PASS**; `work/owner-policy-frontend-jest.json` and log.
- Frontend TypeScript and production build PASS; `work/owner-policy-frontend-build.log`.
- Existing frontend open handle: one **SiteSearch TCPWRAP**, originating from `fetch(search-index.json)` under jsdom. Reported separately, not fixed by changing unrelated frontend behavior and not hidden by weakening assertions.
- Node syntax: both existing integration scripts and new owner-policy scenario script PASS.
- `git diff --check` PASS; existing Git LF/CRLF warnings are not whitespace errors.
- Final isolated PostgreSQL: **65/65 scenario groups PASS**, including every original 33 group. See `FINANCE-SERVICE-TEST-RESULT.json` for exact names and generated archive/cluster identity. Includes actual ledger writes for full/partial corrections and simulated payout, not just pure function mocks.

`fullRefundPosted:false` in the result retains the legacy raw-lifecycle observation flag:
raw lifecycle observations still do not post corrections. The additive fields
`ownerPolicyFullRefundPosted:true` and `ownerPolicyPartialRefundPosted:true` identify the
new separately authorized policy-service corrections exercised in isolation.

An unintended unscoped default Jest invocation also discovered archived `work/` copies and
obsolete `docker/local-registration` tests; it is not the source-regression result above and is
not represented as passing. Its log is `work/owner-policy-backend-jest-final.log` (the older JSON
at that stem is not authoritative). Process inventory via Win32_Process returned Access denied;
no elevation, alternative process lookup or process termination was performed to bypass it.

## Remaining decisions and integration blockers

1. **Partial source-slice priority.** Q12 orders debts, not the source lots used to pay them.
   When several age/origin/condition-distinct sources exceed a needed amount, which source is
   consumed first (also for a partially capped multi-lot purchase and original multi-source refund)?
   No FIFO/LIFO/pro-rata rule was invented. Whole-source/all-required cases work; ambiguous partial cases remain pending.
2. **Mixed-age below-£10 payout.** Q15 establishes per-lot dates but explicitly leaves grouping
   undecided. Pay only matured portions, wait for the whole eligible balance, or another grouping?
   Current result exposes matured amount and milestones without creating a hold.
3. **A merchant revises remaining commission upward after recovery.** Ordinary partial/full
   formulas are implemented. If cumulative recovery must decrease, first cancel outstanding debt,
   restore already recovered funds, or allocate proportionally? Which original source receives a
   restoration? Until approved, a decreasing recovery target is pending.
4. **Gift cancellation/release coordination is an implementation blocker, not a missing permission
   to ignore Q3.** Returning a gifted lot must atomically coordinate the originating debtor check
   and any proven Q14 recovery without exposing free funds in between. The present purchase
   adapter fails closed for cross-owner parent lineage. Separate direct-free-chain recovery works,
   but composing it after a release in another transaction would be unsafe. Existing approvals are
   sufficient to implement that atomic coordinator; no new financial rule is claimed necessary
   unless the above source-slice priority becomes relevant.
5. **Coverage/repayment writer coordination is an implementation blocker.** Verified external
   receipt repayment works in the isolated policy schema, but is pending whenever a separate
   coverage-allocation table exists. A shared transaction/lock and immutable allocation protocol is
   required before coexistence; an empty-row check alone could race. This needs engineering and
   regression verification, not permission to reuse already reserved money.
6. Production authority adapters, authoritative seller finality/caps/receipt evidence, actual
   provider reconciliation and separately verified merchant/platform obligations are not supplied
   by this disposable simulator. Customer recoveries are credited to explicit clearing, not
   represented as completed merchant remittances or platform income. Later integration requires
   independent evidence and separate authorization; no production migration or route is ready to enable.

Thus the 16 decisions resolve the ordinary winner/refund/debt/calendar cases but do not specify
all partial source/grouping/reversal combinations. The explicit fail-closed integration blockers
also prevent an honest claim that all 16 rules are completely implemented in every combination.

## Preservation and rollback evidence

Backup: `work/policy-2026-10-20-backup-2026-10-20T21-01-35-805Z`.
Existing runner/scenario bytes and receipt-settlement source were preserved with hashes.
The additive payout-policy backup was reconstructed by reversing its small patch and verified
against the previous `financial-lifecycle-source-manifest.json` hash; it is not described as a
pre-edit copy. All earlier rollback/security artifacts remain.

`financial-policy-2026-10-20-source-manifest.json` verifies **43/43 original restored core files
unchanged**. New code reuses the existing immutable ledger, transaction manager, outbox, lots,
receipt and canonical linkage infrastructure rather than creating another live finance system.

The disposable runner verifies Docker daemon/context, captures every existing container's exact
ID/image/start time/running state, rejects protected PostgreSQL cluster IDs, and requires a new
empty schema before applying test migrations. PostgreSQL uses tmpfs, no published ports and no
persistent volumes. Final checks confirm existing container identities/state and persistent volume
inventory unchanged. Only exact run-labelled disposable containers and their empty internal
network are removed. Test images and evidence archives are retained; no broad cleanup.

Protected active backend remains `ced2bf78f14226db06e758edb4cd7d1d9d99289e0ad4d89e4b6bc55cc6826c8a`,
security image `sha256:ff1f7c5ffebb7d0850403e49e5ea9c61612eee3fb63c139cc86858a83b5bb337`.
Frontend remains localhost:3004, backend 127.0.0.1:3006. Neither was rebuilt/restarted.
Historical PostgreSQL cluster `7698666936429441062` and DB `cashback_historical_03573b7` were not
used by the isolated runner. No live financial migration, schema synchronization, balance write,
payment/provider call, financial endpoint exposure or customer-data reset was performed.
Container identity preservation is evidence of no test-induced service replacement/restart;
it is **not** a claim to have audited every concurrent customer database change.
