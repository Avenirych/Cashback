# V1.3 static matrix — NOT EXECUTED

No row is a claim that a test passed. UNIT/MOCK means Python response/fixture
behaviour only. INTEGRATION requires a new approved cluster and approved
transport. Existing 9f and application clusters are forbidden.

## Preflight

| Condition | UNIT/MOCK executable source | INTEGRATION / oracle |
|---|---|---|
| All 20 GUC | LoggingPreflight.test_valid | preflight_only(expected_pass=True) on protected fresh cluster |
| Wrong value | test_guc_rows | separate startup fixture, expected_pass=False |
| Missing GUC | test_guc_rows | MOCK ONLY: built-in PG17 GUC cannot be removed |
| Wrong source | test_guc_rows | omit one startup setting that equals default, expect refusal |
| pending_restart | test_guc_rows | real reproducible fixture NOT PREPARED; no integration claim |
| Role/database override | test_all_other_gates | separately approved synthetic ALTER DATABASE fixture; expect refusal |
| Extra installed extension | test_all_other_gates | separately approved hstore fixture if available; otherwise BLOCKED |
| Available audit extension | test_all_other_gates | requires distinct reviewed image/manifest policy; not possible under current exact image gate |
| Audit GUC | test_all_other_gates | actual audit addon NOT PREPARED; arbitrary custom variable is not proof |
| Nonempty proconfig | test_all_other_gates | separately approved synthetic function fixture; expect refusal |
| Wrong session/current user | test_all_other_gates | independent admission must block before writes |
| Wrong cluster | test_wrong_cluster + AdmissionTests.test_sql_identity | independent gate rejects known/incorrect cluster IDs |
| Required SELECT error | test_all_other_gates | transport/permission fault after admission; must stop |

No integration fixture is installed automatically. Changing GUC for a negative
fixture is NOT remediation by the preflight and requires separate approval.

## Secrets and SCRAM

StrictSecrets covers valid unique inputs, byte-exact invalid lengths, non-ASCII,
BOM, non-hex, spaces/LF/CRLF, duplicates, one read per file, immutable snapshot,
changed backing mocked file after snapshot, bootstrap using original bytes, and
failure before connect. Filesystem mutation is MOCKED, not a real filesystem test.

Scram covers 4095 refusal; 4096 / 2147483647 format acceptance using doubles;
0 / 2147483648 refusal; wrong prefix/MD5/type/Base64/empty salt/key sizes;
libpq exception/closed connection/missing capability; explicit algorithm/bytes.
Maximum iterations are NEVER computed. run_case uses real libpq only at normal
iterations and registers ACTUAL returned verifiers with Scanner.

## Transactions (run_case)

Each case uses a NEW fresh cluster. Every connection is independently admitted.
Before/after catalogues exclude password contents and unstable OIDs of newly
created objects; verifier equality is checked privately via pg_authid.

| Case | Fault | Expected reconciliation |
|---|---|---|
| success | none | FULLY_APPLIED, closed admission, ACL/ownership/password oracles |
| permission_denied | reduce session authorization just before ALTER | NOT_APPLIED |
| missing_role | nonexistent fixture ALTER target | NOT_APPLIED |
| statement_timeout | bounded synthetic pg_sleep with 50ms local timeout | NOT_APPLIED |
| second_sql_error | SELECT 1/0 replacing second fixture | NOT_APPLIED |
| alter_error | nonexistent fixture ALTER with actual synthetic verifier | NOT_APPLIED |
| explicit_rollback | rollback at commit boundary | NOT_APPLIED |
| commit_unknown_before | deterministic lost-outcome model before actual commit | NOT_APPLIED; no retry |
| commit_unknown_after | real commit then adapter throws fixed exception | FULLY_APPLIED; no retry |
| repeat | explicit SECOND invocation after success | refusal, no files/ALTER/commit on second attempt; unchanged catalogue |
| after_sql_1 / 2 | Python fault after exact file execution | NOT_APPLIED |
| after_alter_1 / 2 / 3 / 4 | Python fault after actual ALTER | NOT_APPLIED |

