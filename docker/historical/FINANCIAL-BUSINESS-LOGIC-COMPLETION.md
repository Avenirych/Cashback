# Purchase, refund, debt and payout completion

20 October 2026. **FINANCIAL_BUSINESS_LOGIC_PARTIAL**.

The current verified implementation was extended in isolation. No historical recovery, security redeployment, financial endpoint activation, active database migration or real payment was performed. Full monetary refunds, final winning-order allocation and ambiguous debt priorities remain unresolved; this is not a completed financial purchase/refund workflow.

## Authority and recovered rules

Reviewed the five requested historical/reconciliation/security reports, current `src/finance`, `work/BUSINESS_SPEC_6B_FINAL.md`, `work/business-architecture-6v3-8c953bc583334a22b98d954a5ad94ca9.md`, and relevant `finance-6v5-*` evidence/coverage/integration/readiness records. Existing approval labels apply to their specific decisions, not automatically to the entire FINAL document. Architecture/design records do not create approval for their unresolved policy questions. No newer sufficiently explicit approved refund formula, winning metric, tie rule, debt ordering or calendar algorithm was recovered from those materials.

| Rule and exact source | Applied interpretation |
|---|---|
| Latest owner task, §§2–8; spec §2.1 B01–B06 and §13 B45 | Actual merchant receipt AND applicable finality are required. Every eligible partner order can independently earn 80/20 cashback. Confirmation alone is insufficient. |
| Spec §13 B46–B49, owner amendment 14 October 2026 | One bonus application to the highest eligible order; common verified comparison basis, adequate reporting evidence, no invented tie/late/cap/release rules. Q13 explicitly leaves these details unresolved. |
| Spec §2.9 B12/B12a, Q08 | Applied bonuses do not automatically return to available on clawback; cap obligations and prevent repeat recovery. Exact full merchant liability, fees/platform portions, timing and partial formula remain unknown. |
| Spec §2.10 B13–B15 and §8 B21–B25 | Debt uses all eligible confirmed own monetary funds, before payout availability; recipient reserves/consumed and unrelated funds protected. Original sender responsibility retained. Q09 leaves multiple obligations/restricted-slice ordering unresolved. |
| Spec §14 B52/B57/B58, owner amendment 14 October 2026 | Confirmed GBP liabilities do not expire; transfer/release does not reset original age; protected reserves excluded from payout. This supersedes older expiry wording. |
| Spec §14 B54/B55/B56 | £10 trigger and later six-calendar-month trigger, full principal to customer, separate platform fee, preserve liability on failed/unavailable payout. |
| Spec §16 B64/B65, later explicit amendment in the same approved rule record | **Both triggers** require principal strictly greater than the full fee, separate free own fee funding, covered principal, no debt/restrictions, provider/recipient/security/budget gates and reconciliation of unknown previous outcome. This supersedes §14.1 T25's earlier fee-comparison scope limited to the age trigger. |
| Spec §15 B61/B62 and §17 B66 | Positive margin applies to admitting new economic operations, not writing off existing user obligations when payout is unavailable. Payout evaluation does not repeat revenue split or turn liabilities into income. |

No refund period, VAT/delivery ranking basis, FIFO/LIFO, proportional refund, calendar timezone or provider tariff has been invented.

## Implemented purchase and refund evidence orchestration

New `PurchaseLifecycle` joins an active caller-owned TypeORM transaction and requires a trusted authority; its default denies execution. It verifies canonical order ownership against existing click/order linkage. It records immutable source/event identity, canonical order version, eligibility, amount/metric evidence, group-finality reference, cancellation/full/partial-refund kind, positive refund amount where applicable and whether the supplied evidence says the original payout was paid/not-paid/unknown. No customer-provided boolean authenticates an event. Synthetic authorities remain only in test tooling.

Canonical source-event replay is idempotent. Changed material under the same event conflicts; a different event cannot overwrite an occupied canonical version. Late older versions remain in history without superseding a newer observation. Review snapshots include all known orders in the click, their latest versions and hashes. Event, review and money-service work share caller transaction rollback.

