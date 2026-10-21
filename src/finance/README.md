# Isolated finance core (not activated)

FinanceModule is not imported by AppModule. No controller, worker, account
seeding, revenue receipt handler or payout integration is installed. No legacy
entities are registered. The migration is intentionally absent from existing
DataSource lists. It has been applied only to the isolated finance integration database,
not to the main application database. No historical balances are imported.

Money boundaries accept nonnegative decimal strings only. Intermediate products
use exact bigint coefficients/scales; final postings use bigint pennies with
PostgreSQL signed-bigint bounds. HALF_UP rounds the received total to pennies,
then splitRevenue rounds the user share of that finalized total once. Platform
share is its remainder. Negative adjustments use reversed posting sides, not
negative amounts. This primitive does not authorize receipt/confirmation events.

Tables: finance_accounts (GBP, kind, normal side, zero opening balance),
finance_journals (unique eventKey, requestHash, sealed state), finance_postings
(positive penny amount, debit/credit, account/journal foreign keys). Types cover
user GBP liabilities, platform income, bonus liabilities, reservations, user
debt assets and signed clearing. Account references are opaque; no user.balance
or old bonus table is connected. Provisioning accounts is a future approved step.

FinanceService.post performs an explicit transaction and delegates to
postWithManager(manager, eventKey, postings). The latter requires an active,
unreleased transaction manager bound to the same DataSource/QueryRunner. It uses
only that manager, never starts/commits/rolls back/releases the caller transaction.
A successful return is provisional until outer commit (deferred SQL checks still
apply). Callers must propagate errors and roll back failed outer commands.
Event identity and posting validation are unchanged. The posting sequence is: event advisory lock,
replay/hash check, sorted account locks, aggregate balance preflight, postings,
then seal. The migration updates cached account balances through posting triggers,
checks final balances and balanced/sealed journals at commit, and rejects ordinary
UPDATE/DELETE/TRUNCATE of ledger records. Corrections require new journals.
Unique constraints back event identity. The SQL must run in a dedicated reviewed
PostgreSQL transaction using the intended public schema/search_path. No existing
DataSource should be repurposed to run it automatically.

Database-owner/superuser privileges can disable triggers or perform DDL; production
roles and grants are a separate required review. Baseline DDL/triggers, deferred constraints, rollback and concurrency were
verified by the historical 6V.2 isolated run. Manager-aware writing also passed
five isolated PostgreSQL scenarios: outer commit, outer rollback of journal and
companion fixture, replay/conflict, inactive-manager rejection and insufficient
funds. Fifty-two unit tests passed. Deadlock recovery, server crash and production
role hardening remain unverified. Only synthetic isolated financial operations
were created; no application operation is activated.

Known unrelated technical debt: two legacy entities target bonus_transfers with
incompatible schemas. They are untouched and excluded from this module. Old
financial services must not be enabled by importing this module.

Future migration application, dedicated DataSource registration, integration tests
on a disposable database, external revenue verification and business transitions
require separate approval. The down migration drops only new finance objects and
would destroy any future ledger data; do not execute it as routine recovery.


## Typed internal events and transactional outbox (6V.5.2)

FinanceEventsService.postEventWithManager(manager, event, postings) delegates to
existing postWithManager and inserts finance_outbox through the SAME manager.
It owns no transaction lifecycle. Return remains provisional until caller commit;
propagate failures and roll back the whole command. Existing post/postWithManager
remain compatible and intentionally do not produce outbox records by themselves.

The initial contract supports only finance.journal.posted schemaVersion 1:
eventId UUID, stable idempotencyKey, operationId UUID, canonical UTC createdAt and
data {currency: GBP}. Keys and operation references must be opaque internal IDs,
never credentials or personal data. Unknown types, versions, fields and payload
fields are rejected. This is an internal ledger fact, NOT a provider payment
command, cashback receipt or implemented business workflow. Original bonus
confirmation age is not this event timestamp; future domain events must preserve
origin dates separately and must not introduce expiry of confirmed GBP amounts.

