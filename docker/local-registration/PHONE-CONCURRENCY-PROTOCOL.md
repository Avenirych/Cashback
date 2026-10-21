# Registration migration concurrency protocol — source-only, no runtime admission

## Threat boundary

Only the exact REGISTRATION_PHONE_EXPECTED cluster/container is supported. Expected
constants do not attest current state. The old random-name Harness retains its gates
and is not admitted by this protocol. No new migration runner/CLI is introduced.

Relevant competitors include another client/runner doing DDL, owner changes, GRANT/
REVOKE, role creation/alteration and membership changes, including operations between
B preflight and C apply and during an apply transaction. A superuser, DB/object owner,
role administrator or Docker/host administrator may ignore an advisory lock. Transaction
isolation and table locks do not exclude new objects or cluster-wide ACL/role changes.
Snapshots/hashes cannot detect an intervening change followed by restoration.

## Implemented state machine

PhoneConcurrencyProtocol in src/docker-phone-concurrency.ts is a verifier state
machine inside the existing Harness, not an access-control implementation.

| State/transition | Conditions |
| --- | --- |
| BLOCKED (initial) -> PREPARED | Fresh opaque registration target evidence; independently reviewed before-schema and security fingerprints; BASELINE or B receipt; active exact QueryRunner; observed backend PID, backend start and transaction identity; exact target, schema/security/history; local cluster reservation. |
| PREPARED -> VERIFIED | Opaque evidence owned by an INDEPENDENT authority; valid nonreusable, session/review/snapshot-bound lease; full-cluster DDL/ACL/role/admin-entrypoint scope; fresh observations before and after verification. |
| VERIFIED -> APPLY_ELIGIBLE | Intentionally UNAVAILABLE: unchanged PHONE_APPLY_CONCURRENCY_VERIFIED=false and no verified atomic exclusion mechanism. C (or the separate BASELINE receipt), lease liveness and in-transaction snapshot checks are required but cannot open this gate. |
| Any failure -> BLOCKED | Latched terminal refusal: fresh instance, independently issued new proof and new checks required. No automatic retry or access restoration. |

VERIFIED means an independent lease was observed, not that the Harness proved its own
exclusive access. NO production authority or production concurrency observer is
installed. Only fixtures exercise PREPARED/VERIFIED now; they are NOT runtime evidence
or B/C approval. A caller-supplied string, JSON, env flag or serialized object is not
accepted as an authority-issued proof. Trusted source composition of an authority is
itself a security boundary; never expose that injection via HTTP/CLI/env configuration.

The independently reviewed before-schema hash must be the B before hash for seventh,
or the reviewed empty-schema hash for baseline. Security hash is the separate target
role/ACL approval. The baseline source order 1-6 and seventh history/schema validators
remain unchanged. BASELINE is not a replacement for seventh B/C authorization.

## Independent access-control interface (no access changes implemented)

IndependentExclusivityAuthority owns evidence issuance and global exclusive leases:
- ownsEvidence must recognize opaque, nonserializable tokens from its own protected
  ledger, never accept JSON claims merely because they have matching properties;
- verify must independently attest the enforced access boundary and single-controller
  fencing for the exact session/snapshot/review binding;
- inspect must verify the same live lease/epoch, not return a previously cached claim;
- it must cover existing privileged sessions, reconnect/SET ROLE paths, object owners,
  ACL and role administrators and Docker/host-admin entrypoints, not only app traffic;
- it must prevent another process from obtaining overlapping authority and revoke or
  fence old controllers after disconnect, timeout, restart, lease loss or epoch change.

The contract has no acquire/restrict/kill-session/grant/revoke/restore implementation.
Actual enforcement and independently reviewed authentic evidence transport/verification
remain separate work. If privileged entrypoints cannot be controlled and independently
attested, APPLY_ELIGIBLE must remain unreachable. No receipt or flag substitutes for
those guarantees. The extra in-process reservation only rejects another local protocol
instance; it is not distributed exclusion and is not an advisory-lock guarantee.

## TOCTOU/session lifecycle

The observer contract is read-only and must independently collect complete identity,
actual session/backend identity, role/ACL/membership and schema/history facts in the
same migration QueryRunner. There is no default implementation that invents facts.
Backend PID alone is insufficient; backend start and transaction identity are bound.
Replacing the QueryRunner, reconnecting behind it or changing transactions invalidates
admission. Observation age is at most 5 seconds, target evidence at most 30 seconds,
lease at most 5 seconds; verifier/observer calls time out after 1 second and receive an
AbortSignal. Fresh timestamps alone cannot hide a changed fingerprint or history.