The existing highest-order comparator is reused. Missing metric/group completeness/finality and ties persist `pending_review`. When a unique highest comparison is mechanically determinable under **synthetic test** metric/finality evidence, it is stored only as `provisionalHighestOrder`: the result still says pending_review because the real Q13 metric/cap/release decisions are not approved. This is not a final winner or a bonus debit. Cancellation/refund history keeps the group in review even if a later generic update arrives; no silent reinstatement/re-ranking of money occurs.

Reservations, excess, original conditions and dates remain intact. No arbitrary TTL or automatic release was introduced. Existing verified failure release, partial reservation, move, lineage and debt services are retained. Each separate order's verified receipt can still receive its own cashback settlement; bonus nonduplication does not discard other customer cashback.

### Settlement safety added

`ReceiptSettlement` now checks recorded correction evidence under the existing shared actor lock, after verifying the cashback order owner. In the new isolated lifecycle schema, an already recorded cancellation/full/partial refund blocks a new positive settlement with `ORDER_CORRECTION_REVIEW_REQUIRED`, even if its trusted adapter supplies stale positive finality facts. It leaves the receipt unallocated and records a pending command; a newer generic order update cannot clear the correction. Previously completed immutable journals are not changed or reversed by replay.

The evidence-table guard is additive and conditional for compatibility with the pre-lifecycle isolated schema; it is **not** certification for deploying settlement without the new migration/authority review. The existing 22 scenarios remain intact. No old functioning implementation was replaced with a historical version.

## Full and partial refund status

Full refund evidence before and after a reported payout, cancellation evidence and partial refund evidence are now versioned, immutable and tied to the real canonical order identity. Duplicate/conflicting callbacks and transaction rollback are tested. A full/partial status or reported refund amount alone **does not** authorize a reversing journal, seller payable, new customer debt or platform income correction.

Q08 does not establish the exact merchant obligation, who bears platform/fee portions, treatment after payout or the partial formula. Thus **no new monetary refund correction was implemented**. There is no silently assumed proportional calculation. Existing journals and liabilities remain untouched; source/refund evidence and pending reviews allow later approved processing. Tests asserting no financial posting are evidence of this safe block, not tests of a working bank refund.

## Debt behavior retained and verified

The existing collector remains transactionally serialized with incoming settlement/reservation operations. It uses eligible free confirmed own bonus and withdrawal-GBP lots, caps recovery by the verified outstanding obligation, records immutable journals/commands, and prevents replay/overcollection. A single incoming settlement offsets its verified debt before exposing its remainder, preserving B15/B24. Existing partial repayment, transferred origin/responsibility and narrowly verified origin-linked recovery are retained.

Multiple outstanding debts or competing existing source slices needing an unapproved priority stay pending_review. Recipient reserves, consumed amounts and unrelated funds remain protected. Automatic reduction of the debtor's own purchase reservation under B14 requires the still-missing safe purchase recalculation/limited-slice authorization orchestration; it is not claimed implemented by the free-lot collector. External own-payment channel and multi-hop policy beyond the existing explicitly authorized recovery cases are not invented.

## Automatic payout policy

New `evaluatePayout` is an **internal pure evaluation**, not authentication, an atomic hold, payment job or external payout. It requires independently verified facts from a future trusted caller. It implements the established £10 trigger and common B64/B65 gates, rejecting unknown fee, principal ≤ full fee, insufficient separate platform fee funds, debt, restrictions, uncovered/conflicting funds, budget/provider/recipient failure and prior outcome_unknown. Customer principal is returned unchanged; platform fee is separate. Unknown inputs do not become zero/true defaults.

Below £10, it returns `SIX_CALENDAR_MONTH_POLICY_Q14_REQUIRED`. The six-month rule is recorded as approved, but no 180-day approximation, month-end/timezone guess or fake aged transfer date is implemented. No payout claim/hold, scheduler, Wise/bank call, notification or fee deduction is created. Production adapters and calendar evaluation remain absent; eligibility_evaluation_only is not permission to send money.

## Files and prepared migration

