# Synthetic security harness V1.3 — FILES ONLY / NOT EXECUTED

This directory is preparation, not permission to execute. Existing 9f
provisioning remains BLOCKED. No default entry point creates infrastructure,
runs provisioning, or deletes resources. Python imports/tests are also NOT RUN.

## Files

- compose.yaml: independent single pg service; required project/run/file inputs;
  exact PG17 digest, own named volume/internal network, no published ports.
- manifest.example.json: deliberately INVALID template until independently
  approved IDs, timestamps, source hashes and synthetic source path are supplied.
- contract.py: strict names/schema, prohibited clusters, 20-GUC oracle.
- admission.py: read-only host Docker checks and shared SQL identity helper;
  legacy host SQL callback activation is CLOSED.
- targets.py: loads current reviewed parent source into isolated module names;
  does not invoke parent's __main__. No source modification or pycache writing
  by this loader is requested.
- integration.py: explicitly invoked synthetic transaction/failure adapters;
  no automatic main execution, transport, Docker lifecycle, or cleanup.
- scanner.py: actual synthetic verifier/credential marker registry in memory.
- oracles.py: explicit facts and exit status; UNKNOWN/missing blocks acceptance.
- test_unit.py, test_admission_unit.py, test_oracles_unit.py: UNIT/MOCK only.
- TEST_MATRIX.md: exact coverage, failure injection and missing runtime fixtures.
- VALIDATION.md: static observations and NOT EXECUTED checks.
- controller.py: explicit scoped START/attach of an already-created exact runner;
  no create/build/pull/stop/remove operations and no automatic cleanup.
- protocol.py: strict JSON frames, manifest digest/nonce/case binding, separate
  approvals and safe report schema. Duplicate keys/unknown reports are refused.
- runner_gate.py: in-runner SQL identity on every actual connection, only after
  private host GO. No Docker socket or localhost fallback.
- worker.py: HELLO/READY/GO/DONE/DIAGNOSTICS/REPORT state machine; sensitive
  material and captured client diagnostics stay in memory, never argv/reports.
- collector.py: exact-ID bounded diagnostic retrieval and source checking;
  ordinary Docker logs remain UNPROVEN, never automatic completeness evidence.
- Dockerfile, Dockerfile.dockerignore: future pinned offline runner packaging;
  context is the parent harness only. No image was built or digest invented.
- approvals.example.json: invalid/unapproved scope templates, not authorization.
- test_wiring_unit.py: new transport/admission/collector/oracle mocks, NOT RUN.

## Isolation / manifest

Future Run ID: independently chosen unique 16 lower-case hex characters.
Project must be exactly cashback-synth-<run-id>; resource names derive from it.
Never substitute the existing Compose project or merely change its -p option.
New PGDATA=/var/lib/postgresql/data/pgdata is on a NEW volume. Default Compose
secrets name is not relied on: explicit target is /run/secrets/bootstrap.

Before creation, independently check names do not exist. After creation,
inventory exact container/network IDs and volume CreatedAt; normalize timestamp
timezone, never compare DateTime to a string. The new system_identifier must be
inventoried independently, then compared to SELECT from PostgreSQL. Never treat
a placeholder as confirmed. Fill manifest only after owner review. Current
manifest template cannot authorize any operation.

Only new synthetic bootstrap path ending <project>/bootstrap is accepted.
Container must have exactly two mounts: approved volume and that read-only file.
No project checkout, Docker socket or other secret mounts into pg. Future
pre-creation path review MUST exclude symlinks/reparse points/hardlink reuse of
existing files. Exact path checks alone cannot prove content provenance.

The five fixtures in integration.synthetic_materials are PUBLIC fictional
values, 01*32 through 05*32 rendered as ASCII hex. They are NOT generated real
secrets. Bootstrap for a future fixture must match the first value; other four
are used only in-memory for SCRAM. No values are printed by the adapter/scanner.
Do not use these weak/public credentials on any externally reachable service.

## V1.1 transport / trust boundary

