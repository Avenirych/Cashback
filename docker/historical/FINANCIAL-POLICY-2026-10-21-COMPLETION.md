# Financial policy and atomic integration — 21 October 2026

**FINANCIAL_POLICY_COMPLETE_IN_ISOLATION**

Policy: `FINANCIAL_POLICY_2026_10_21`. Application baseline remains
`03573b7f47ba3c04dc50312bc71e0a7b904c0ce7`. No deployment or activation was performed.
This result describes internal services exercised with independently controlled synthetic
authorities and real disposable PostgreSQL transactions. It does not certify live banking,
merchant evidence, provider connectivity, production readiness or a production migration.

## Authority and the three new decisions

The 21 October approval supplements the 16 decisions from 20 October, taking precedence
only within its stated scope. The exact request is preserved with the targeted backup.

1. **PARTIAL_LOT_SELECTION_FIFO_V1** — earliest original verified confirmation first.
   Consume a partial final lot atomically through its existing ledger accounts; preserve
   original lot identity, parent, responsibility and confirmation precision. An equal-date
   group can be consumed wholly or left untouched; a materially ambiguous partial choice
   returns `pending_review`. UUID, insertion order and callback arrival are not economic ties.
2. **SIX_MONTH_MATURE_LOTS_ONLY_V1** — below £10, only individually mature free eligible
   portions form the six-month payout principal. £4 mature plus £3 young holds £4 and leaves
   £3 untouched. Original UTC calendar arithmetic, month-end clamping, leap years and
   microseconds remain. The £10 trigger still considers the complete eligible set under
   its existing rules. Both triggers retain every ownership, debt, coverage, restriction,
   recipient/provider, exact quote and separately funded full-fee gate.
3. **RECOVERY_TARGET_DECREASE_V1** — reduce unpaid outstanding debt first, then restore
   only actually recovered excess. Distinguish outstanding, collected and previously restored
   amounts using immutable journals and source allocations. Restore original owners and
   source ages; active reservations and gifted-origin uncertainty remain in an explicit
   owner-specific restricted holding rather than becoming unrestricted free money.

No new refund period, monetary split, commission formula, fee liability or remittance
permission was inferred. Integer GBP pence and the existing HALF_UP rounding are retained.

## Mapping to the previous 16 decisions

| Previous rules | Result under policy21 |
|---|---|
| Q1, Q2, Q6–Q8 | Existing complete-group, canonical attribution, highest eligible value, trusted placement/first verified seller-receipt tie, late-winner review, receipt and merchant-specific finality remain. Ranking/eligible-value code was not replaced. |
| Q3 | Cancelled winning entitlement returns without automatic reassignment, including direct gifted origin. Return and proven linked recovery now share one transaction and one journal plan. |
| Q4–Q5 | Merchant caps remain mandatory. FIFO selects the consumed part of multi-lot reservations; excess returns to the exact original lots only after the existing finality/completeness conditions. |
| Q9–Q10 | Full accrued customer cashback recovery and partial revised-commission 80% HALF_UP formulas remain. A later smaller cumulative target now reduces unpaid debts then restores proven collected sources; later full refunds add only the new difference. |
| Q11 | Actual company expenses, customer liabilities and clearing remain separate. No inferred buyer fee, merchant remittance or platform income. |
| Q12–Q14 | Earliest verified debt confirmation still orders debts; FIFO now orders eligible funding slices. Own/free, origin, reservation and direct-chain restrictions remain. External repayment shares receipt capacity with coverage. |
| Q15–Q16 | Original six-calendar-month lot age remains across transfer; mature-only below-£10 grouping is implemented. Atomic principal/bank/fee holds, immutable attempt, reconciliation of unknown outcome and liability-preserving failure remain. |

Policy21 is selected by the internal `PolicyContext` policy argument. Policy20 compatibility
remains for historical replay/testing; it is not an automatic fallback from failed policy21
validation. Command hashes bind the policy version. No public request can configure the
authority or policy. Both versions deny by default without a trusted authority; neither is
connected to AppModule or an HTTP financial endpoint.

## Implementation and changed files

New source:

- `src/finance/policy-2026-10-21.ts`: shared FIFO planner, immutable source objects, precise
  time comparison and whole/partial equal-date ambiguity handling.
- `src/finance/policy-2026-10-21.spec.ts`: eight additional FIFO regression tests.
- `src/finance/policy-gift.ts`: entitlement-return destination planning, direct lineage and
  complete linked-debt verification, capped origin recovery and immutable source records.
- `src/finance/policy-coverage.ts`: trusted, owned, idempotent coverage release.
- `src/finance/migrations/1792540000000-AddPolicy21Allocations.ts`: additional approved policy
  identifier and immutable recovery/restoration slices. Foreign keys, NULL-aware uniqueness,
  source ownership and source/debt posting-amount checks prevent fabricated allocations.
- `src/finance/migrations/1792541000000-CoordinateCoverageRepayment.ts`: immutable coverage
  releases and unique receipt repayment claims, ownership checks, shared stable-anchor
  capacity enforcement, actual receipt/debt journal and current bank-proof reconciliation.