Outbox stores one immutable event envelope/payload per journal. Unique eventId,
idempotencyKey and journalId plus ledger event lock protect concurrent repeats.
Replay requires identical metadata and posting content, preserving eventId,
operationId and createdAt across retries. Reusing a key with changed envelope is
an error. A plain legacy journal without outbox cannot be retrospectively adopted
under its old key. New additive migration AddFinanceOutbox1791891000000 is not
registered in application DataSources; only isolated finance DB OID 24780 received it.

Payload is constructed internally: currency, journalId, postingCount only.
The database verifies matching sealed journal/key and actual posting count.
Event data cannot be updated/deleted/truncated through ordinary DML; delivery
metadata attempts, availableAt, leaseUntil and deliveredAt remain separate.
No worker, scheduler, broker or external delivery is installed. Future delivery
must use at-least-once with lease/retry and idempotent consumers keyed by eventId;
marking delivered cannot be treated as proof of bank execution. Consumers must
not convert this generic internal fact into a payout without separately approved
business eligibility/payment commands. Retention/archiving needs another plan.

Validation: 66 finance unit tests passed; TypeScript 5.9.3 typecheck, Nest build
and fresh nonincremental emit passed in work snapshot. Eleven isolated PostgreSQL
outbox scenarios passed (including additive DDL, shared commit/rollback, replay,
concurrency, envelope conflict, failed posting, event UUID uniqueness rollback,
immutable data, version/privacy and plain API compatibility). Core migration and
existing business modules unchanged. Broker crash/retry/leases and delivery security
are untested because delivery is not implemented.


## Restricted bank receipts (6V.5.4)

BankReceiptsService.registerWithManager(manager, command) requires the caller's
active transaction manager from the same DataSource. It neither begins nor commits
transactions. The result is provisional until the caller commits. Any exception
must cause the WHOLE transaction to roll back, never be swallowed before commit.

The command contains sourceNamespace, opaque accountScope UUID, stable transactionId,
GBP amountPence bigint (>0), canonical receivedAt, opaque evidenceReference UUID and
the two ledger account IDs. Source namespace + account scope + transaction ID is the
bank identity; amount/date/currency/target accounts are essential replay material.
A different supporting evidence reference can confirm the same material, preserving
the original verification record. Changed material is a conflict. Verification is
repeated on every request, including replay, before SQL writes.

BANK_EVIDENCE_VERIFIER is the exclusive verification interface. FinanceModule binds
DisabledBankEvidenceVerifier, which ALWAYS refuses. Missing verifier also refuses.
There is no production document/hash/UUID/external-ID accepting implementation.
A future trusted adapter must independently verify actual settled receipt amount,
currency, date and source/account identity; opaque references merely locate evidence
and are not proof. Synthetic verifiers exist exclusively in unit/integration tests.
Adapter trust, evidence retention, stable bank identifiers, authorization and audit
policy require a separate implementation/review. Do not expose arbitrary verifier
injection or raw ledger access as a user API. Database constraints enforce consistency;
they cannot authenticate bank evidence or protect against privileged DBA bypass.

Each verified receipt creates exactly one restricted funding lot of the same GBP
amount, purpose awaiting_classification. The ONLY posting is:
  Dr company_bank_cash / Cr unallocated_received_funds.
Both accounts are nonnegative, scoped by bankScopeKey(sourceNamespace, accountScope),
with keys bank_cash:<scope hash> and bank_unallocated:<scope hash>. Accounts start at
zero and must be provisioned by a trusted isolated setup; the receipt command cannot
create or relabel accounts. Lot amount is provenance/control metadata, NOT another
balance or second accounting journal. No commission, revenue, user share, free money,
distribution, release or payout is recognized or enabled.

A bank-identity advisory transaction lock serializes receipts; the existing ledger
then locks its event key and sorted accounts. DB uniqueness additionally protects
bank identity, event key, journal/event and the one-to-one lot. Receipt, lot, original
ledger and existing minimal internal outbox envelope are inserted through the SAME
manager. Receipt and lot updates/deletes/truncation are prohibited. Deferred commit
checks require one exact lot, two exact receipt postings and matching sealed journal
and outbox operation. No dispatcher or external payment command is started.