Missing-role and ALTER-error currently share the same SQL failure mechanism;
they are not independent error-class coverage. COMMIT adapters model ambiguity;
they are NOT real network-loss experiments. Partially applied or unclassifiable
state forces a non-PASS STOP: unexpected partial state is FAIL; unavailable
admission/identity is BLOCKED. Reconcile, never retry provisioning automatically.
Every fault also checks exact file/ALTER/commit phase counters and expected
SQLSTATE where applicable: failure at an earlier gate cannot pass that case.
Timeout is a bounded SQL fixture in the password phase, NOT a lock-induced
timeout of an actual ALTER ROLE statement; that concurrency fixture is pending.

Integration paths do not claim coverage of parent __main__ exception rendering.
V1.1 adds private client error capture, worker status and host exit checking;
runtime behaviour remains NOT EXECUTED.

## Logging / diagnostics

| Scenario | Implemented / future boundary |
|---|---|
| Success / SQL error / timeout | actual verifier remains in worker Scanner; host collector data returns by private stdin; NOT EXECUTED |
| Duration / sampling / audit | unit preflight refusals; approved startup/addon fixtures needed for integration |
| Synthetic Docker stdout/stderr | exact-ID collector candidate streams, completeness UNPROVEN |
| Runner stdout/stderr | separate collector channels plus bounded in-worker captured output |
| Available PostgreSQL file logs | not silently assumed absent; missing channel INCONCLUSIVE |
| Client exception | preflight/SCRAM safe-error unit tests; scanner positive control |
| Scanner self-test | complete/incomplete/missing channel tests, full/encoded/fragment matches |
| Positive leak control | planted synthetic markers in memory; real unsafe-server fixture NOT PREPARED |

A runtime collector must identify exact containers and a bounded time interval,
track truncation, rotation, transport failures and stream coverage. Unknown or
incomplete capture is INCONCLUSIVE, even if no marker was found. Never dump
matches/raw logs. Inspecting logs requires its own future explicit approval.

## Failure handling common to every negative case

1. Gate Docker isolation and independently approved new cluster identity first.
2. Set up fault ONLY on the fresh synthetic fixture, never on 9f.
3. Require expected refusal / nonzero failure, preserving safe classification.
4. Inspect rollback from a separate newly admitted connection (R0/R1).
5. Scan all agreed synthetic channels; absent collection = INCONCLUSIVE.
6. End case; no auto reset/reprovision/cleanup. Next case uses a fresh cluster.
7. Cleanup requires a separate exact-manifest approval.

Potentially hazardous actions: reduced authorization, timeout, deliberate SQL
errors, committed synthetic provisioning and unsafe positive-control logging.
Each needs explicit test-scope approval. No PANIC/crash injection is included.

## V1.1 UNIT/MOCK wiring tests (test_wiring_unit.py; NOT EXECUTED)

Historical V1.1 expectations below are superseded by V1.3 wherever they refer
to a complete MOCK bundle permitting global PASS.

| Case | Expected |
|---|---|
| Valid exact pg+runner resources | gate accepts fixture only |
| Wrong target/image/network/host port/socket mount/user/privileged/missing metadata | BLOCKED before tests |
| Missing or either prohibited cluster ID | manifest refused |
| In-runner SQL identity wrong | BLOCKED, connection closed |
| Wrong nonce/manifest digest/case or repeated GO | BLOCKED |
| Missing host GO / legacy callback | no connection; callback never invoked |
| Host admission error | runner is never started |
| Transport exception | one start attempt, no retry, BLOCKED |
| COMMIT exception | single commit call, no retry |
| Complete MOCK bounded channel bundle | scanner fixture PASS, not Docker integration proof |
| Missing/gap/truncated/unknown-source/unproven diagnostics | never PASS |
| Scanner exception | INCONCLUSIVE |
| Planted marker | FAIL |
| Docker CLI collector fixture | exact IDs only; every stream UNPROVEN |
| NOT EXECUTED mandatory fact | overall NOT EXECUTED, never PASS |
| Unexpected scenario oracle versus unavailable gate | FAIL versus BLOCKED |
| Full mocked HELLO/READY/GO/DONE/DIAGNOSTICS/REPORT wiring | INCONCLUSIVE retained; not integration proof |
| Raw/unknown report field or empty channels claiming PASS | BLOCKED |

