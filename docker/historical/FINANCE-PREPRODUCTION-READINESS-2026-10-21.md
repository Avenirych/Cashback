# Finance pre-production preparation — 21 October 2026

**FINANCE_PREPRODUCTION_READINESS_COMPLETE** — preparation and local verification complete.
**NO-GO for production integration, financial writes or payouts.** This report is not activation
authority. Representative historical-data compatibility and production evidence/adapters are
not verified. No live service was deployed, rebuilt or restarted.

## 1. Baseline, preservation and changes

Canonical directory: `C:\Users\serge\cashback+`; Git application baseline:
`03573b7f47ba3c04dc50312bc71e0a7b904c0ce7`. The working tree already contained substantial
uncommitted work. Initial status is `work/preproduction-initial-git-status.txt`; no checkout,
reset, cleanup or unrelated-source restoration was performed.

Targeted verified backup: `work/preproduction-backup-2026-10-21T09-00-57-592Z`.
It contains original bytes/hashes of the changed existing files, initial protected resource
metadata, the original finance source hash inventory, exact owner request and prior 97-group
result. The final source/validation manifest is `FINANCE-PREPRODUCTION-SOURCE-MANIFEST.json`.

Reviewed the five requested completion/security reports, current authority/services/entities,
all 16 finance migrations, current local configuration and the actual GitHub Actions workflow.
Older unresolved-policy statements are superseded only by their documented 20/21 October
approvals; drafts are not production authority.

Changed files for this task:

- `cashback-frontend/src/pages/Register.tsx`: equivalent control-character predicate and
  named export of the existing return-path helper for direct regression coverage.
- `cashback-frontend/src/utils/emailValidator.ts`: remove redundant hyphen escapes only.
- `cashback-frontend/src/App.test.tsx`: mock the static index request, await it, unmount,
  verify abort and verify no XMLHttpRequest is opened.
- `cashback-frontend/src/components/SiteSearch.test.tsx`: add an abort-aware request-settlement test.
- New `cashback-frontend/src/utils/emailValidator.test.ts` and
  `cashback-frontend/src/pages/register-return-path.test.ts`.
- Root/frontend `package.json`: add the missing `typecheck` scripts; no dependency change.
- `.github/workflows/ci.yml`: replace narrow allowlisted test commands with complete guarded
  backend source and complete frontend suites, retaining open-handle detection and read-only
  workflow permissions. Other jobs and action pins remain unchanged.
- `src/finance/finance.entities.ts`: align the TypeScript AccountKind union with the three
  expense kinds already admitted by the existing SQL migration. No schema/business-rule change.
- New `docker/historical/finance-migration-readiness.cjs`; extend the existing disposable
  `finance-service-scenarios.cjs` and `finance-service-postgres.cjs` to run it after all 97 cases.
- Evidence: `FINANCE-MIGRATION-READINESS-RESULT.json`, updated `FINANCE-SERVICE-TEST-RESULT.json`,
  `FINANCE-PREPRODUCTION-SOURCE-MANIFEST.json`, `FINANCE-PREPRODUCTION-PROTECTED-RESOURCES.json`
  and this report. No redundant deployment or authority reports were created.

## 2. Strict frontend CI and SiteSearch

Register's old `/[\u0000-\u001f\u007f]/` expression triggered `no-control-regex`. The replacement
checks the same UTF-16 code units for values below 32 or exactly 127. Existing same-origin,
double-slash/backslash and allowed-path checks remain. Tests cover every forbidden control
character, allowed destinations and rejected external/private destinations.

emailValidator's hyphens were already last in their character classes, so escaping them was
unnecessary. Removing those escapes preserves the accepted character sets. Valid/invalid
email fixtures and an exhaustive embedded-ASCII comparison with the former classes pass.
No phone, password, required-field, marketing, verification or UI requirement changed.

The recorded TCPWRAP trace came from jsdom/whatwg-fetch opening an XMLHttpRequest for the
Header's static index while `App.test.tsx` mounted the real app without mocking fetch.
SiteSearch already uses AbortController and aborts on unmount. Dedicated search tests already
mock their network boundary. Production search was not replaced or disabled: the App test
now controls and settles its own static response, checks abort and asserts that no real XHR
opens. A separate abort-aware mock rejects with AbortError and settles on unmount without a
warning. Existing search tests, routes, index generation and content assertions remain.

