# Real access adapters readiness — source-only implementation

No Docker/PostgreSQL connection, SQL, role/ACL change, migration or service launch was
performed. Tests replace all transports. This document is the consolidated readiness
report; it grants no infrastructure or migration authority.

## Implemented adapters and concrete sources

| Adapter | Implemented production path | Current prerequisite/blocker |
| --- | --- | --- |
| ProductionDockerAdapter | execFile with shell:false, stripped inherited Docker/Compose overrides, bounded output and timeout. Transport allowlists ONLY exact read-only context/info/inspect/image/volume/network argument arrays for the registration target. Checks daemon/full ID/labels/image descriptor+platform/mount/network/health/no ports and repeats context/container/daemon checks. No exec/run/up/pull/build or old-container lookup exists. | Code can inspect an explicitly authorized daemon. It was NOT run here. Expected constants are never accepted without observations. |
| ProductionPostgresAdapter | pg.Client with fixed observer role/DB/port, peer IP obtained from the independently verified Docker target, no DATABASE_URL/env credential fallback. Read-only defaults at connection startup; REPEATABLE READ READ ONLY transaction; statement, lock, idle and connection limits; rollback/end on failure. | No approved observer credential source, protected migration-session directory or deployment route to the private Docker IP. Not connected. |
| ApprovedFingerprintsAdapter | Bounded HTTPS (no redirects) to an owner-pinned endpoint; Ed25519 public-key/issuer/key-ID/audience/purpose/version validation; exact target/review, fresh signed challenge/nonce and expiry checks. | No independent approval service/public trust anchor has been approved or installed. No fingerprint was approved. |
| ApprovedReceiptsAdapter | Same independent signed transport, with complete B+C or BASELINE, exact identity/session/operation/review and before/after hashes; single-use nonce ledger and fresh per-request challenge. | No real receipt issuer, trusted public key or B/C receipts. No receipt generation/signing exists in production. |
| ProductionConnectionControlAdapter | Production readiness/observation interface wired to the existing authority. | Always BLOCKED:EXCLUSIVITY_NOT_ENFORCED. No administrative connection restriction, continuous exclusion or durable multi-process fencing is implemented. |

The production source registry now lazily composes these adapters, with no import-time
IO. This is code composition, NOT a claim of independent deployment. They use the
production-adapter provenance value; existing independent-source fixtures remain tests.
Before ANY transport IO the existing Access Controller calls readiness prerequisites,
starting with administrative fencing. Thus its current production decision is
BLOCKED:EXCLUSIVITY_NOT_ENFORCED without executing Docker or PostgreSQL calls. The
source-only production decision was verified with mocks, not a live admission run.

Direct observer methods also fail closed: missing observer authority yields
OBSERVER_AUTHORITY_MISSING; missing approval issuer yields APPROVAL_AUTHORITY_MISSING.
Raw transport/driver errors are replaced by stable safe adapter codes. Passwords,
connection strings, SQL diagnostics and raw Docker responses are never emitted.

## SQL observer and fingerprint semantics

The observer is a distinct future registration_observer login, never the backend's
registration_bootstrap identity. Backend remains cashback_test only, subject to its
unchanged readiness policy. Do not reuse bootstrap/app credentials for the observer.
A separately approved protected ObserverCredentialSource must supply its credential;
no secret file/env loader is added. The public connection transport is explicitly
bound to port 5432, cashback_docker_test, registration_observer, read-only startup
options and the reviewed private network (ssl:false is explicit for this local Docker
network). Placement/network routing must be separately reviewed; do not publish a host
port to make this work or expose credentials over an untrusted network.

The independent observer verifies system identifier/OID/DB/version/owner, actual SQL
server address/port, its login, read-only settings and the separately enrolled migration
session's backend PID/backend start/transaction. Session selectors come from a trusted
protected directory and are bound by a hash; SQL uses parameter values, never interpolated
selectors. pg_stat_activity identifies that session only; it does NOT prove exclusivity
or prevent new connections. Session metadata is re-read after the observation transaction.
A directory must enroll the actual backend using the exact observer timestamp/string
representation, not accept Harness/env declarations as enrollment proof.

Minimum future grants must be separately reviewed: connect, required catalog metadata,
narrow EXECUTE on pg_control_system(), schema usage/read on migrations after creation,
and visibility of the enrolled backend's start/transaction (e.g. a carefully reviewed
pg_read_all_stats grant for the observer, not the backend, or an independently reviewed
narrow metadata interface). The current subscription/large-object metadata queries may
also require narrowly reviewed read permissions. Permission denial is BLOCKED, never a
reason to run this adapter as bootstrap/superuser or to skip a catalog check. No roles,
views, functions, grants or passwords were created by this task.

Schema measurement reuses PHONE_CATALOG_SQL. Only its fixed current_user expressions
are replaced with the constant SQL literal 'cashback_test', so effective privileges
are measured for the migration role without SET ROLE. No user-controlled SQL text is
inserted. The strict PHONE_SCHEMA_V2 hash and first-six roster are unchanged. Empty
bootstrap measurement has a distinct PHONE_EMPTY_SCHEMA_V1 hash with a closed set of
metadata families, required public namespace and no user relations/routines/extra
extensions. It cannot stand in for a baseline-six fingerprint. Actual history must be
absent for baseline, or exactly ordered 1-6 for seventh. Unsupported objects and
subscription/large-object metadata cause refusal. Observed hashes NEVER become approval.
Independent approved hashes must be produced/reviewed for the exact version/role stage.

