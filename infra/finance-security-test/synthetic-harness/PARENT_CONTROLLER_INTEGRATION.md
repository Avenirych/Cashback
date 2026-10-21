# Windows controller / 12 parent unit-mock integration

Source implementation only. No Python/controller, build, restore, tests, capture,
database operations or provisioning were executed for this change. The owner's
reported controller BUILD PASS is accepted as prior evidence, not repeated here.
It is not validation of the newly added Python sources.

## Inventory

Existing `protocol.py`, `controller.py` and worker/runner machinery concern the
Docker HELLO/READY/GO/evidence protocol. They are not CBPT1/CBPR1 parent-test
components and are not replaced or relaxed. `targets.py` loads parent files from
disk and uses ordinary imports; its function must never be used by this run.
Existing `test_unit.py` contains exactly the reviewed 5 StrictSecrets, 3 Scram and
4 LoggingPreflight tests. Their source and the parent common.py/provision.py have
not been changed. LeakScanner is NOT part of this 12-test execution.

New `parent_test_adapter.py` implements in-memory verified parent loading and
synthetic facades. New `parent_test_launcher.py` implements bounded CBPT1 receive,
safe CBPR1 production and an exact ordered 12-case runner, but is deliberately
NOT a finalized approved executable launcher.

## Blocking bootstrap boundary (original absent; new reconstruction added)

`security_bootstrap.py` now implements a separately marked NEW RECONSTRUCTION.
See `SECURITY_BOOTSTRAP.md` for its interfaces, predicates and UNVERIFIED status of
all G001-G011 comparisons. It is not the original and is not approved for execution.
The launcher has a bounded explicit hash-pinned entry route, with no hash supplied;
its C/D/owner gates and the reconstruction review gate remain closed.

No exact persisted G001-G011 audit-hook launcher or approved runtime-baselined
source-only importer was found in the inspected source set. The new reconstruction
does not claim to recover that original. `_REVIEWED_BOOTSTRAP = None` plus the
missing bootstrap hash, owner approval and C/D stop the launcher with exit 125
before stdin receive or project-source loading. Candidate hashes never grant
approval. Nothing is obtained from environment, argv or the CBPT1 payload to enable
these gates. The reconstruction's own review gate independently remains false.

A separately reviewed trusted bootstrap must supply these operations:

- `install_original_guard()`: install the exact original G001-G011 rules, with
  uncatchable bounded fail-stop and no permissions/root/extension relaxation.
- `verify_runtime_and_source_only_imports()`: restore the previously reviewed
  Python 3.14.7 / C:\Python314 baseline, sys.modules classification, fixed stdlib
  paths and source-only importer with no local bytecode/fallback. This is executable
  verification code in a future approved run, not a boolean worker attestation.
- `load_parent_adapter()`: load the separately reviewed adapter source with a
  fixed approved source/hash contract. Do not quietly expand the old 17-module
  mapping or fall back to the ordinary import loader.
- `load_test_unit()`: load `test_unit` and its reviewed import closure through the
  original source-only contract; no discovery, parent imports or real Psycopg.

The reconstruction implements these interface names but does not prove original
equivalence. Existing descriptions above remain requirements for the original;
they do not upgrade the reconstructed code to approved. Missing approvals/hashes
and unverified reconstruction semantics are BLOCKED, not reasons to weaken admission.

## Receiver, adapter and test lifecycle

The existing C# library sends 12312-byte CBPT1 with LF. Python accepts one LF or
CRLF-framed message of at most 16384 bytes, exact 10080/2224 Base64 fields, EOF,
strict decoding and canonical roundtrip. Both decoded sizes/hashes are checked
before either source is parsed/compiled. The adapter repeats verification and
checks exact import routes and the first main() operation before execution.