Complete frontend Jest exits naturally: **233/233, 17 suites, zero reported open handles**.
No forceExit, Jest warning suppression, disabled handle detection, timeout-based success or removed
search assertions. Both strict `CI=true npm run build` and standard build pass. The existing
Node `fs.F_OK` deprecation from tooling is not an ESLint/compiler failure.

The workflow previously called absent `npm run typecheck` scripts and tested only small
allowlists. Those concrete configuration defects are fixed. GitHub-hosted workflow execution,
fresh Linux `npm ci` and a published commit were **not** performed or claimed; local commands
use the existing dependency installation. Hosted CI evidence remains a release prerequisite.
Both version-3 lockfiles' root dependency maps match their package.json dependency maps;
no dependency versions or lockfiles were changed.

## 3. Finance migration readiness

The tested chronological dependency order is:

1. `1791890000000-CreateFinanceCore`
2. `1791891000000-AddFinanceOutbox`
3. `1791892000000-AddBankReceipts`
4. `1791893000000-AddEvidenceControl`
5. `1791894000000-AddSyntheticCoverage`
6. `1791895000000-AddReceiptClassification`
7. `1791895100000-FixClassificationCompleteness`
8. `1791896000000-AddCorrectionReview`
9. `1791897000000-AddCorrectionCandidates`
10. `1792500000000-AddPurchaseLinkage`
11. `1792510000000-AddIsolatedLotOperations`
12. `1792511000000-AddIsolatedReceiptSettlement`
13. `1792520000000-AddPurchaseLifecycleEvidence`
14. `1792530000000-AddOwnerPolicyRecords`
15. `1792540000000-AddPolicy21Allocations`
16. `1792541000000-CoordinateCoverageRepayment`

Do not run the last seven alone. Coverage/evidence/classification prerequisites matter;
the earlier classification fix and correction-review/candidate migrations must not disappear
from a production migration manifest just because a narrower service fixture did not need them.

The runner creates uniquely named readiness databases inside its independently identified
tmpfs PostgreSQL container. TypeORM migration history is explicit, automatic migrations and
synchronize remain false. Eleven checks pass:

| Check | Evidence/result |
|---|---|
| All 16 in one transaction | Fresh schema commits; zero finance accounts, journals and postings created. No seed, settlement or balance recalculation. |
| ORM mapping | 20 registered finance entities map to actual columns; bigint, timestamptz and specified varchar lengths checked. Policy/lot SQL-only tables remain intentionally outside autoLoadEntities. |
| Catalog | 308 table columns, 240 constraints, 86 valid indexes and 86 enabled user triggers recorded, including coverage/immutability guards, source FKs and NULL-aware uniqueness. |
| TypeORM rerun | No pending migrations; zero reapplied. |
| Raw up rerun | Duplicate-object error; transaction fails without changing financial history. Raw up is not a substitute for a migration registry. |
| Destructive down | Refused; complete migration history remains. |
| Synthetic unrelated schema | Deliberately synthetic users/forum rows survive unchanged. This is namespace-preservation testing, not production-equivalent historical data. |
| Existing incompatible object | Complete migration command fails without leaving partially created finance tables. |
| Mid-chain injected failure | All preceding DDL/history rolls back under `transaction:'all'`. |
| Missing dependency | Fails atomically instead of enabling a partial policy schema. |
| Missing referenced column | Earlier constraint edits roll back; no allocation table remains half-created. |

Money uses SQL bigint and application bigint/string pence; aggregate checks remain exact.
Do not convert monetary fields to JavaScript Number. Account owner references currently have
SQL width 100; production principal mapping must provide canonical short opaque identities,
not arbitrary 160-character actor strings or personal email addresses.

The AccountKind type omitted bank_fee_expense, transfer_expense and other_expense even though
SQL already permits them; only the type union was corrected. No migration was edited or added.
SQL remains authoritative for FKs, immutable/deferred guards and newer policy tables; no
automatic ORM schema diff is approved.