Current integration diagnostics remain INCONCLUSIVE because ordinary Docker CLI
logs cannot prove retention or exact complete stream coverage. This deliberate
limit must not be removed by setting a boolean in the packet. No runtime test,
resource creation/start or collector operation was performed at V1.1.

## V1.2 additions — prepared, NOT EXECUTED

| Static/mock scenario | Required outcome |
| --- | --- |
| Concurrent stdout/stderr, binary/non-UTF-8 | Byte-preserving bounded capture |
| Per-channel or aggregate byte limit | truncated; no PASS; child cleanup |
| Timeout, terminate failure, kill fallback | Bounded waits; no PASS |
| Reader, pipe-close or child-reap failure | stream_error; no PASS; block further children if cleanup unknown |
| Nonzero CLI exit or spawn failure | Incomplete; no automatic retry |
| Marker split across chunks | Leak detected without emitting matched bytes |
| Iterator error after leak | FAIL remains sticky |
| Unexamined remainder or endless empty chunks | Bounded scan; incomplete |
| Each incomplete flag; absent channel | INCONCLUSIVE |
| CLI success with unknown Docker history | INCONCLUSIVE |
| All facts PASS without channel proof | INCONCLUSIVE |
| Complete synthetic mock proof | PASS only in mock oracle scope |
| Required unexecuted check | NOT EXECUTED |
| Unknown COMMIT | STOP; no retry |

New test_bounded_stream_unit.py contains only mock process/pipe and scanner
tests. Updated oracle and wiring tests preserve the old report interface while
rejecting incomplete proof. They have not been imported or executed.

Whole-pipeline acceptance remains BLOCKED pending separately authorized
worker.py bounded client capture and proof-carrying protocol changes. The
current Docker history is still UNPROVEN; no synthetic mock constitutes an
independent retention/rotation/stream completeness proof. Admission and SQL
identity gates are unchanged.

## V1.3 — supersedes the two V1.2 source dependencies above

test_worker_evidence_unit.py prepares these UNIT/MOCK cases, NOT EXECUTED:

| Cases | Expected |
| --- | --- |
| Below/exactly/above byte limit | bounded payload; only overflow truncated |
| Fragment count overflow | at most 2048 saved fragments; truncated |
| 10000 empty text/binary writes | no fragment accumulation |
| Oversized Unicode write | encode bounded slices; truncation |
| Binary/non-UTF-8 | preserve bytes without decode |
| Invalid input; exception with unsafe __str__ | no rendering; incomplete |
| Each missing evidence field | schema refuses |
| Wrong types, unknown channel/completeness | schema refuses |
| Claimed external COMPLETE from worker | schema refuses |
| Missing channel; UNPROVEN history | never PASS |
| NOT EXECUTED required fact | NOT EXECUTED, never PASS |
| Source mismatch; scanner exception | INCONCLUSIVE with safe metadata |
| Detected synthetic marker | FAIL dominates incomplete evidence |
| Evidence serialization failure | fixed safe error; no output bytes |
| COMMIT ambiguity | one scenario invocation; BLOCKED STOP, no retry |

Existing collector chunk/limit/timeout tests and admission/SQL-identity tests
remain applicable. The wiring fixture now uses structured evidence, and an
artificial external COMPLETE bundle no longer expects PASS. No test establishes
Docker retention, rotation, complete server diagnostics or external tracing
coverage. Future tests/imports/builds/live collection each require separate
authorization. No automatic cleanup is implemented.