Preparation and execution are separate. Future setup first creates pg and a
created, never-started runner under a separate resource-creation approval. Manifest
then records BOTH exact IDs and a separately approved immutable runner image
ID (sha256:..., not a mutable tag). Null runner fields block execution. Runner
is not an auto-starting service in Compose and has no mounts or secrets.

Host controller validates context, pinned objects, source hashes and stopped
runner configuration. All inspect/start/log operations pin desktop-linux;
active-context mismatch is also refused. Only exact PG and, while running,
exact runner endpoints are allowed on the new internal network. Exclusive
volume ownership is checked. Runner must be read-only, non-root, cap-drop ALL,
no-new-privileges, no auto-remove/restart, no host ports/networking, no socket.

execute() requires three distinct operator-reviewed approval records bound to
manifest SHA-256, runner ID and ONE case: start_runner, run_scenario,
collect_diagnostics. This is trusted operator scope recording, NOT a production
authorization system. Default module entry points perform no lifecycle action.

Controller starts only the PRE-EXISTING runner with docker start/attach. The
private stdin HELLO carries frozen manifest, fresh nonce and case, never a
password. Worker verifies source hashes and opens its OWN Psycopg connection
to host=pg; SQL identity must match new manifest ID, users, DB and PG17 and
must not match either prohibited cluster. Only then is READY emitted.

Host rechecks ACTUAL running runner/image/network after READY, then sends a
matching GO with run_scenario approval. Worker verifies binding and independently
rechecks SQL identity on every new connection. Until GO and SQL gate PASS,
no changing SQL is admitted. Only allowlisted cases dispatch. The five public
synthetic fixtures are formed inside runner, never argv, environment or mounts.

Trust rests on trusted host/Docker control of this exact container's attached
stdin and pinned worker code, not on a forged network JSON message, JWT or
session variable. There is no public control socket. A malicious Docker/host
administrator or hostile same-process Python is outside this boundary. Digest
binding alone is not a signature or independent authentication of that host.
No absolute protection against privileged tracing, hooks or dumps is claimed.

When DONE arrives, host revalidates exact sources and collects only approved
synthetic diagnostics; bounded raw bytes return by private stdin to the SAME
worker/scanner holding ACTUAL verifiers. REPORT contains only validated safe
statuses, channel IDs, completeness/leak flags and reconciliation category.
No retry follows attachment loss or COMMIT ambiguity. Closing attachment is
not permission to stop/delete any container; failure requires reconciliation.

Host source root must be the reviewed parent harness directory. Manifest hashes
must cover common.py, provision.py and both SQL files. Hashes are deliberately
unfilled here. A trusted driver must also pin/review these new test sources and
transport. Gate and tests run under trusted operator control, not hostile
same-process Python. Docker/host administrator races remain trust-boundary risks.

## Execution semantics

Unit files import pinned Psycopg only when explicitly run later; no database
connections are needed. They patch reads/connection capability, not crypto.
Integration run_case requires protocol-bound RunnerAdmission; it patches only
the test's in-memory module bindings, never working provisioning source/SQL.
The current parent's identity, logging preflight, SQL order and SCRAM helper
remain in the executed path. Snapshot file I/O is unit-covered; integration
uses a fixed immutable synthetic snapshot, not actual external secret files.
The old Admission.connection(callback) signature is retained but permanently
BLOCKED: it never invokes a supplied callback. No unapproved host SQL transport
route remains alongside the protocol. This intentionally tightens the V1 stub.

Each scenario requires fresh resources. Observer uses a separate admitted
connection. Commit ambiguity never retries. A separate explicit repeat test is
not automatic retry. Failure after commit requires catalogue/ACL reconciliation.
Returned scanner stays in memory; its contents must never be serialized.

COMMIT_UNKNOWN outcomes stop the overall run even after synthetic catalogue
reconciliation: no implicit authorization to repeat or proceed follows.

run_case alone returns diagnostics_status=INCONCLUSIVE. Worker wires Scanner
to collector for pg stdout/stderr, runner stdout/stderr, available server logs
and client diagnostics. Actual returned verifier is registered, not regenerated.
If none was generated, verifier_scope=not_created: this is not a tested claim
about absence of an actual verifier in every possible channel.