* New `src/finance/purchase-lifecycle.ts`.
* New `src/finance/payout-policy.ts` and `payout-policy.spec.ts`.
* New `src/finance/migrations/1792520000000-AddPurchaseLifecycleEvidence.ts`: append-only canonical order events and review snapshots; immutable update/delete/truncate protection, unique source-event and canonical version, existing order/click foreign keys. No destructive automatic down.
* Updated `src/finance/receipt-settlement.ts`: correction-history gate only.
* Updated `docker/historical/finance-service-scenarios.cjs`: retained original 22 cases, added 11 lifecycle/payout/concurrency groups; migration list extends only disposable test setup. Existing runner architecture is reused.
* Test-only `cashback-frontend/src/pages/RegistrationOnboarding.test.tsx` and `src/components/ExtendedRegistration.test.tsx`: batch synchronous field changes with React `act`, reducing redundant form rerenders. All original assertions, input values and five-second timeouts remain unchanged; submission still occurs after field state is flushed.
* This report, source manifest and test-result evidence under `work/`. No frontend production, security configuration, AppModule, deployment script or active Compose change.

Existing changed files were verified/copied before editing under `work/financial-lifecycle-backup-2026-10-20T20-17-55-535Z`; `receipt-settlement.ts` was additionally archived there before its change. Previous project backups, security images and stopped rollback containers are retained.

## Verification

Final detailed results: `work/financial-lifecycle-postgres-result.json`, `FINANCE-SERVICE-TEST-RESULT.json`, final backend/frontend Jest JSON/logs and production-build output referenced in the validation record below.

* **33/33 real PostgreSQL service-level groups passed**, extending and retaining all original 22 scenarios. Disposable cluster and tmpfs storage only, restricted `finance_app` role, internal network, no published ports or persistent volumes. Actual services/EntityManagers/transactions are used; no real approved partner/bank facts are claimed from synthetic fixtures.
* Added cases: missing/incomplete evidence, uniquely highest provisional comparison, ties, late higher order, cancelled winner, late older versions, refund evidence before/after reported payout, partial refund without invented math, replay/conflict, full event/review rollback, independent cashback on two orders of one click, payout evaluation, concurrent reserve/settlement/collection with explicit conservation, stale positive settlement after correction.
* Every test run verifies protected container IDs/images/start times/running states and persistent volume inventory; removes only exact owned disposable containers and the empty labelled network. No volumes created or removed. Final test archive: `work/finance-completion-4bb7d990-9049-445b-a11b-630641555bfc`.
* Backend baseline 483 tests is retained, with 13 additional payout-policy assertions: **496 tests / 59 suites**. Backend TypeScript and production build, including explicit nonincremental emitted artifacts, pass.
* Frontend production source is unchanged. TypeScript and production build pass with preexisting Register/emailValidator warnings. Initial runs had 207 passed/one five-second timeout, first in onboarding and then ExtendedRegistration; logs are retained. Two test input sequences were batched to avoid redundant rerenders, without changing assertions/timeouts. Final full sets were rerun sequentially; final counts are recorded below.
* Existing frontend SiteSearch test TCPWRAP is reported separately, as in the prior regression report. No new backend open handle was observed. Node syntax and git diff --check are run for final artifacts.

Final complete-suite record: `work/financial-lifecycle-backend-jest-final.json` has **496/496 passed, 59/59 suites, zero detected handles**, natural backend Jest exit. `work/financial-lifecycle-frontend-jest-final.json` has **208/208 passed, 15/15 suites**, with the existing single SiteSearch TCPWRAP separately disclosed; that frontend runner uses forceExit after assertions. TypeScript checks pass for both trees. Final frontend production-build output is `work/financial-lifecycle-frontend-build.log`. No failure was skipped or timeout increased.

Protected service evidence: `work/financial-lifecycle-protected-identities.json` confirms the same four active historical service identities/images and retained stopped rollback backend. Active security backend remains `ced2bf78f14226db06e758edb4cd7d1d9d99289e0ad4d89e4b6bc55cc6826c8a`, image `sha256:ff1f7c5ffebb7d0850403e49e5ea9c61612eee3fb63c139cc86858a83b5bb337`. All 43 originally restored finance source hashes are unchanged; the intentional newer ReceiptSettlement guard is recorded separately in `financial-lifecycle-source-manifest.json`. JWT security source hash is unchanged. The active security configuration and rollback artifacts were not rewritten.

## Unresolved decisions requiring explicit owner approval

Each row gives the exact question, existing authority, missing information, consequence and current behavior. No unanswered row is represented as implemented financial policy.