AddBankReceipts1791892000000 extends only finance account checks and adds
finance_bank_receipts / finance_funding_lots. It is not registered in application
DataSources. Applied only to the explicitly verified finance integration DB
cashback_finance_it_d3ea97187c924beba3f43ec7d7fe77, OID 24780. Down refuses with
extension records/accounts; it was not executed. Existing core/outbox migrations,
legacy business tables, AppModule and old bonus_transfers remain untouched.

Validation: 84 unit tests (four suites), TypeScript noEmit and Nest build succeeded
in an isolated work snapshot using existing backend dependencies. Fourteen real
PostgreSQL integration checks passed, covering DDL, commit, replay, conflict,
concurrent repeats/conflicts, rollback including failure after outbox, disabled or
mismatching verifier, amount/scope validation, restricted immutable lot, DB constraints
and existing ledger/event compatibility. Main DB schema hash and aggregate counts
were unchanged. Production bank evidence verification and banking APIs are NOT
implemented or tested. Previous migration-specific integration runners retain their
original baseline preconditions and are not generic repeatable migration runners.


## Transactional evidence lifecycle (6V.5.5-B)

BANK_EVIDENCE_VERIFIER still binds DisabledBankEvidenceVerifier in FinanceModule.
EVIDENCE_AUTHORITY binds DisabledEvidenceAuthority. There is no active production
bank verifier, authorizer, document acceptor or role map. EvidenceService is an
isolated internal provider, not a controller, and FinanceModule is not in AppModule.
Its verification and lot guard additionally require authority enablement, which the
production default denies. All synthetic authorities are located only in tests.

Receipt registration now REQUIRES verifyWithManager and bindReceiptWithManager;
a legacy verify-only adapter is refused, never used as fallback. Existing receipt
signature and result, post/postWithManager and journal outbox contract are retained;
injected verifier capability is deliberately stricter. Existing 6V.5.4 synthetic
unit fixture now exposes manager methods; it is not a production implementation.

EvidenceService API (caller owns transaction):
- observeWithManager: authorised submitter creates immutable observation.
- approveWithManager: independent authorised reviewer + independently verified bank
  facts creates a decision and eligible canonical operation. Missing native ID or
  ambiguity is quarantined; release requires a verified reconciliation document
  AND independent bank occurrence proof. A UUID/document reference alone fails.
- revokeWithManager: authorised controller records a documented revoke, marks the
  whole operation revoked, irrespective of other observations/decisions.
- recheckWithManager: reviewer independently verifies document/evidence at the current
  revoked version. Original uploader cannot review their own observation.
- restoreWithManager: distinct controller requires the current independent review;
  stale reviews and the same human as reviewer/controller are refused.
- historyWithManager: separately authorised read-only history, not registration replay.
- assertLotEvidenceWithManager: PROVISIONAL trust guard only, never spend permission.
  It returns restricted:true; no allocation, spending, release or payout is implemented.

Authorize resolves a trusted principal/context and action; supplied role/name/UUID
is not authority. No actual identity integration exists yet. Future authorizer must
validate authenticated context and lock current role/policy grants; future external
revocations must take the same authorization guard. Tests use independent synthetic
truth maps for bank facts and documents, rather than echoing caller claims as proof.

One canonical namespace/account/transaction is independent of API/statement transport.
Immutable observations uniquely identify source/account/native ID; independently
approved decisions associate observations with a canonical operation. Decisions are
also alias links: no duplicate alias/mapping table is introduced. Known conflicting
mappings fail. Unknown/ambiguous observations do not create an operation or receipt
and do NOT halt unrelated receipts for the account. There is no emergency source
shutdown implementation. Independently documented internal occurrence IDs can be
attested only by the trusted authority, not fabricated by receipt commands.

Tables added by AddEvidenceControl1791893000000:
finance_bank_operations (eligible/revoked, immutable facts/hash, version, unique receipt);
finance_bank_observations (immutable intake state pending_review/quarantined);
finance_bank_decisions; finance_bank_restore_reviews; finance_evidence_events.
Intake status is historical; current acceptance is derived from decisions and the
operation guard. Event/audit and review rows are immutable, no truncate. Deferred
checks require decisions and atomic state audit, and every newly inserted receipt
must match a decision/operation association at commit. Existing synthetic receipts
were not retroactively converted to trusted production approvals or rewritten.