## Approval integrity, freshness and replay

TrustAnchor contains only a separately pinned public key, immutable issuer/key-ID,
purpose, audience and HTTPS endpoint. No key is generated/installed by production code.
Ed25519 signing keys used in unit tests exist only in memory, are never saved, and are
not real authority credentials. Harness cannot install a trust anchor using CLI/env.
Arbitrary local JSON is not loaded or trusted.

Signed envelope format is cashback-registration-approval/v1, revision 1. Signature
covers canonical UTF-8 JSON of all fields except signature, including exact full target,
review hash, purpose/audience/issuer/key-ID, payload, issuedAt/expiresAt, authority nonce
and a fresh random 256-bit NONSECRET request challenge. Requests include that challenge;
an old signed response cannot satisfy a restarted reader with a new challenge. Responses
are bounded to 128 KiB; trust endpoints cannot redirect or contain URL credentials.
Validity is at most 5 seconds. Each observation requires a newly signed current response
from the approved ledger, not a re-signed measurement by the migration process.

Nonce reuse is rejected even within validity. Reader ledgers fail closed at capacity
rather than evict and permit replay. A fresh signed ledger response may attest the same
underlying reviewed artifact/approval ID during revalidation, with a fresh challenge and
nonce; this is not a new approval or permission to replay a migration. Controller opaque
proofs remain one-use/session-bound and leases never renew their original deadline.

## Remaining exclusion and infrastructure work

The controller's local bookkeeping and these observers do NOT prevent concurrent DDL,
GRANT/REVOKE, owner/role/membership changes, another runner, privileged reconnects or a
Docker administrator. Unchanged hashes, zero pg_stat_activity rows or an advisory lock
are insufficient. Source error/change detection invokes invalidation listeners; no
continuous remote administrative-loss feed or enforcement has been deployed. Existing
750 ms controller and 1 second protocol deadlines remain unchanged and may reject slow
real transports. They are not relaxed to manufacture PASS.

Administrative fencing requires an independently authenticated maintenance authority,
control over existing and new privileged connections/SET ROLE paths, protected migration
session enrollment, durable global epochs, continuous revocation and a fail-closed
critical interval from admission through commit. Trusted host administrators remain an
explicit assumption; absolute protection against them is not claimed. Until real
mechanisms and adversarial multi-session tests are reviewed, the connection adapter
must keep EXCLUSIVITY_NOT_ENFORCED. No bool/env/signed claim alone opens that adapter.

## Separately authorized next stages and safe migration path

1. Approve exact target read-only infrastructure trials; reverify current daemon,
   container/image/volume/network and SQL system identifier/OID/version before use.
2. Approve isolated observer deployment/network routing, minimal observer-role grants,
   a distinct credential source and authenticated session directory. No host port or
   existing resources may be repurposed to bypass the approved boundary.
3. Independently provision approval/receipt authorities, review public trust anchors,
   artifact formats/hash algorithms, expiry/revocation and signed challenge semantics.
   Obtain genuine reviewed fingerprints/BASELINE/B/C receipts; never approve adapter
   measurements automatically.
4. Separately authorize actual maintenance access restrictions and external durable
   fencing, and implement its authenticated observation adapter under review. Current
   source-only task does NOT supply or authorize those restrictions.
5. Exercise the existing ACCESS-CONTROLLER-PROTOCOL.md and PHONE-CONCURRENCY-PROTOCOL.md
   trial matrix ONLY on this new cluster: competing DDL/ACL/roles/memberships, parallel
   runners, preflight/apply drift, observer/authority loss, expiry, process kill and
   uncertain commit. Record independent fencing/audit plus schema/history outcomes.
   Failure means STOP/read-only investigation, not automatic ACL reset/down/retry.
6. Review actual timing, privileges, rollback/disconnect and exclusion-through-commit
   evidence. Any gate-opening source change requires separate explicit review/permission.
   Existing PHONE_APPLY_CONCURRENCY_VERIFIED=false and the unconditional atomic-exclusion
   refusal stay unchanged here; APPLY_ELIGIBLE is still inaccessible.
7. Only then request exact baseline/migration permissions and use the SAME Harness:
   baseline 1-6, independent history/schema review and B/C authorization, then seventh.
   Old random-name Harness, seventh E.164/SMS-consent rules, registration readiness,
   Mailpit guard and owner policy/admission are not weakened.

No commit/push, real SQL, Docker operation, role/ACL write, secret change, migration or
application launch was performed. STOP after source-only implementation.

## Source-only validation results

Backend TypeScript no-emit: PASS. Focused no-emit checking of the adapter/controller/
concurrency tests: PASS. Jest: 288 tests in 10 suites passed, including production
adapters with replaced transports, Ed25519/replay/challenge tests and the existing
Harness/readiness tests. git diff --check: PASS (existing LF/CRLF notices only).
No real transport was used. Observer elevated attributes and administrative memberships
are rejected; only a separately approved non-admin pg_read_all_stats membership is
allowed for this observer. Actual minimal grants and credentials remain unprovisioned.
