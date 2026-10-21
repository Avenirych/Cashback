# Independent migration access controller — SOURCE ONLY

No SQL, Docker operations, infrastructure access control, role/ACL changes or migrations
were performed. Source-only tests establish decision behavior, NOT real exclusivity.

## Architecture and trust boundaries

PhoneMigrationAccessController implements the existing IndependentExclusivityAuthority.
Harness -> PhoneConcurrencyProtocol -> controller -> five independently configured
sources. Harness supplies correlation hashes only (session, snapshot, reviewed receipt
material); it cannot supply the observed facts, approved fingerprints or receipt ledger.
The controller never executes a migration and introduces no CLI or alternate runner.

The five adapter interfaces live in src/docker-phone-access-sources.ts:

| Independent source | Required authenticated observation |
| --- | --- |
| Docker observer | Current context/daemon, exact project/container/image/platform, service label, running/healthy, actual mounted volume/private network only, no host port, peer IP. |
| PostgreSQL observer | Exact cluster/system identifier, DB OID/name/owner/version, role, backend PID/start/transaction, schema/history and full role/membership/DB/schema/default ACL inventory. |
| Administrative connection controller | Continuously enforced exclusive maintenance boundary, current session-bound fencing lease/epoch, zero uncontrolled privileged sessions/entrypoints and competing runners, invalidation signals. |
| Approved fingerprint source | Independently reviewed before/after schema and full security fingerprints, operation and approved review-material hash; never learned/approved from observed DB state. |
| Approved receipt source | Separately authenticated, current B AND C receipts for seventh, or BASELINE for baseline; bound to exact identity/session/review and schema transition. |

Production configuredIndependentMigrationSources() deliberately returns null. There is
no setter, env/JSON loader, CLI switch, mock adapter or fallback implementation in
production code. A future adapter installation requires separate source/security review
and infrastructure permission. Constructor arguments from Harness cannot install sources.
The provenance tag and distinct source IDs reject test/combined adapters but do not prove
independent deployment; authenticated transports, protected ledgers and issuer review are
still required. Tests replace this closed registry with Jest and simulate protected
sources entirely inside *.spec.ts. Those fixtures are not runtime credentials.

Expected identity is the existing REGISTRATION_PHONE_EXPECTED boundary: desktop-linux,
daemon ec3d6303-4d66-4410-8317-b739cebc046c, registration project
cashback-registration-20261016-4f8c2a96b17d, container
e0818fd64b0149f50ed975d8a519ffc4b615dcff9544a403f224fd82a2291d88,
cluster 7697703338450784294, cashback_docker_test OID 16384, version 170011,
registration_bootstrap owner and the exact new pg17-data/database network names.
These are expectations only; independent adapters must observe and prove them anew.

## Lifecycle and validation

REQUESTED -> EVIDENCE_COLLECTED -> INDEPENDENTLY_VERIFIED -> EXPIRED/REVOKED.
All failures return structured BLOCKED (no raw adapter diagnostics). Missing real adapters
return BLOCKED/ADAPTERS_MISSING. INDEPENDENTLY_VERIFIED is only an observation of a
separately enforced boundary, not an assertion that this controller enforced access.

Independent sources are collected concurrently and bounded to 750 ms; cancellation
propagates AbortSignal. Observations must be no older than 5 seconds. Identity, actual
Docker/SQL peer, session and schema/history/security must all match the approved review.
Every receipt is independently retrieved and validated; Harness B/C validation remains
in addition, never replaced. Fingerprint hashes cover role attributes/memberships and
DB/schema/default ACLs; incomplete security inventories are rejected. Seventh history
is exactly ordered migrations 1-6; baseline history must be empty. Existing migration
source order, E.164/SMS-consent rules and old random-name Harness are unchanged.

Opaque evidence is an in-memory object recognized only by its issuing controller.
It is bound to the cluster/DB/session, operation/review, complete snapshot and external
fencing epoch. verify consumes it once and independently rechecks every source. Copies,
JSON serialization, env/CLI strings and another controller cannot mint/consume that proof.
A returned lease is not a bearer credential: inspect additionally requires the original
issuing controller record, consumed proof, exact binding and fresh independent observations.

Lease lifetime is at most 4 seconds and is further bounded by source/receipt expiry.
Revalidation never extends it. Clock regression/expiry blocks it. A changed or shortened
external lease, changed epoch, source replacement, observer error/timeout, snapshot drift,
missing receipts or changed session revokes admission. Another request to the same local
controller is refused while a record is live; cross-process exclusion MUST be enforced
by the independent administrative controller, not this in-memory bookkeeping.

Every adapter must report invalidation/disconnect through onInvalidated. The controller
immediately invalidates its records and notifies subscribed concurrency protocols when
such an event is delivered. A source event during collection invalidates the result;
a late response cannot promote it. Continuous remote-loss detection and fencing latency
are the external infrastructure's responsibility; callbacks are not an absolute network
partition/host-administrator guarantee. Loss may also be found by mandatory live rechecks
and expiry. Without real enforcement no mutation admission is possible.