**Historical-data compatibility: UNVERIFIED.** No authorized representative sanitized finance
dataset or disposable production-equivalent copy was found.
`existing-schema-observation.json` describes the different `cashback_docker_test` database;
it is not representative evidence for the protected historical finance target. The guarded historical
`schema.sql` targets a specifically approved database/role; it was not executed or stripped of
its guards for reuse. No active database was connected to or dumped. Synthetic tests do not
establish actual migration-history state, schema drift, existing financial identifiers,
balances, grants, data volume, lock duration or existing immutable history compatibility.
Those facts require an independently authorized representative fixture and review before GO.

## 4. Production authority contracts

Common contract for **every** row below: resolve authenticated current identity/permission
independently; load authoritative persisted evidence, not browser financial values; snapshot
facts before locking; bind canonical identity, amount/currency, policy and exact event version;
retain first verified ingestion/audit identity; same key + changed material must conflict.
Missing/ambiguous evidence must remain pending or refuse execution, never silently become
true, unlimited, zero-cost or paid. Stale/revoked proof must not authorize a new operation.
Permission changes, evidence revocation and competing writers must share the documented lock
protocol. No remote calls inside ledger transactions. Proof UUID/hash/role string alone is
not proof. Required external signatures/fields must be confirmed from actual agreements and
versioned provider documentation; this report invents no provider endpoint or header.

| Authority / existing boundary | Trusted input and source of truth | Verification, identity and version | Conflict/missing behavior | Required security / production adapter and external dependency |
|---|---|---|---|---|
| Merchant order identity — PurchaseLinkageAuthority | Merchant's canonical namespace/order reference and original buyer | Independently authenticated merchant occurrence, immutable namespace+order identity, explicit revisions | Different buyer/click conflicts; no rewrite | Merchant-scoped verifier; **no real adapter**. Merchant agreement and canonical ID contract required. |
| Click attribution — verifyClick/verifyOrder | Server-owned click, partner/offer/buyer relationship | Persisted server attribution linked to canonical order; first identity retained | Ambiguous/reassigned attribution goes to review, no money | Ownership mapping from active identity, not supplied buyer ID; **no real adapter**, merchant attribution agreement required. |
| Eligible amounts, discounts/exclusions — PolicyAuthority order | Partner-confirmed eligible items and net amounts, delivery/ineligible exclusions | Exact pence, item identities, discount basis and immutable order version | Unknown basis pending; no inferred price ranking | Approved partner data provenance; **no real adapter**, field meaning externally verified. |
| Mandatory bonus caps — order | Applicable merchant/offer cap set and restrictions-complete evidence | Verify every applicable versioned cap and terms | Missing cap is not unlimited; pending | Merchant/offer scope permission; **no real adapter**, merchant terms required. |
| Complete order group — select | Authoritative canonical group and terminal completeness | Verify all known versions, completeness proof and seller ingestion order | Late/incomplete group requires reselection/review; no second final bonus | Trusted merchant reporting authority; **no real adapter**, completeness semantics required. |
| Cancellation — cancel_winner | Merchant cancellation of the exact selected winner | Versioned cancellation ID and actual entitlement/lineage reconciliation | Unproven/distant/spent mismatch pending; replay once | Exact action/owner/origin permissions; **no real adapter**, merchant cancellation contract required. |
| Full/partial refund and commission revision — refund_cashback | Merchant's refund occurrence and revised remaining commission | Canonical source/order/refund ID + revision, GBP basis and original journal/receipt reconciliation | Changed event conflicts; missing basis/source ownership pending | Refund authority separate from customer request; **no real adapter**, revised commission contract required. |
| Merchant receipt — SettlementAuthority | Bank-recognized merchant funds matched to order/source | Unique receipt/source, amount, finality and expense/budget evidence; one settlement | Unmatched/reused/active-covered receipt blocked | Receipt/source classification rights; **internal service only**, bank+merchant settlement mapping missing. |
| Merchant finality — SettlementAuthority/order | Applicable merchant/order-specific versioned return/finality conditions | Verify actual finality for that order; never universal 14/30-day assumption | Receipt alone or confirmation alone insufficient | Verified terms owner; **no real adapter**, merchant-specific evidence required. |
| Bank receipts — EvidenceService, TrustedEvidenceAuthority | Independently confirmed bank occurrence, account scope, transaction identity, currency, amount/time | Separate submit/review/control; canonical bank identity, immutable decisions and current revocation state | Duplicate changed material conflicts; revoked/ambiguous proof blocked | Independent reviewers/controllers, scoped statement verifier; **internal service exists, production verifier disabled**. Bank feed/access agreement/credentials required. |
| Recipient validation — PolicyAuthority payout_claim | Provider-verified destination owned by intended recipient | Stable recipient proof and applicable capability state, bound to actor/attempt | Missing/stale/unsupported destination blocks hold/send | Payment-specific authorization and sensitive-data isolation; **no real adapter**, provider agreement/KYC/capabilities externally verified. |
| Fee quote — payout_claim | Provider's exact complete company fee for current principal | Quote reference, principal/currency and validity; re-quote on changed principal | Unknown/expired/partial fee blocks; no customer deduction | Verified provider quote authority; **no real adapter**, tariff/expiry/quote contract required. |
| Submission/reconciliation — payout/outcome | Verified provider attempt and actual bank/provider outcome, amounts/fees | Immutable attempt and provider message IDs, exact terminal amount/fee match; unknown before retry | Unknown retains holds; conflicting terminals rejected | Least-privilege payout submitter and independent reconciliation; **simulator only**, real submission/callback authentication not implemented. Provider credentials/agreement required. |
| Coverage — CoverageMandateProvider | Independently authorized purpose/context/eligible source capacity | Stable mandate and allocation key; funding anchor, active release/claim capacity and current evidence | Insufficient/revoked/reused capacity blocks | Existing provider is **disabled; current mandate is synthetic_test_coverage only**. A reviewed real authorization model is required, not relabelling test purpose as production. |
| Platform fee funding — payout_claim/expense evidence | Separate company-owned free bank funds and approved budget | Verify bank-account ownership, principal coverage, fee quote and no conflicting assignment | Missing/insufficient funding blocks; fee not assumed zero | Treasury/budget permission separate from customer, **no real adapter**, verified treasury/bank evidence required. |
| Classification/correction — ClassificationAuthority/CorrectionAuthority | Exact receipt ranges, source documents and responsible participant | classify_source right; independent request/review identity and candidate fingerprint/version | Conflicting range/basis, self-review or unknown ownership denied | Independent financial roles and document provenance; **internal services only, authorities disabled**, production rights/source documents missing. |
| Debt/external repayment/gift lineage — PolicyAuthority | Exact original obligation, timestamp, source ownership, bank-confirmed repayment/direct lineage | Debt caps, FIFO sources, original confirmation age; unique receipt and immutable correction slices | Equal-date partial ambiguity, unknown original pairing or distant chain pending | Owner/origin-specific permission; **no real adapter**. Independently verified original owners and obligations required. |