Lock order: shared authorization advisory (726405,0), account scope (726404),
canonical bank identity (726403), operation rows, existing ledger event (726402),
sorted ledger accounts. All locks are transaction-scoped through the active manager.
The authorization gate is intentionally coarse, serializing this prototype's evidence
commands; no scaling/production performance claim is made. Future multi-scope/batch
flows must determine their whole lock set first, not acquire new scope after accounts.
Future coverage/use paths MUST apply this guard; generic ledger is not a public API.

Receipt, lot, original ledger/outbox and operation receipt binding are atomic. Revoke
and restore have no cash effect: only control state and immutable evidence audit
change together. Existing journal outbox cannot represent a no-journal event; no
fictional posting is generated for audit or delivery. No lifecycle delivery worker
exists. A future separate domain event/delivery contract requires approval.

On revoked receipt replay: EvidenceRefusedError, code BANK_EVIDENCE_BLOCKED and
receiptId of the existing receipt; no success/new journal/lot/outbox. Lifecycle command
replays return recorded historical outcomes and do not repeat a transition; read
current state through history. A previously successful restore key cannot override
any later revoke. Restoring trust never changes restricted funding lot status.

Bank reversals/amount corrections are NOT automatically posted by this implementation.
Their confirmed event/case/accounting handler remains a future approved stage; never
reuse credit receipt with negative amount or delete original records. User/seller
liabilities and balances are untouched. Any service error must propagate and abort
the whole outer transaction. Security failure audit after rollback needs a separate
nonfinancial channel, not a nested commit; that channel is not installed here.

Validation: 98 unit tests in five suites, noEmit and build/nonincremental emit in work
snapshot. Nineteen PostgreSQL scenarios passed in the verified finance database
cashback_finance_it_d3ea97187c924beba3f43ec7d7fe77 (OID 24780). The migration applied
once; repeat test runs accept exact four-migration history and perform no repeat DDL.
First integration found and fixed order-dependent JSON hashing: snapshotBankFacts now
uses explicit canonical field order, including facts read from JSONB. A separate test
assertion was corrected: PostgreSQL's FK restriction can reject TRUNCATE before the
immutability trigger. Original failed runs are retained alongside successful logs.

Concurrency tests demonstrate actual pg_blocking_pids using separate connections,
without artificial timer waits. Lot tests verify the trust guard vs revoke in both
orders, NOT actual bonus use or coverage allocation. No real bank evidence, authorizer,
source ingestion/parser, emergency lock policy, restricted application DB role,
reversal accounting, funding release or delivery was implemented/validated. Existing
old bonus_transfers conflict remains unrelated technical debt.


## Full synthetic coverage reservation (6V.5.6-B)

CoverageService is an isolated internal provider, not a controller or real business
integration. COVERAGE_MANDATE_PROVIDER binds DisabledCoverageMandateProvider. No
production issuer, bank source, authorizer, distribution or payout is activated.
Synthetic providers exist only in coverage.spec.ts and test/finance/run.coverage.cjs.
Evidence roles alone confer NO coverage permission. A supplied UUID/role/context does
not prove authority: the provider independently resolves principal and approved test
context, mandate purpose, positive GBP penny limit and allowed lots through the same
active EntityManager. A different grant definition requires a new mandate ID.

API:
- createTargetWithManager(manager, principalReference, command): immutable UUID,
  synthetic_test_coverage kind/context, positive GBP amount; created state. Target
  creation and reservation are separate commands/transactions in this initial scope.
- reserveWithManager(manager, principalReference, command): explicit lot/penny fragments
  whose sum must equal the target exactly. Duplicate lots and unknown/out-of-context
  lots are rejected; all residual capacities and the cumulative mandate limit are
  checked atomically. One reservation per target, one fragment per lot per reservation.
- assertReservationUsableWithManager: trust/mandate gate only, returns restricted:true;
  DOES NOT spend/release/pay, recognise a liability, classify own funds or grant a
  production permission. It refuses blocked evidence.