Collector uses exact-ID Docker logs in a start/end UTC interval with bounded
tail, preserving candidate stdout/stderr separately. Driver/TTY/read failures,
rotation, tail loss, clock skew and the final live interval remain UNPROVEN.
After SQL identity, runner reads logging_collector/log_destination. Confirmed
stderr-only routing aliases the same UNPROVEN stderr payload as pg_server_logs;
other/unknown routing leaves that channel missing rather than assuming no file
logs. No docker exec/file-log reads are implemented. Client diagnostics are privately
captured, bounded and scanned. V1.3 does not render exception chains; omitted
error details make capture incomplete.

IMPORTANT: current Docker collector intentionally cannot produce completeness
PASS. Worker forces Docker captures back to UNPROVEN even if a packet asserts
otherwise. Missing/partial collection => INCONCLUSIVE; scanner error =>
INCONCLUSIVE (known positive leak still FAIL). Detected leak => FAIL. Unknown
target/transport => BLOCKED; unexecuted mandatory fact => NOT EXECUTED.
Overall PASS requires every mandatory fact PASS, full channels and expected
process exit; currently no operational PASS is claimed. No raw log is saved
or printed. Retention/completeness proof needs a separately reviewed extension.

## Separate future permissions / lifecycle

1. Static acceptance; separately approve any missing driver/fixture files.
2. Separate approval to create ONLY new manifest-named synthetic resources.
3. Read-only isolation inventory and independent cluster ID approval.
4. Separate approval for specified test cases and their fault-injection scope.
5. Separate approval for synthetic diagnostic collection/review.
6. Separate cleanup approval, listing exact IDs/names from that same manifest.

Cleanup is NOT implemented or automatic. Before any future deletion, recheck
context, labels, IDs, volume timestamp, mount ownership and cluster inventory;
UNKNOWN blocks deletion. No prune, broad filters, down-with-volumes or deletion
of unknown resources. Never combine create/test/delete into one permission.

No ready-to-run commands or global lifecycle launcher are supplied. Before any
future build, separately approve the parent build context and exact allowlist
Dockerfile.dockerignore. Wheels/lock are reused read-only and installed with
no-index/require-hashes/only-binary and network=none. Independently approve the
resulting runner image ID; no image digest is guessed here. Future runner
creation must match check_runner including OpenStdin=true and the fixed worker
entrypoint. Read TEST_MATRIX.md and VALIDATION.md before separate approval.

## V1.2 bounded collection and remaining blockers

Docker log collection now uses two concurrent binary pipe readers, not a
capture_output/check_output/communicate whole-output capture. Each channel is
limited to 2 MiB; a shared 2 MiB saved-byte budget covers both Docker log
processes in one collection. Reads use 16 KiB chunks and no unbounded queue.
Temporary freezing copies and reader chunks add bounded overhead; these limits
are not a claim about exact Python allocator RSS or Docker daemon memory.
The watchdog limits elapsed time, terminates then kills the CLI child if needed,
and bounds waits and joins. Unconfirmed cleanup retains a process-wide lease,
preventing further diagnostic children from accumulating in that process.
Only the CLI child is terminated, never the target container.

Capture completeness has four independent layers: subprocess capture, Docker
history, PostgreSQL diagnostics and client diagnostics. The flags are truncated,
stream_error, collection_gap, completeness_unproven, timeout, nonzero_exit,
channel_missing and source_mismatch. Successful CLI exit proves no Docker
history retention, rotation or gap property. That history remains UNPROVEN.

Scanning is in memory, bounded by bytes/chunks/marker size, and retains overlap
for markers crossing chunks. A detected leak remains FAIL even if scanning later
fails. Unexamined bytes or scanner errors cannot yield PASS. Actual registered
verifiers are scanned; if none was created the scope remains not_created.
Neither raw diagnostics nor matched lines are returned in reports.

Historical V1.2 dependencies (addressed by the V1.3 source changes below):

- worker.py MemoryText encodes an entire incoming string before limiting it and
  can accumulate empty list entries after its byte limit. A whole-pipeline
  memory bound requires a separately authorized worker change.