Existing PolicyContext defaults to historical policy20 for compatibility; future composition
must explicitly select policy21. Do not expose that constructor choice or a synthetic provider
to HTTP. The application has no approved production finance composition or adapter registry.

## 5. Focused security findings

| Boundary | Current source evidence | Future integration gate |
|---|---|---|
| JWT/active account | JwtStrategy verifies signature/expiry and looks up current user; missing/deleted user is 401, lookup failure sanitized 503. No global disabled/status column exists. | Preserve deployed patch. Map that identity to one financial owner; validate current financial permission per action. Do not invent a status field or globally deny verification sessions. |
| Separation of roles | Independent evidence submit/review/control and correction rights exist internally; default production authorities deny. | Provision reviewed permission lifecycle, independent approval and emergency revocation. JWT alone or a caller's admin flag is insufficient. |
| Ownership | Canonical click/order owner, lot owner, direct parent/responsible origin, debt cap and account-owner constraints checked. | Cross-account negative tests on every future route; canonical owner references <=100 SQL characters. Never accept ledger account IDs/posting sides/amounts as customer authority. |
| Public/admin routes | FinanceModule absent from AppModule; no new finance controller. Existing demo/forum bonus API is separate, protected and not this monetary ledger. | Do not route legacy balances into finance implicitly. No raw FinanceService.post or reconciliation primitive may be exposed to a public/admin body without independently authorized domain commands. |
| Callback authentication | No real merchant/bank/payment callback adapter or authenticated finance callback route. | **Blocker:** authenticate callbacks exactly to a verified provider contract, persist durable replay/version checks, separate transport validation from monetary facts. No invented header/signature acceptance. |
| Idempotency/replay | Journal/outbox, canonical identities, versioned policy commands, unique receipts/claims, immutable records and unknown-outcome gates tested. | Preserve economic identities across transport retries and provider messages; test stale/conflicting callback and concurrent retry in staging. |
| Rate limiting | No production financial action/callback limiter is wired, since no such routes are activated. | **Blocker:** independently scoped durable limits, attempt budgets, callback body/time bounds and authenticated actor limits before exposing any route. Existing auth/forum limits are not sufficient evidence. |
| Sensitive data/audit | Internal records retain opaque proof/owner IDs and financial facts; logging disabled in current local DB configuration. | Adapter allowlists, redacted logs, scoped/encrypted evidence store, access/retention controls. Never persist whole provider responses or credentials in generic policy payloads. |
| Secrets/environment | required env checks, explicit historical target, synchronize=false, migrationsRun=false; default-deny finance authority. | Separate migration owner/runtime verifier/submitter permissions and credentials. Test-only finance_app grants and historical cashback_hist_runtime are **not** a production finance grant plan. No secret generated or production credential fabricated here. |
| Reconciliation/operator commands | Caller-owned transactions and explicit internal services, no public financial tooling route. | Reviewed authenticated operator path, read-only reconciliation mode, dual approval for exceptional corrections; default deny after permission revocation. |