Targets transition only created -> reserved. No release, reuse, partial reservation,
TTL, expiry, automatic lot selection or purpose reclassification. Another key for an
already reserved target conflicts even if the fragments happen to match; only the
original reservation key is an idempotent reservation replay. Immutable historical
result preserves reservation/allocation IDs, penny amount, target and mandate.
Replay appends replay:true and current blocked status, not a new allocation or permission.
On revoked evidence replay is historical with blocked:true. Receipt registration
continues to return BANK_EVIDENCE_BLOCKED. Restoration of evidence does not release
coverage or change the restricted origin; held fragments continue to count against
both lot capacity and mandate limit even when blocked.

Metadata tables: finance_coverage_mandates, finance_coverage_targets,
finance_coverage_reservations, finance_coverage_allocations. Mandates are immutable
persisted limits, not bank money. Reservations/allocations are immutable; held sums
are the single allocation source, with no independent cached available balance.
Unused capacity = original lot pennies minus ALL held allocations in this limited
receipt-only scope. It must not be reused as a production cash formula once external
settlements/impairments are introduced: those require the designed funding controls,
reconciliation and separately approved handling. No user obligation or income entity
is created by target/coverage records.

Lock order: authorization advisory 726405, ALL sorted account scopes 726404, ALL sorted
canonical bank identities 726403, sorted operation rows, sorted lot rows, mandate row,
target row. Prelock collector is necessary before invoking individual evidence guards
on a multi-scope set. Provider must verify local trusted context without nested
transactions, external calls or lower-order locks. The current coarse authorization
gate serializes these commands; no high-throughput claim. Caller must not enter this
primitive holding later domain/account locks, or chain creation/reservation/batches
without a separately prepared complete lock set. Results remain provisional until
outer commit, errors must roll back the whole transaction.

EvidenceService adds inspectLotEvidenceWithManager to return blocked status under the
existing transaction locks without treating revoked evidence as approval. Existing
assertLotEvidenceWithManager delegates to it and retains its previous refusal behavior.
Both still require authority enablement; default production authority denies.

AddSyntheticCoverage1791894000000 is a separate additive finance migration, not in
application DataSources. Only isolated finance DB OID 24780 received it. Constraints
protect immutable context/amount/state, unique commands/targets, full sum and historical
result consistency. PostgreSQL allocation trigger additionally serializes and checks
lot and mandate cumulative bounds, allowed scope and eligible evidence. Deferred checks
reject a reservation without exact full coverage or reserved target. No destructive
automatic down. Application DB permission hardening remains future production work;
DB constraints cannot authenticate a bank or principal or prevent privileged DBA bypass.

Coverage is not a bank movement. No finance_accounts/journals/postings/outbox write is
performed. Reservation command/result records provide local immutable history; no new
deliverable outbox event is needed in this stage. Existing journal outbox requires a
real journal and is kept unchanged, with no fictional posting. Domain delivery and
coverage transition event schema require a later explicit design/approval.

Validation: finance unit suite passed with prior ledger/receipt/evidence assertions
retained; TypeScript noEmit, Nest build and full nonincremental emit passed. Twenty-two
PostgreSQL scenarios passed, including multi-scope complete coverage, contention on
one lot and one mandate, replay before/after revoke, no-provider/no-role permissions,
rollback midway/after success, actual lock races in both orders and deferred DB bounds.
All cash/ledger/outbox/account rows were identical before/after the reservation phase;
synthetic receipt fixtures were created beforehand. All lots remain restricted.
Main application DB schema and aggregate data counts were unchanged.

Still outside scope: real classification/own-free, partial cover/release, bonuses,
debts, user obligations, partner splits, payout fees/budget, external spending,
reversal/impairment accounting, live bank verification/auth, workers and AppModule
integration. Do not interpret historical replay or this test mandate as any of these.


## 6V.5.7-B: isolated receipt source classification

ClassificationService.classifyWithManager(manager, principalReference, command) requires
an active caller-owned transaction on the same DataSource. command contains commandKey,
receiptId, trusted contextId and nonempty parts; each part has an immutable UUID,
nonnegative offsetPence, positive amountPence (bigint GBP), category, sourceNamespace,
sourceEventId, basisReference and documentReferences. Ranges [offset, offset+amount)
identify virtual pennies within this receipt, not a bank transfer or spend permission.
Disjoint partial classifications are supported; every unclassified remainder remains
restricted. Classified funding also remains restricted. Six metadata categories:
shopping_cashback, rewarded_ads, research_referral, passive_ads, return_or_adjustment,
company_funding. The last category does not certify own-free eligibility or income.