Before a transition, after asynchronous verification and immediately before future
mutation admission, the snapshot/receipt/session and lease are rechecked. Failure,
timeout, revocation, clock anomalies, identity/role/schema/ACL/history drift or session
change latch BLOCKED. Single-use evidence is consumed on the verification attempt;
failed attempts cannot replay it. Concurrent method calls also invalidate the instance.
The getter reports local expiry but cannot synchronously discover remote revocation;
VERIFIED is never an apply token. Every mutation admission requires live authority and
fresh in-transaction observations, and still fails the closed gate.

The existing runner accepts an optional typed concurrency control only for the
registration branch. Baseline remains blocked BEFORE connection by the existing gate.
Seventh apply retains B/C receipt validation, fresh post-lock schema inspection and
the closed gate before up(). Dormant registration mutation paths additionally require
an actual PhoneConcurrencyProtocol instance and its three checks. Its final admission
also unconditionally refuses ATOMIC_EXCLUSION_NOT_IMPLEMENTED even if an exported
module flag were tampered with. Cleanup closes local protocol state when reached,
without changing the external access controller or ACLs. Generic TypeORM migration
entrypoints, down(), automatic retry and automatic cleanup remain forbidden.

No protocol state crosses a process restart. A crashed process loses its local token;
the independent controller must retain/fence the old lease. Local close releases only
its own process reservation; it cannot revoke/restore external permissions. Unknown
commit acknowledgement remains COMMIT_OUTCOME_UNKNOWN: rollback is not proof of failure.

## Future real concurrency trials — NOT AUTHORIZED/EXECUTED

All trials require new specific permission for the exact registration cluster, fresh
Docker/SQL identity, separately approved role/ACL stage, independent controller,
reviewed fingerprints and B/C/BASELINE receipts. Never use old Cashback or finance DBs.
Do not perform destructive operations on real users. Define synthetic test objects and
administrative access-restoration authority before starting. No production gate change
is authorized by this test plan.

| Trial | Expected refusal/blocking | Recovery under separate authority | Success evidence |
| --- | --- | --- | --- |
| Second client attempts DDL or owner change, including create/drop-return-to-original | Enforcement prevents the operation during the entire lease, or revokes admission before mutation. An unchanged final hash alone is insufficient. | Roll back synthetic client transaction; investigate boundary loss; do not retry Harness. | Independent controller audit/fencing evidence plus both session results and unchanged approved catalog. |
| Concurrent GRANT/REVOKE, including an administrator ignoring advisory lock | Connection/privilege boundary prevents it; changed ACL or failed liveness yields BLOCKED. | Inspect effective/PUBLIC/default ACLs; restore only separately approved baseline. | Denied competitor operation or fenced migration, no unapproved committed ACL. |
| Concurrent role creation/ALTER ROLE/membership/SET ROLE | Global role/admin boundary prevents operation or invalidates lease; cluster-wide scope is essential. | Review full roles/memberships and revoke stale lease; no automatic privilege reset. | Independent audit of denied/fenced action and approved role fingerprint. |
| Parallel Harness processes | Independent authority grants one fenced controller, refuses the other; local Map alone does not pass this trial. | Stop the refused run; inspect winner/commit outcome before any new lease. | Distinct processes/epochs, exactly one admitted controller, no duplicate history. |
| Change schema/ACL/history after B and before C or between asynchronous checks | New snapshot differs or lease is revoked; no seventh up()/history insert. | Re-inspect exact target, independently review new fingerprints and obtain new receipts/proof. | BLOCKED reason, transaction rollback, no unexpected history/phone columns. |
| Kill/disconnect controller after verification, during migration or around COMMIT | Old session/lease becomes unusable; replacement session cannot reuse proof; uncertain commit is never auto-retried. | Separately authorized read-only investigation of schema/history; independently fence old lease before deciding next action. | Revoked epoch, failed replay, recorded session change and explicit known/unknown commit outcome. |
| Lease expiry, verifier timeout or loss of independent authority | BLOCKED with no new mutation admission; late verifier result cannot promote state. | Investigate/replace authority, explicitly obtain a new lease; no automatic access restoration. | Abort/timeout record, latched BLOCKED and rejection of old proof. |

Full continuous exclusion between checks is NOT established by source tests. Opening
apply requires independently reviewed actual enforcement, real multi-session trial
results, explicit source-change approval and current receipts. This task changes none
of Docker, PostgreSQL, roles, ACLs, secrets, owner policy, admission or migration sources.

## Independent decision controller (source-only)

PhoneMigrationAccessController now implements the authority decision interface and
collects from five separately defined protected source interfaces. Production source
configuration is deliberately null, so real requests remain BLOCKED:ADAPTERS_MISSING.
PhoneConcurrencyProtocol can request its opaque evidence and subscribes to revocation.
No real enforcement/adapter or mutation eligibility was installed. See
ACCESS-CONTROLLER-PROTOCOL.md for lifecycle, trust boundaries and future real trials.