No existing deployed security behavior was modified. The only finance source adjustment is
the expense-kind type union. Missing production boundaries are documented blockers, not filled
with permissive placeholder guards. Independent security/accounting review remains outstanding.

## 6. Accounting and coverage reconciliation specification

Obtain one consistent database snapshot/cutoff and independently verified bank/provider
evidence. Compute in exact pence. Reconciliation is read-only and must not repair cached
balances by overwriting history.

1. **Journals/accounts:** each sealed journal has equal debit/credit totals and valid account
   currency/side. For every zero-initialized account, cached balance equals the signed sum of
   all immutable postings. Nonnegative eligible accounts never fall below zero; explicit
   clearing exceptions are not spendable customer funds. Match outbox/journal economic IDs.
2. **Receipts:** recognize each bank occurrence once as bank cash debit/unallocated received
   liability credit. Match actual statement occurrence, scope, amount, date and current proof.
   Trace classifications, receipt settlement and repayment claims; metadata alone is not money.
3. **Customer liabilities:** reconcile available bonus/user_gbp, lot reservation accounts,
   purchase-consumed entitlements, payout liability holds and restoration-restricted holdings
   separately by original owner/source. Do not classify a user liability as platform income.
   The lot reserved account must equal its active reservation rows; generic payout/restoration
   reserved accounts require their own policy-record mapping, not that lot-only equation.
4. **Income/expenses:** verify receipt-backed approved splits, finality and source/expense
   journals. Match company bank/transfer/other expenses to actual proof, including independently
   proven zero expenses; absence of a statement is not proof of zero. Preserve original income
   and append corrections. Customer fee debt needs explicit applicable terms and actual expense.
5. **Debt/refunds:** outstanding receivable <= immutable cap. Match cumulative approved target
   with still-outstanding plus net actually collected after restorations; never count unpaid
   debt as collected cash. Verify original settlement, revised commission/rounding, FIFO source
   debits, debt credits, debt reductions and owner-specific restoration accounts/age. Unproven
   historical source pairing must remain pending.
6. **Payouts:** match one immutable attempt to customer hold, principal-bank subaccount and
   separate company fee hold. Unknown outcome retains all liabilities/holds and cannot retry.
   Reconcile actual provider/bank success or failure, amount and fees to terminal journals.
   Bank/fee hold subaccounts are internal partitions of cash, not additional external bank
   balances. On failure preserve full customer principal; expenses remain company expenses.
7. **Gift lineage:** every child/source movement retains parent, original confirmation,
   responsible origin and exact ownership. Direct linked recovery cannot seize unrelated or
   reserved third-party funds; cancellation and eligible recovery commit or roll back together.
