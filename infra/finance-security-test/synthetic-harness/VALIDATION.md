# V1.3 static review record — 2026-10-15

Status: NEEDS FIXES for runtime acceptance; V1.3 source changes NOT EXECUTED.

Historical observations retained from earlier source reviews (not rerun at V1.3):

- All new paths are inside synthetic-harness. V1.3 edits only its authorized
  existing sources/docs and adds one unit/mock test file.
- Standalone Compose has one pg service, exact pinned PostgreSQL image,
  unique required names, own volume and internal network, no published ports.
- No existing data-volume/network reference is used as a connection/mount.
- Existing cluster IDs occur only as explicit deny boundaries/documentation.
- Manifest null IDs/hashes are intentionally BLOCKED, never fictitious evidence.
- Admission checks Docker independently of SQL identity, before mutations;
  rejects missing metadata, extra mounts/networks, changed image/source and
  the two prohibited cluster IDs. It does not offer a skip-gate argument.
- No default provisioning/lifecycle/cleanup launcher exists.
- Secrets/SCRAM and preflight cases are UNIT/MOCK; integration is distinct.
- Actual verifier is registered in-memory; diagnostics remain INCONCLUSIVE until
  complete collection; markers/raw errors are not returned to reporting code.
- Commit uncertainty uses reconciliation without retry; fresh cluster per case.
- No real secrets, env files, server logs or PGDATA were read.

NOT EXECUTED:

- Python syntax/compiler/import/dependency resolution and every unit test.
- Docker/Compose validation, image verification, builds or lifecycle operations.
- PostgreSQL identity, SQL fixtures, provisioning, ACL/ownership, rollback,
  real libpq encryption or concurrent/network-fault experiments.
- Runtime log collection/scanner integration and real positive leak control.
- Cleanup and operating-system path/ACL/reparse-point validation.

Known blockers / incompleteness (no implicit PASS):

1. Host/worker stdin transport is now implemented in source, NOT EXECUTED;
   separately approved created runner/image and scoped approvals are absent.
2. Exact-ID diagnostics collector is implemented, but Docker log retention,
   stream completeness, rotation and server-file logs remain UNPROVEN.
3. No independently approved new IDs/source hashes; manifest is a template.
4. Real audit/pending-restart fixtures not implemented under exact image gate.
5. COMMIT loss uses deterministic adapters, not actual network interruption.
6. Filesystem snapshot mutation is MOCKED; atomic cross-file snapshot not claimed.
7. Controller/worker/collector/oracle wiring exists; all runtime validation and
   parent __main__ error-rendering integration remain NOT EXECUTED.
8. Offline Dockerfile/allowlist prepared; no build or immutable runner image ID
   is confirmed. Existing tooling image is not assumed to contain new sources.

V1.1 additional source observations:

- Exact pre-created runner only; START needs separate manifest-bound approval.
- Attachment constructor repeats admission itself; calling it directly cannot
  skip target/runner/source/start-approval gates.
- No create/build/pull/up/remove/stop/cleanup path in controller.
- Host inspections/start/log reads pin desktop-linux; no runtime context fallback.
- No runner mounts, socket, host ports/networking or privileged mode accepted.
- Non-root, read-only, cap-drop ALL, no-new-privileges, exact entrypoint/image.
- Private nonce/hash/case protocol; repeated GO refused. SQL identity on actual
  runner connection precedes any admitted writes and repeats per connection.
- Only public synthetic fixtures in runner memory, no credential argv/env.
- Unknown/missing diagnostics and scanner failures cannot become PASS.
- Docker captures are forced UNPROVEN; collector cannot claim full log coverage.
- Safe report schema rejects unknown fields; no raw diagnostics serialized in
  reports. Diagnostic bytes only travel in private stdin to in-memory scanner.
- Incomplete/unknown COMMIT outcome never causes a controller/worker retry.
- Both existing clusters remain prohibited, provisioning unchanged and BLOCKED.
- Legacy host SQL callback path is CLOSED (signature retained, callback never
  invoked); only protocol-bound RunnerAdmission and exact approved case can
  reach integration dispatch. No compatibility fallback opens a connection.
- V1.2 replaces whole-output Docker log capture with concurrent binary readers,
  per-channel and shared saved-byte limits applied during reads, timeout and
  bounded child cleanup. Unconfirmed cleanup blocks further collector children.
  The collector budget is not a bound on Docker daemon memory or exact RSS.
- Docker history completeness remains UNPROVEN regardless of CLI exit status.
  All eight incomplete/error flags prevent PASS; a detected leak dominates them.
- Scanner overlap covers chunk boundaries; unread remainder and scanner errors
  are explicit. New mock tests cover binary streams, limits, timeout, cleanup,
  read errors, nonzero exit, split markers and incomplete oracle evidence.
- Tests, syntax checks, compilation and all commands were NOT EXECUTED.
- Static review uses available source snapshots and exact patch context; this
  does not substitute for a future independent full-file and runtime review.
- V1.2 BLOCKED (superseded below): worker.py MemoryText could encode an unbounded incoming
  string and accumulate empty fragments. Its correction requires authorization.
- V1.2 BLOCKED (superseded below): the report protocol omitted detailed completeness proof.
  Facts-only oracle calls cannot return global PASS. No forbidden caller or
  protocol file was changed to bypass this restriction.

The existing finance-security cluster remains untouched; its provisioning is
BLOCKED. This is a synthetic testing artifact, never production-ready.

V1.3 static changes supersede the V1.2 worker/protocol source blockers:

- Worker diagnostics share one 2 MiB / 2048 fragment sink. Fragments are at most
  4096 bytes, text encoding uses at most 1024 characters at once, and empty
  writes never append. Joins are bounded. Caller-owned buffers and exact RSS
  are not controlled by this sink and are not claimed bounded by this review.
- Exception rendering was removed; omitted details explicitly truncate capture.
- Worker stdout/stderr remain client diagnostics, never merged into host Docker
  capture. External completeness is downgraded before scanning/reporting.
- Mandatory structured metadata is strictly validated. Unknown/missing fields
  cannot yield PASS; worker external COMPLETE assertions are refused.
- Scanner reports bounded examination independently from capture completeness.
  Leak remains FAIL; all incomplete/unexecuted conditions remain non-PASS.
- Controller.py, admission, SQL identity and commit/retry machinery are unchanged.
  Existing controller final facts-only aggregation cannot grant PASS.
- No resource lifecycle or cleanup code was added. No secret/argv/environment
  transport was added. REPORT contains metadata only; private capture bytes
  still flow only to the bounded in-memory scanner over attached stdin.
- New mock tests cover worker limits and the strict evidence schema; existing
  oracle/wiring expectations were updated. All are NOT EXECUTED.

Only authorized Get-Content source reads and file patches were used. Python,
compilation, imports, tests, linters, Docker, SQL, Git, provisioning, secret/log
reads and cleanup were NOT EXECUTED. Independent runtime verification, trusted
external-history evidence and a future reviewed host proof aggregation remain
outstanding. No operational readiness or absolute no-leak claim is made.