| Exact question | Approved rule / missing decision | Consequence of guessing | Enforced behavior |
|---|---|---|---|
| Which partner amount, discounts, VAT, delivery and excluded items define highest value? | B46/B47; Q13.1 explicitly has no approved net/gross/paid basis. | Wrong winner spends another order's bonus entitlement. | Metric absent → pending; synthetic comparator result is provisional only. |
| What proves the group complete and when does finality occur? | B47; Q01/Q07/Q13.2 leave partner windows/reporting delay and terminal evidence open. | Early allocation misses late orders or unfinalized return risk. | No universal TTL; incomplete/unfinalized group pending. |
| Which equal-value order wins? | B49, Q13.3: timestamp/order-ID tie-break not approved. | Arbitrary winner can consume protected value incorrectly. | Ties pending; no money. |
| What is the bonus cap and exact time/permission for releasing excess? | B48, Q13.4/Q05. | Excess may be consumed or released for reuse/debt without authority. | Entire affected reserve protected; no guessed cap or excess release. |
| What happens to a cancelled winner or later higher-value order? | B49/B50, Q13.6. | Double application or loss after finalization. | Immutable versioned evidence; unresolved correction prevents monetary re-ranking. |
| How do partial returns/price changes affect rank and applied bonus? | B49; Q08/Q13.5 contain no proportional formula. | Wrong cashback, bonus clawback or debt. | Pending evidence, no recalculation/posting. |
| How are repeated clicks, attribution reassignment and group boundaries handled? | B45/B46; Q07/Q13.7. | One order may receive two allocations. | Existing canonical order/click identity cannot be overwritten; reassignment needs review. |
| What exact return window and eligibility proof applies? | Actual receipt+finality mandatory; Q01/Q08 provide no numeric window/basis. | Premature available cashback or wrongful refund. | Trusted finality required; no invented deadline. |
| What is the full merchant reimbursement amount and customer liability, especially after payout? | B12/B12a; Q08 leaves liability basis and after-Wise treatment open. | Customer could wrongly bear all platform/merchant obligations. | Full-refund evidence before/after payout recorded; no new debt or reversal. |
| How are platform portion, banking/transfer fees and excess applied bonuses corrected on refund? | B12, Q08; separate fees/liabilities remain mandatory. | Over-recovery or underfunded merchant obligation. | No inferred allocation; immutable original journals retained. |
| What exact partial-refund formula is approved? | Q08/Q13.5; no recovered explicit formula. | Invented prorating misstates liabilities. | Partial monetary correction disabled. |
| What priority applies to several debts and competing existing source slices? | B23/B24 require all eligible own sources and debt first; Q05/Q09 do not select FIFO/LIFO/pro-rata. | Different origin slices/creditors could be charged arbitrarily. | Collector keeps ambiguous allocations pending. |
| Which restricted amounts/own reservations can be reduced and how is the purchase recalculated? | B14 permits atomic reduction with recalculation; Q09 leaves special eligibility/UX and Q13 leaves cap/allocation details. | Reservation ledger could diverge from purchase or protected recipient amounts. | Free-lot collector does not consume reserved funds; unsupported restricted cases pending. |
| Which multi-hop origin recovery and external self-payment channel are authorized? | Original sender B09/B10/B50; Q06/Q09 leave wider cases/channel/cancellation open. | Unrelated recipient money or the same slice could be seized. | Only existing explicitly verified/capped linked free-lot recovery; no new channel. |
| Which timezone, month-end and missed-milestone catch-up define six calendar months? | B54/B57 and Q14. No 180-day substitution. | Premature/delayed payout or reset age on transfer. | Below-threshold age decision blocked; original dates preserved. |
| What verified provider fee quote lifetime, minimum/capability and retry/reconciliation policy applies? | B55/B56/B64/B65 and Q10–Q12/Q14. | Duplicate/unsupported payment or customer fee deduction. | Unknown outcome reconciled first; missing full verified fee/provider facts block evaluation; no payment. |

## Active website preservation

No active PostgreSQL connection or financial schema write was used for this task. No customer balance/account reset, external money/message, active backend replacement, frontend/PostgreSQL/Mailpit restart, security-config change or protected resource deletion occurred. FinanceModule remains disconnected, financial endpoints remain absent, and synchronize/automatic migrations remain disabled. Existing active security backend and its rollback artifacts are preserved; runtime ownership evidence is recorded separately below. URLs remain http://localhost:3004/ and http://127.0.0.1:3006/.