8. **Coverage:** active allocation = original allocation minus immutable releases, never
   negative. Per verified funding receipt, active coverage + repayment claims <= capacity;
   settled receipts cannot fund new coverage. Match release owner, mandate, original allocation
   and unique repayment to actual sealed unallocated/debt postings and eligible bank proof.
9. **Clearing/remittance:** customer correction clearing and debt recovery are not evidence
   that a merchant was reimbursed or that platform income increased. Obtain separate approved
   merchant obligation/remittance proof; keep unresolved differences visible, never net them away.

Evidence now: 97 actual PostgreSQL scenario groups preserve balanced immutable journals,
cached balances, caps, lineage, no double consumption/settlement/payout, protected reserves,
separate expenses and rollback. Final tests reconcile the complete synthetic ledger and
coverage. This does **not** reconcile actual bank statements, existing customer balances,
provider fees/outcomes or merchant obligations. A production reconciliation inventory,
cutoff rules, signed opening balances and independently reviewed discrepancy treatment remain
required; no live balances were read for this task.

## 7. Future integration plan — none of these activation stages executed

Each gate requires recorded artifact hashes and a named responsible approver. A failed gate
stops progression; later approval does not authorize bypassing an earlier money-safety gate.

| Stage | Preconditions / required evidence | Exact verification and GO / stop criteria | Recovery, money protection and responsible authority |
|---|---|---|---|
| 1 — source/CI | Reviewed source manifest, lockfiles and current tests | Complete guarded backend/frontend Jest, both TypeScript checks, strict+standard frontend/backend builds, 97 disposable groups and migration checks. Local evidence passes; hosted CI on exact candidate SHA still required. Stop on failed check or changed policy. | Restore targeted source/config backups before release; no financial deployment/data change. Maintainer/CI reviewer. |
| 2 — representative migrations | Authorized sanitized representative schema/data, verified fixture provenance and expected registry/catalog | Compare every existing object/type/constraint/owner and immutable-history hash; apply all pending migrations transactionally on disposable copy, replay, inject failure, measure locks/time/capacity, reconcile before/after. **NO-GO now: representative fixture unavailable.** | Preserve fixture originals and reports; no exploration/dump of active DB under this task. Schema/data owner plus independent DB reviewer. |
| 3 — real authorities | Versioned merchant/bank/provider agreements, scoped credentials via approved secret management and canonical identity mappings | Contract tests for every matrix row; signed/stale/conflicting/replayed evidence, revoked rights, invalid quotes/recipient, unknown outcomes. Synthetic authority must never register in production. Stop on undocumented provider behavior. | Keep default deny, revoke invalid adapters/credentials through approved process; no payouts. Merchant/bank/provider integration owner and security reviewer. |
| 4 — independent review | Migration/adapter evidence and reconciliation specification | Independent ownership/permission/callback/rate-limit/secret/ledger/coverage review, concurrency and disaster-recovery rehearsal, signed accounting opening reconciliation. Stop on unexplained difference or bypass path. | Forward corrections only after authorization; immutable evidence preserved. Independent security and accounting authorities. |
| 5 — limited activation approval | All prior gates signed, exact target DB/container/image identities, verified backup restoration evidence, explicit scope/caps | Owner approves exact manifest, feature controls, target, operators, observation window and rollback/forward plan. No blanket permission inferred. Stop on any identity/config/backup mismatch. | Retain working release; no source/data replacement without this exact approval. Owner plus release/DB custodians. |
| 6 — controlled migration and gated deployment | Stage5 approval; least-privilege runtime/migration roles; reviewed gates implemented and tested (not currently wired) | Reverify target and backup, deploy exact approved artifacts with financial writes/outbound payments disabled, apply only reviewed pending migrations, verify registry/catalog/hashes and read-only health. Never enable synchronize/migrationsRun. Stop on unknown object, partial migration, authority fallback or drift. | Failed pre-commit transaction rolls back; after committed financial history, disable entry points and preserve DB, use reviewed forward migration/correction. No dropping tables/volumes as rollback. Authorized operator under dual review. |
| 7 — read-only observation | Gated deployment healthy, no financial writes authorized | Snapshot-based bank/ledger/coverage/unknown-outcome reconciliation, permissions/audit checks and capacity monitoring against signed opening evidence. GO only with zero unexplained differences. | Leave writes off; investigate evidence without balance repair. Accounting/reconciliation operator. |
| 8 — separately approved writes | Stage7 clean; explicit owner approval of limited non-payout financial commands and durable limits | Staging then explicitly approved canary: ownership, proof, replay, concurrency, caps, atomic rollback and before/after reconciliation. Stop on duplicate/unexplained journal, negative funds or denied action succeeding. | Disable further commands; retain all journals; authorized immutable forward corrections. Owner, financial command approver and accounting reviewer. |
| 9 — separately approved payouts | All prior gates, actual provider/bank agreement/credentials, verified recipient and current full fee, covered principal and reconciled attempts | Provider sandbox evidence followed only by separately approved real payout scope. Require no disqualifying debt/restriction, immutable attempt, exact submission/outcome and statement reconciliation. Unknown outcomes prohibit retry. | Halt submissions, preserve principal/fee holds and liabilities, reconcile independently; never fabricate success/failure or resend blindly. Owner, treasury/payment authority and independent reconciler. |