Changed existing isolated source:

- `policy-context.ts`: explicit approved version, shared outer coordination lock and
  policy-bound idempotency, retaining caller-owned transactions and default-deny authority.
- `policy-purchase.ts`: FIFO group reservation/application, partial-lot excess release,
  gifted release planning and atomic winner cancellation.
- `policy-debt-refund.ts`: FIFO collection/refunds/reservation recalculation, exact source
  tracking, cumulative downward correction and shared external-repayment claims.
- `policy-payout.ts`: mature-only principal, separate total/mature/young balances and next
  maturity, exact principal-bound quote and retained hold/outcome behavior.
- `coverage.service.ts`: existing CoverageService uses active allocations after immutable
  releases and includes committed receipt repayments in capacity; trusted mandate/evidence
  checks and full-target requirements remain.
- `bank-receipts.service.ts`, `receipt-settlement.ts`: acquire the shared outer gate before
  bank/actor/funding locks. Settlement recognizes wholly released coverage, rejects existing
  repayment/active coverage, and retains the reciprocal settled-receipt coverage guard.

Test/evidence files:

- `docker/historical/policy21-scenarios.cjs` — new real PostgreSQL scenarios.
- `docker/historical/finance-service-scenarios.cjs`, `finance-service-postgres.cjs` — append
  the new scenarios to the existing runner/image context; no old assertion removed.
- `FINANCE-SERVICE-TEST-RESULT.json`, `financial-policy-2026-10-21-source-manifest.json`,
  `POLICY21-PROTECTED-RESOURCES.json`, and this report.
- `work/policy21-protected-check.cjs` — read-only, sanitized Docker identity verification.

No frontend business source, historical Compose configuration, active security release,
authentication behavior, live database or financial API wiring was changed.

## Atomic behavior

### FIFO and restoration

Only eligible existing available balances are candidates. Reserved/consumed values are not
silently added to free balances. A separately verified purchase recalculation may reduce its
own reservation group FIFO, close old reservation records and create remaining reservations
on the same lots in the same transaction. Unrelated obligations remain protected.

Recovery slices identify journal, debt/order, lot, account, direction and exact pence. Debt
collection maps source debits to the actual debt credits. Refund corrections reconcile the
original sealed settlement and receipt before changing customer entitlement. Downward
revision requires `net actually collected + still outstanding = prior cumulative target`.
Debt reductions are correcting entries, not collected cash. Restoration never erases history.

Proven policy20 source associations can be imported from their immutable journals. Ambiguous
historical many-source/many-debt pairing is not retroactively invented. It stays pending if
the exact original pairing cannot be proven, as the approval explicitly requires. Likewise,
an external repayment without reconcilable original monetary owner/source is not fabricated
into a new confirmed customer lot.

### Gifted cancellation

Verified origin IDs are collected before customer locks, sorted with the recipient, and
locked inside the shared caller transaction. The helper checks actual immutable direct
parent/responsible/origin relationships, the complete verified linked-debt set, caps and
debt confirmation priority. Distant/unverified chains remain restricted and pending.

All destinations are planned before posting: the restored entitlement is credited directly
to eligible originating debt accounts and the remaining original recipient lot. There is no
committed free balance between release and recovery. Consumed entitlement must reconcile
exactly; active reservation releases cannot consume other reservation amounts. Unrelated
recipient funds are untouched. Outer failure rolls back journal, debt, reservation, source
records and command together. Returned value restored later to a foreign original owner is
credited to that owner, with restrictions retained.

### Coverage and repayment

All participants use existing advisory gate `726405/0` before narrower locks. Actor locks
are deterministic; funding-lot rows are stable receipt anchors even when no allocation row
exists. Receipt recognition and settlement follow the same outer order, preventing an
actor/funding lock inversion when operations are composed. Ledger account locks remain sorted.
This deliberately serializes the isolated coordination domain rather than assuming absence
of a competing row is proof of capacity.

Both service paths and database INSERT guards enforce:

`active coverage + committed repayment <= verified receipt funding capacity`.

Release history is appended, not deleted or rewritten. New coverage can reuse actually
released capacity. Repayment claims require a unique receipt, exact sealed unallocated-funds
debit/debt credit and current eligible bank evidence. Revocation and competing writers share
the coordination gate. Repayment replays cannot double book a receipt. Income settlement
and coverage remain mutually protected; clearing is not a claim of merchant remittance.

## Executed validation