## Harness integration and gates

PhoneConcurrencyProtocol.verify() may now request controller evidence after PREPARED
when no explicit opaque evidence was provided. It still validates ownership, consumes
the proof, checks session/snapshot before and after verification and subscribes to
revocation. A controller event latches the protocol BLOCKED. Explicit legacy fixture
proof paths retain their checks. Cleanup unsubscribes locally without manipulating ACLs
or the independent controller's infrastructure lease.

The existing runner already invokes prepare/verify/assertApplyEligible at registration
mutation boundaries. Optional evidence in PhoneConcurrencyControl enables this controller
path without another runner. No default observer is invented and no application service
is started. Old cashback_phone_migration_check_<30 hex> behavior and B/C gates remain.
PHONE_APPLY_CONCURRENCY_VERIFIED=false is unchanged. APPLY_ELIGIBLE remains unavailable,
including with successful fixture controller confirmation. The additional
ATOMIC_EXCLUSION_NOT_IMPLEMENTED refusal remains as well.

## Threat model and unavailable guarantees

Competitors may perform DDL, owner changes, GRANT/REVOKE, role/membership changes or
another migration between B/C or while up() is running. Advisory locks and ordinary
transactions do not prevent a superuser from those actions. Independent enforcement
must cover existing sessions, reconnects, owners/SET ROLE paths, role administrators and
operator entrypoints for the whole critical interval. Merely observing zero sessions
or unchanged before/after hashes cannot detect an intervening change/reversal.

A Docker/host administrator can replace/kill a container/controller, alter networking
or interfere with observations. There is NO absolute protection from such an actor.
Future maintenance control must define trusted administrators, authenticated independent
observer/controller channels, global fencing and detection/fail-closed behavior. The
source implementation alone implements none of the infrastructure restrictions.

Still absent: deployed Docker/SQL observers, authenticated fingerprint/receipt services,
real administrative access enforcement, durable multi-process fencing/revocation,
a production same-session observer and an atomic enforcement-to-mutation boundary.
No genuine B/C receipts, independent role/ACL hashes or runtime-role setup are approved
by this task. Passing mocks cannot remove any of these blockers.

## Future real trials — new registration PostgreSQL ONLY, NOT EXECUTED

Trials require separate exact-target read/write integration permission, an approved
maintenance/role stage, independently reviewed fingerprints and BASELINE/B/C receipts,
permission for the external access-control changes and a reviewed recovery procedure.
Enrolling a real adapter requires independent authentication/provenance review, not
just changing its provenance string. Old Cashback and finance PostgreSQL remain excluded.

| Trial | Expected outcome | Recovery/evidence |
| --- | --- | --- |
| Concurrent DDL/ownership change from another session, including administrator ignoring advisory lock | External boundary prevents action, or revocation fences migration before any further write admission. | Separately authorized rollback of synthetic work; controller audit, both session results and catalog/history inspection. |
| Concurrent ACL/default ACL/role/membership/SET ROLE change | Operation denied or admission REVOKED; changed full security fingerprint cannot pass. | Independently review effective/PUBLIC/default grants and memberships; restore only under separate permission. |
| Parallel migration processes | One global fencing lease; loser BLOCKED, stale epoch unusable. | Verify no duplicate history and no overlapping admitted controllers; local Map-only results do not pass. |
| Schema/history/fingerprint change between preflight and apply | Receipt/snapshot mismatch or revocation; no seventh up()/history write. | Fresh independent review and new receipts/proof, never auto-approve observed changes. |
| Observer/admin channel loss, revocation, timeout or lease expiry | Controller REVOKED/EXPIRED, protocol BLOCKED; no late confirmation or proof replay. | Repair/re-enroll sources only under separate authority; retain old epochs revoked. |
| Process interruption at verification, migration or COMMIT boundary | Replacement session cannot reuse proof/epoch; unknown commit is never treated as failed. | Separate read-only schema/history investigation; no automatic rerun/down/cleanup. |
| Container/network/volume or SQL peer substitution | Identity/boundary mismatch before migration admission. | Stop, preserve evidence and independently review target; do not update expected IDs automatically. |

Recovery always begins with BLOCKED, preserved diagnostics without secrets, current
identity/schema/history/security investigation and independently fenced old leases.
close() only revokes local records/unsubscribes; it does not restore access or undo a
migration. COMMIT_OUTCOME_UNKNOWN remains unresolved until a separately permitted
investigation. No automatic SQL, retries, role/ACL restoration or Docker cleanup occurs.

STOP. Source-only implementation does not authorize real access control or migrations.

## Production transport implementation update (source-only)

See REAL-ADAPTERS-READINESS.md for the consolidated current status. The registry now
lazily composes production Docker/SQL and signed-approval adapters. This supersedes
its previous null-only implementation; it is NOT independent deployment approval.
Administrative assertReady fails with EXCLUSIVITY_NOT_ENFORCED before transport IO.
Observer/session credentials and approval authority trust anchors are unconfigured.
No genuine exclusivity, fingerprints or B/C approvals have been established.