Approval binds the two baseline tuples to OWNER_APPROVED and
TWELVE_PARENT_UNIT_MOCK_TESTS_ONLY; it comes only from future trusted launcher
configuration after owner approval, never the snapshots/test payload. Snapshot
values are immutable bytes in a private copied MappingProxyType. No parent-file
runtime read or snapshot write exists.

Each case's entire TestCase.run (setUp, body, tearDown, cleanups) is enclosed in
one unique-token scope. Nested/stale/no-scope use fails closed. Parent helpers
check the captured context. Tokens are not yielded or attributes of test doubles.
`test_unit.load_targets` is patched for the whole run and restored on every normal
exception path. No fake common/provision/Psycopg registration in sys.modules occurs.

Each load creates synthetic os.environ and Path plus narrow import/builtin
facades. Default reads, writes, connect, encrypt and SQL-building APIs fail-stop;
the existing tests must explicitly mock them. No real os.environ is copied.
The four logging tests call their existing fake connections, never a database.

The only permitted main() invocation is StrictSecrets.test_failure_precedes_connect.
It requires the exact scope, permits one entry, checks a RuntimeError mock object,
and replaces the connector with an unconditional fail-stop. The expected snapshot
exception object must propagate unchanged. A returned snapshot or any other
exception fails closed. Mock.call_count is supporting evidence, not the boundary.
SQL files, commit, rollback or full provisioning cannot be reached on this path.

The runner emits only fixed ASCII CBPR1 messages, indexes, statuses and counters.
No exception/traceback formatting or storage is performed by its result object,
including failures in subtests. All 12 cases run sequentially; there is no discovery,
retry, new test, cleanup of Docker resources, or invocation of existing integration
scenarios. Exactly 27 LF-terminated records constitute a completed run. Completion
is emitted only after the scoped target-loader patch has been restored.

Exit 0 requires no failures/errors (skips remain INCONCLUSIVE in C#); exit 1 reports
test failures/errors; fail-stop is 125, internal watchdog 124. The watchdog covers
receive/EOF waiting and tests. Output write failure fails closed. The C# controller
still independently requires its full protocol/exit/readers/finalization evidence.

## Launcher artifact and SHA-256 contract

Source path:
`infra/finance-security-test/synthetic-harness/parent_test_launcher.py`.
It is NOT final while the exact bootstrap is missing. No launcher hash is invented
or marked owner approved. The adapter/bootstrap/test-source dependency bytes also
require a fixed trusted delivery/integrity contract; a launcher hash alone cannot
authenticate separately loaded dependencies.

After separately authorized finalization, SHA-256 can be obtained with the proposed
read-only command (NOT executed in this step):

```powershell
Get-FileHash -LiteralPath 'C:\Users\serge\cashback+\infra\finance-security-test\synthetic-harness\parent_test_launcher.py' -Algorithm SHA256
```

C# currently hashes UTF-8 launcher text without BOM. The source must be decoded
strictly and re-encoded byte-exactly, with no newline/BOM normalization, before
using a file hash as that text hash. A mismatch blocks; do not hash one version and
execute a generated/concatenated different version. Finalization of a bootstrap
changes the artifact and requires a new hash/review. No capture/controller host is
added here.

## Remaining BLOCKED conditions

- Original guard remains absent; new reconstruction requires its own review and
  explicit acceptance before it can be considered for execution.
- Approved bootstrap/adapter/test-source integrity and delivery contract.
- Parent baseline A, capture/delivery C and exact execution D, all currently absent.
- Final launcher artifact/hash and owner approval, currently absent.
- NativeIoContractVerified remains false; native I/O/runtime blockers unchanged.
- New Python sources have received source-text review only. No AST parser,
  compilation, tests or execution was authorized or performed.

In-process facades and token guards are not an OS boundary against arbitrary
hostile Python code. MODEL A remains unchanged. Docker logging history remains
UNPROVEN. Previous 57/57 PASS stays preserved; parent tests NOT EXECUTED.
Provisioning remains BLOCKED.