- The existing controller/worker report protocol does not carry all four
  completeness layers and flags. Existing facts-only oracle calls now remain
  INCONCLUSIVE rather than gaining PASS. A future proof-carrying protocol needs
  separate review and permission; no packet flag proves Docker history.

No execution, compilation, tests, Docker or SQL validation was performed for
V1.2. Provisioning remains BLOCKED. Unknown COMMIT remains STOP without retry.

## V1.3 worker budget and structured evidence

One MemoryText sink receives redirected worker stdout, stderr and client
diagnostics. They are NOT concatenated into Docker streams. Its shared saved
payload limit is 2 MiB, with at most 2048 nonempty fragments of at most 4096
bytes. Text is sliced into at most 1024 characters before UTF-8 replacement
encoding (at most 4096 encoded bytes). Binary bytes are preserved, including
non-UTF-8. Empty writes allocate no fragments. Byte or fragment overflow sets
truncated and discards subsequent input; invalid types also set stream_error.
The final join is at most 2 MiB and temporarily coexists with the bounded parts.
No claim is made about caller-owned input allocation, exact interpreter RSS,
libpq diagnostics allocated outside this sink or arbitrary scenario code.
Exception objects are never stringified: omitted exception details make the
capture truncated, so they cannot become a no-leak proof.

Collector limits remain 2 MiB per channel and a shared 2 MiB saved-byte budget
for the two Docker CLI reads, with 16 KiB binary read chunks. The worker's
private decoded capture packet is separately bounded to 4 MiB including the
server-stderr alias, plus the 2 MiB worker sink/join and bounded scanner buffers.
Private protocol input has an 8 MiB frame limit. These are individual bounded
payload allocations, not a claim of an exact total-process memory ceiling.

Every REPORT diagnostic row has exactly these required fields:

- channel_id; source_identity (container_id, kind);
- collection_start, collection_end; captured_bytes, byte_limit;
- truncated, stream_error, collection_gap, completeness_unproven, timeout,
  nonzero_exit, channel_missing, source_mismatch;
- scanner_status; leak_detected; completeness_status;
- capture_layers (client, subprocess, docker_history, postgresql);
- collection_complete and status (derived summaries, validated for consistency).

The schema refuses unknown/missing fields, duplicate/unknown channels, wrong
types (including bool as byte count), invalid identities/timestamps, oversized
counts, unknown enums and inconsistent summaries. Metadata contains no raw
diagnostics, credential, verifier, matching line or sensitive SQL. Interval
metadata describes the requested collection window, not independent proof of
full coverage of that window. Source IDs are claims checked against the
manifest in scan_bundle; protocol schema validation alone authenticates no
Docker identity. Missing evidence is never defaulted into a safe PASS.

Each layer is COMPLETE, UNPROVEN or NOT_APPLICABLE. COMPLETE means the applicable
bounded capture is confirmed within its stated scope, not universal absence of
leaks. Worker may describe only its own client capture as COMPLETE. All external
subprocess, Docker-history and PostgreSQL layers are UNPROVEN in REPORT; a
worker attempt to label them COMPLETE is rejected. Host collector separately
tracks subprocess EOF/exit/cleanup, which proves no retention or server logging
coverage. Extending this protocol with independently trusted external proof
requires a separate design, not setting a worker boolean.

Scanner status is COMPLETE, INCOMPLETE, ERROR or NOT_EXECUTED. COMPLETE means
its bounded supplied input was examined; it does
not prove source completeness. Errors, unread remainder, absent channel, gaps,
timeouts, mismatches or UNPROVEN completeness yield INCONCLUSIVE. A detected
synthetic leak dominates and yields FAIL. Required unexecuted facts yield NOT
EXECUTED; unknown COMMIT remains a BLOCKED STOP without retry. Admission or
protocol refusal yields BLOCKED. No overall PASS is possible under the current
external-history boundary. Controller's legacy facts-only final aggregation
also remains fail-closed; controller.py and identity/admission gates are unchanged.

V1.3 has static source review only. All new/updated unit and mock tests are NOT
EXECUTED. No lifecycle or cleanup action was added. Provisioning remains BLOCKED;
this harness is not production-ready and proves no absolute absence of leaks.