CLASSIFICATION_AUTHORITY is a separate trusted interface. Default provider denies all
requests. authorizeWithManager resolves authenticated principal/context and current
classify_source permission; evidence roles and synthetic mandates provide no such right.
verifyOriginWithManager independently validates source facts, exact receipt range and
supporting basis/documents. A UUID, external ID, uploaded document or hash is not proof.
No live authority/source verifier is implemented. Synthetic maps exist only in tests.
Future permission changes must acquire the same authorization lock and remain within
this transaction; a separate remote permission check cannot meet the race guarantee.

Lock order: shared authorization advisory lock (726405,0), bank scope (726404), bank
identity (726403), canonical operation FOR UPDATE, funding lot FOR UPDATE, receipt
FOR UPDATE, classification records. One receipt per command; do not compose multiple
commands by acquiring bank identities in an arbitrary order. Future multi-receipt
commands must collect and sort every scope/identity before taking lower-order locks.
The trusted provider must not take lower-order locks before bank locks, open another
transaction or perform remote I/O. PostgreSQL guards repeat operation/receipt locks,
range nonoverlap and receipt capacity checks. Immutable rows, unique keys and deferred
completeness checks prevent duplicate/incomplete histories and later appended parts.
Database constraints do not authenticate users or documents; privileged SQL bypass
is outside trusted service authorization and requires future DB permission hardening.

Replay authorizes the caller, checks the original canonical request and reads current
bank state. It preserves classification/part IDs and amounts, returns replay:true and
current blocked status, without new proof, parts, postings or outbox. New commands on
revoked evidence fail CLASSIFICATION_EVIDENCE_BLOCKED. Receipt registration still
fails BANK_EVIDENCE_BLOCKED and synthetic coverage keeps its own historical replay.
unclassifiedPenceAtCreation is historical, not a live spendable balance.

requestCorrectionWithManager(manager, principalReference, command) accepts commandKey,
partId, trusted contextId and reason. It records immutable requestId, actorId, contextId,
createdAt and status=requested. Separate request_classification_correction permission and a verified trusted participantId are required (6V.5.8-B); classify_source fallback is forbidden. A request
may record an issue even when bank evidence is revoked; it never approves a correction,
changes the original category/amount, frees pennies or creates coverage. Replay keeps
the request ID/time. Revision approval, monetary adjustments and release need a separate
agreed policy. Never delete history or rewrite ledger because a request was submitted.

Both methods use only the passed EntityManager. Success before outer commit is
provisional; propagate failures and roll back the entire caller transaction. No nested
transaction or independent commit occurs. Classification creates no income, user debt
or liability, own-free cash, coverage allocation, journal or outbox. Existing journal
outbox requires a real journal and stays unchanged; immutable classification rows are
local audit history. A future classification delivery schema requires separate design.
B66 strict M>0 for all four income sources applies to future economic admission, not
source classification. Costs, coverage and budget admission are not implemented here.

Two additive finance migrations: AddReceiptClassification1791895000000 and
FixClassificationCompleteness1791895100000. The latter fixes PostgreSQL record-field
resolution in the deferred shared trigger without rewriting applied migration history.
No automatic destructive down. They were applied only to the identity-verified isolated
finance test DB. FinanceModule remains disconnected from AppModule; no legacy entity
is registered. Production authority, bank verifier and mandates remain default deny.


## 6V.5.8-B: existing correction requests and independent decisions

ClassificationService.requestCorrectionWithManager keeps its command/result shape,
but delegates to ClassificationCorrectionsService. Production CORRECTION_AUTHORITY
is DisabledCorrectionAuthority: default deny, no classify_source/evidence/coverage
fallback. Direct correction service methods also require this separate authority.
The caller cannot add participantId, role or extra fields to command payload.
Trusted authorizeWithManager resolves authenticated principal/context/current right
and identityVerified:true plus a stable common participantId across technical accounts.
Permission and participant-mapping changes obey the shared 726405 authorization lock.
No real authentication or banking source is activated; synthetic maps only in tests.