No production feature flag, public controller, callback, migration execution against the
active target or real payout command was added by this task. Stage6–9 instructions describe
approval gates, not commands authorized to run now. There is no approved destructive down
path for immutable financial history.

## 8. Executed test results and remaining evidence

- Backend: **519/519**, 61 suites, complete source Jest; natural exit and zero reported handles.
- Frontend: **233/233**, 17 suites; original 208 retained and 25 focused cases added, natural
  exit, zero reported handles. TCPWRAP no longer reproduced after the fixture fix.
- Backend/frontend TypeScript and backend production build: PASS.
- Standard frontend production build and strict `CI=true` production build: PASS.
- Isolated PostgreSQL financial groups: **97/97**, original list/order hash checked against
  `75e3ed6bfaf6d57b4556ffb8bd81fbbb684454998eb32782c965323a23d267f6`.
- Full migration readiness: **16 migrations, 11 checks**, PASS; 20 entity mappings and catalog
  evidence stored in `FINANCE-MIGRATION-READINESS-RESULT.json`.
- Node syntax and `git diff --check`: PASS.

Logs: `work/preproduction-{backend,frontend}-jest.{json,log}`, corresponding `*-ts.log`,
`preproduction-backend-build.log`, `preproduction-frontend-ci-build.log`,
`preproduction-frontend-standard-build.log`, `preproduction-postgres.log` and the immutable
per-run archive referenced by `FINANCE-SERVICE-TEST-RESULT.json`. No skipped/failed test was
relabelled PASS; GitHub-hosted Actions and representative real-data migration testing are
explicitly NOT EXECUTED.

Protected backend remains
`ced2bf78f14226db06e758edb4cd7d1d9d99289e0ad4d89e4b6bc55cc6826c8a`, image
`sha256:ff1f7c5ffebb7d0850403e49e5ea9c61612eee3fb63c139cc86858a83b5bb337`.
URLs remain localhost:3004 and 127.0.0.1:3006. PostgreSQL container
`48dca500f37c30e2787c9510e8b9111917c19136ea970d036ff43ca4570bec84`, protected cluster
`7698666936429441062` and database `cashback_historical_03573b7` were not accessed for testing.
FinanceModule remains disconnected; automatic schema mechanisms remain false.

The runner verifies daemon/context and every pre-existing container's ID/image/start time/
running state, plus persistent volume inventory before/after disposable tests. Only exact
owned run-labelled temporary containers and their empty internal network are removed. Final
independent metadata verification is recorded in `FINANCE-PREPRODUCTION-PROTECTED-RESOURCES.json`.
No protected image, volume, stopped rollback container, bonus-api, Mailpit or live service was
removed/replaced/restarted. No real balance, provider, merchant callback, payment or credentials
were used. Container invariance is not presented as an audit of unrelated concurrent DB activity.

**Final assessment:** GO for continued offline preparation and obtaining independently approved
fixtures/contracts/reviews. **NO-GO for beginning controlled production integration today:**
representative data compatibility, real authority adapters/provider evidence, production
permission/rate-limit/gate wiring, least-privilege grants, opening bank/accounting reconciliation,
independent review, hosted candidate CI and explicit limited activation approval are still missing.
Preparation completion does not resolve or waive those production dependencies.