| Check | Actual result |
|---|---|
| Complete backend source Jest | **519/519 PASS**, 61 suites; prior 511 retained, eight FIFO tests added. Zero reported backend open handles; natural successful exit. |
| Backend TypeScript | PASS, `npx tsc --noEmit --incremental false`. |
| Backend production build | PASS, `npm run build`, followed by full `tsconfig.build.json` emission with incremental disabled. |
| Complete frontend Jest | **208/208 PASS**, 15 suites. Existing SiteSearch TCPWRAP reported separately. |
| Frontend TypeScript | PASS. |
| Standard local frontend production build | PASS with existing ESLint warnings, `CI=false npm run build`. No frontend source was changed to conceal them. |
| Strict CI frontend build attempt | **FAIL**, because `CI=true` treats the existing Register control-character regex and emailValidator unnecessary-escape warnings as errors. This is a separately reported pre-existing frontend CI issue, not represented as passing. |
| Disposable PostgreSQL | **97/97 scenario groups PASS**: all original 65 plus 32 policy21 groups, actual transactions/locks/constraints/ledger writes. |
| Node syntax and git diff whitespace | PASS. |

The original 65 scenario names and order are SHA-256 checked before any policy21 test:
`15ad3aa35545574cc4351c604da0339affbfc9f36b4bc40d77e5b0d03f4bb54d`.
The prior result is copied into the targeted backup. Existing unit assertions and the 65
historical groups were not removed, skipped, relabelled as obsolete or weakened.

PostgreSQL coverage includes FIFO oldest/partial/tie/transfer/replay/concurrent reservation;
mixed-age principal, young-only/all-mature/fee/£10 gates, unknown outcome and concurrent holds;
unpaid/partly/fully collected debt corrections, multiple sources, restrictions, sequential
revisions/later full refund, replay/conflict and concurrent correction; gift return before
and after use, origin debt/no debt, unrelated recipient protection, distant chains, rollback
and visibility from another connection; first-row coverage races, partial repayment, release
and repayment in one rollback, reuse of released capacity, owner constraints, revoked bank
evidence and final full-ledger/coverage reconciliation. Earlier calendar/leap-year, transfer,
provider amount/fee mismatch and liability-preserving failure cases remain in the 65 baseline.

Logs/results: `work/policy21-backend-jest.{json,log}`, `policy21-ts.log`,
`policy21-backend-build.log`, `policy21-frontend-jest.{json,log}`,
`policy21-frontend-ts.log`, `policy21-frontend-build.log` (strict CI failure),
`policy21-frontend-production-build.log` (successful local production build),
`policy21-postgres.log`, and `docker/historical/FINANCE-SERVICE-TEST-RESULT.json`.

Intermediate failures were retained, not counted as passes: evidence-control migration exposed
an insufficient older synthetic receipt fixture; a released-income test initially used the
old runner's unregistered proof reference. Fixtures now use the actual EvidenceService,
BankReceiptsService and correctly bound settlement authority; no constraint was disabled.
An independent resource check initially compared saved NetworkSettings ports with HostConfig
bindings; it was corrected to compare the exact saved field, including unpublished ports.

## Preservation, remaining gates and production boundary

Verified targeted backup:
`work/policy-2026-10-21-backup-2026-10-21T08-05-28-613Z`.
Ten pre-edit files, original source manifest, owner approval and previous 65-group result
are preserved. Additional files were backed up immediately before their first edit. Final
source checksums are in `financial-policy-2026-10-21-source-manifest.json`.

Every disposable run validates daemon/context and snapshots all pre-existing container
ID/image/start-time/running states and persistent volume inventory. The test PostgreSQL is
fresh, empty, tmpfs-backed, with no published ports or persistent volume. Protected cluster
IDs are rejected before migration. Only exact owned run-labelled containers and their empty
internal network are removed; test images/evidence and all protected resources are retained.

`POLICY21-PROTECTED-RESOURCES.json` independently verifies the four saved service IDs, names,
images and exact ports. Active backend remains
`ced2bf78f14226db06e758edb4cd7d1d9d99289e0ad4d89e4b6bc55cc6826c8a`, image
`sha256:ff1f7c5ffebb7d0850403e49e5ea9c61612eee3fb63c139cc86858a83b5bb337`, started
`2026-10-20T20:07:26.433323836Z`. URLs remain localhost:3004 and 127.0.0.1:3006.
Historical PostgreSQL container `48dca500f37c30e2787c9510e8b9111917c19136ea970d036ff43ca4570bec84`,
protected cluster `7698666936429441062` and database `cashback_historical_03573b7` were not
used for these tests. No live database connection, balance write, migration, synchronization,
service rebuild/restart, real provider call, transfer or protected cleanup was performed.
Container invariance is not misrepresented as an audit of unrelated concurrent customer activity.

The three former owner decisions and the two named atomic integration blockers are resolved
for the isolated services and tested combinations. **No additional owner decision is needed
for these implemented rules.** Expected pending states remain for ambiguous equal-date partial
choices, unproven original sources/ownership, unverified distant chains, active restrictions,
missing evidence and unreconciled provider outcomes. They are safety behavior, not guessed approvals.

Before production: separate authorization, independently verified production evidence/authority
adapters selecting policy21, explicit review of migration order and existing data compatibility,
production security/provider testing, coverage and accounting reconciliation, operational rollback
review and resolution of the pre-existing strict frontend CI warnings. Restricted restoration
holdings require independently verified clearance of the original restrictions; this change
does not grant an automatic unrestricted release or permission to remit merchant funds.
Finance remains disabled. No live activation procedure was executed.