Same table finance_classification_correction_requests: additive nullable participantId
stores trusted identity for NEW submissions. Existing rows remain NULL: no fictitious
backfill and no automatic review/adoption. Request status=requested remains immutable
historical submission. New submissions require request_classification_correction.
Current status is computed separately, never UPDATE-ed onto the original request.

reviewWithManager(manager, principalReference, command) requires
review_classification_correction. Command: commandKey, requestId, contextId,
decision approved|rejected, reason, basisReference, expectedOperationVersion.
The independent basis is verified through the trusted interface; a UUID alone is
not evidence. Compare trusted participantId with the stored requester participantId,
not account role or actor UUID. Another account of the same participant cannot
approve OR reject. Missing/unverified identity and historical NULL requests fail closed.

Immutable finance_classification_correction_decisions record request/actor/participant/
context/decision/reason/basis/current canonical operation ID+version/key/hash/time.
UNIQUE(requestId,operationVersion) prevents competing incompatible decisions; unique
commandKey detects exact replay/material conflict. PostgreSQL insertion guard checks
identity/context/origin, evidence state/version and parent locks; no monetary writes.
Constraints cannot authenticate a bank or user; privileged SQL needs future hardening.

stateWithManager is scoped read-only history-derived state (same active manager/right):
requested -> approved|rejected for the current bank version. Evidence revoked => blocked;
restored/new version with prior decisions => review_required until a fresh independent
review; no automatic restoration of the old approval. Historical NULL => identity_unverified.
Replay returns the ORIGINAL decision ID/version/time plus CURRENT state; old approved
replay after restoration is still review_required and creates no new decision. Approvals
from former versions remain immutable audit, never applicable to the current version.
Both approved and rejected may be reconsidered only after bank-version change and a
new independent decision; no conflicting decision in one current version is permitted.

All methods use the outer active EntityManager. Lock order: authorization, bank scope,
identity, canonical operation, lot, receipt, request, decisions. Reads after bank locks
use current version/state. This limited submission/review path requires READ COMMITTED;
it does NOT convert other finance transactions to SERIALIZABLE. No independent commit.
Rollback removes request and decision together. Requests may document revoked evidence;
NEW approval/rejection is blocked until valid bank evidence. Coverage does not prevent
review; it prevents FUTURE application, which is not implemented here.

No apply method, effective version/head, range release, candidate metadata amendment,
coverage transition, income, obligation, ledger or outbox write is implemented. Approval
is a documented decision about the existing reason/basis request, not permission to
execute an unspecified future metadata change. A future apply contract must bind an
exact candidate/base and obtain corresponding fresh approval; existing reason-only
approvals cannot be repurposed into automatic changes.

Future application design must use PostgreSQL SERIALIZABLE, re-read evidence and all
coverage/dependency gates, keep amount/range unchanged and block any occupied lot.
The future orchestrator owns the WHOLE transaction and bounded retry of SQLSTATE 40001
with the same key/material; maxAttempts/backoff require validated explicit configuration
(no infinite retries, no nested post(), no independent partial commit). Unknown commit
outcome must be reconciled by key before another action. No retry executor or arbitrary
retry count is introduced in this submission/review stage.

Migration AddCorrectionReview1791896000000 is isolated/additive, no down/backfill or
legacy schema changes. Tested only on exact identity-verified finance test database.
No FinanceModule import into AppModule and no production verifier/authority enabled.


## 6V.5.8-G: immutable exact correction candidates, no application

ClassificationCandidatesService extends the EXISTING correction request/decision
system. Multiple candidates per request are immutable in
finance_classification_correction_candidates. Candidate contains UUID/request/original
part, baseVersion=0/baseHash, normalized proposed metadata, operation ID/version,
trusted actor/participant/context, independent source verification refs, content
fingerprint, semantic intent fingerprint, stable key/hash/time. Base zero means the
existing immutable original part only, not a fictional effective version/head.
Higher bases fail closed until a separately implemented version resolver.

createCandidateWithManager uses request_classification_correction with verified
participant identity matching the requester. No participant/role/money payload fields.
Trusted source verifier validates exact receipt/range/source facts; no UUID/hash proof
fallback. Proposed fields: category, sourceNamespace, sourceEventId, basisReference,
documentReferences. Original GBP/amount/offset/receipt/lot are immutable DB facts.
Independent verification receives a copy; mutation cannot redefine expected facts.

reviewCandidateWithManager uses separate review_classification_correction and
verifyExactDecisionBasisWithManager with requestId/candidateId/fingerprint/decision.
Reason-only verifyDecisionBasisWithManager is NOT a fallback for exact review.
Production DisabledCorrectionAuthority denies all new capabilities. Existing adapters
without these optional capabilities explicitly fail exact candidate operations.
Synthetic source/document/identity truth maps exist only in tests.

Content fingerprint covers schema v1, request/part/base/evidence/normalized metadata,
trusted identity/context and persisted source verification refs. Random candidate UUID,
key/time do not define content. A separate intentFingerprint excludes technical request/
actor/candidate IDs and proof occurrence IDs, but includes original part/base hash/bank
operation+version and the exact proposed metadata/document references. Canonical facts
ordering and sorted normalized document UUIDs avoid JSONB ordering differences.
Same key changed material conflicts; same key replay keeps original UUID/fingerprint.

createLinkedRequestWithManager independently checks request rights/identity/context
and eligible bank evidence before NEW creation. Immutable linkedFromRequestId is in
the original request table; no parallel workflow. Parent/child part/context must match,
verified identities throughout ancestry, no cycles. A new linked request inherits NO
approval, and cannot mutate prior reason/decision/history. Historical NULL participants
cannot be linked/adopted automatically. Current identity checks compare participants,
not technical account IDs. Review rejects ANY initiator participant in the ancestry;
legacy reason-only review also receives this ancestry guard for linked requests.

Existing UNIQUE(requestId,operationVersion) remains, so multiple candidates still share
one decision slot. Historical reason-only decisions get NULL candidate bindings with
NO backfill. Exact review on a busy legacy slot returns LEGACY_DECISION_REQUIRES_LINKED_REQUEST.
A new linked request gets a fresh candidate/review, not a reused old approval.
Two additional DB partial UNIQUE indexes enforce cross-request invariants:
- one exact approved decision per originalPartId/baseVersion/operationVersion;
- one exact approved OR rejected intent per that scope plus intentFingerprint.
Therefore different request IDs or metadata cannot produce two active exact approvals
of the same original base/evidence scope. An identical rejected intent cannot be
approved via a different request in that evidence version. No supersession exists.
A new genuine bank version requires a new candidate/current independent review; prior
rejected/approved candidate records never change status by replay or linkage.

Decision history stores candidateId/fingerprint/originalPart/base/intent bindings.
A candidate's protected base hash is rechecked before exact review. Current bank state
must eligible and version match BOTH candidate and command. Exact replay returns old
decision/candidate/fingerprint/version with CURRENT blocked/stale, no new approval.
Reason-only approved state remains a historical review state, never an exact apply basis.
Every candidate/review result explicitly has applicationImplemented:false.

Same active READ COMMITTED manager/outer transaction: authorization -> scope -> identity
-> operation -> lot -> receipt -> request -> candidate -> decision. Unique constraints,
immutable ancestry, bank locks and DB insertion guards protect concurrent metadata
operations. Whole rollback includes linked request/candidate/decision. This stage does
not test a zero-coverage predicate or spend cash, so coverage writers are unchanged.

AddCorrectionCandidates1791897000000 adds candidate table, nullable link/binding columns,
immutable guards and cross-request indexes. No old financial history UPDATE, no automatic
down. Applied only to identity-verified isolated finance database. No original parts,
allocations, ledger or outbox changes; no effective head, apply, income or own-free.
Production adapters remain default deny; FinanceModule remains disconnected.

Future lot-generation protocol and authorization freshness/retry configuration remain
DESIGN ONLY in work/finance-6v5-8D-transition-and-lot-protocol.md and 8C. No control table
or writer hook is implemented. Independent production auth epoch, bounded retry values
and optional extra reviewer/executor separation still need future approval.
Cross-request invariant was designed before code in work/finance-6v5-8G-cross-request-invariant.md.
