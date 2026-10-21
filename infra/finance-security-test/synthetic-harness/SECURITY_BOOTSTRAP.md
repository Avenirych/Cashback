# Security bootstrap — NEW RECONSTRUCTION

This is newly implemented source, **not the recovered original**. No equivalence
to the missing launcher/guard is asserted. No Python, controller, build, restore,
tests, snapshot capture or provisioning was executed for this implementation.
There are no new tests and no parent/source-test changes.

## Execution remains BLOCKED

- `security_bootstrap._RECONSTRUCTION_REVIEW_APPROVED = False`.
- `_APPROVED_SOURCE_HASHES` is empty, not populated with invented hashes.
- Launcher `_BOOTSTRAP_SOURCE_SHA256` and owner approval are None; C/D are false.
- Launcher `_REVIEWED_BOOTSTRAP` remains None. Its new explicit hash-pinned source
  entry route cannot load anything without separate trusted configuration.
- C# `NativeIoContractVerified=false` is not modified.

These are independent gates. B authorizes source changes, not review approval of
the reconstructed policy, owner approval A, capture C or execution D. No data in
CBPT1, environment or test payloads can automatically approve a gate.

## Implemented interfaces

`SecurityBootstrap.install_original_guard()` keeps the interface name for launcher
compatibility only. It refuses while reconstruction approval is false. After a
future approved change it would install a new Python audit hook, test its own
delivery using a private probe, and refuse subsequent hook-registration events.
The probe does not enumerate all pre-existing native/Python audit hooks. Their
absence cannot be established by a supported hook-enumeration API here.

`verify_runtime_and_source_only_imports()` requires Windows / Python 3.14.7,
the fixed C:\Python314 executable/prefix, -B/-s/-S, canonical Lib/DLLs roots,
and no root overlap with the project/harness. It checks loaded module origins,
bounded package paths (including the known cached CPython NamespacePath form),
and initial standard meta_path. Unknown origins fail. Only the actual in-memory
`__main__` of -c is a known special case. Runtime authenticity is not proved.

The fixed controller working directory C:\Python314 is explicitly checked; it is
removed from sys.path along with cwd/project/ZIP/inherited entries. Final sys.path
is only Lib and DLLs. Hooks and caches are rebuilt with an ExtensionFileLoader /
SourceFileLoader FileFinder; no sourceless-loader registration. Local source uses
a separate fixed 17-module mapping, unchanged from the prior design, with no reload,
package or ordinary local-import fallback. Module bytes are bounded to 256 KiB,
hashed and compiled from that same in-memory buffer. Local bytecode opens are
blocked, whether the cache file exists or not. Runtime cache reads remain allowed
inside trusted runtime roots. No bytecode is written.

`load_parent_adapter()` explicitly loads the additional reviewed adapter source
without adding it to the old 17-module mapping or sys.path. `load_test_unit()` uses
the fixed source finder. All 18 local dependency hashes must be separately approved
first. Hash-pin bootstrap itself in the launcher before compile; do not embed the
bootstrap's own hash in its own source. The new entry route is bounded, byte-exact
and has no sys.path or bytecode fallback. It intentionally is not a finalized hash.

`targets.py` is source-loaded but its unsafe disk-reading load_targets function is
replaced in the in-memory module with unconditional fail-stop before test_unit can
import that function. The existing launcher scopes its adapter patch for the full
run and restores the blocked function, not the unsafe original. No disk source is
modified. Real Psycopg/ctypes/Docker imports and parent-source file opens fail-stop.

`test_scope(test_id)` encloses the complete TestCase.run alongside the existing
adapter's independent scope. It requires an approved ID, owner thread, no nested
scope, intact opaque token, and unchanged import state at entry/exit. Neither token
is yielded or passed to test doubles. Phase `test_scope` covers setup/body/teardown/
cleanup collectively; it is NOT a claim to distinguish those phases precisely.

Parent snapshot compile/exec remains in memory. Audit checks recognize only exact
candidate snapshot bytes/hashes and fixed labels, with test context required for
execution. This check never grants owner approval; the launcher/adapter separately
require A. Other local exec requires an active bounded source-loading scope.

## G001-G011 reconstruction status

All rules are **UNVERIFIED relative to the original**. Existing prose requirements
support the following new predicates, but not an exact comparison of event names,
flags, exceptions, diagnostics or every Python-version-specific audit route.

| Rule | New reconstructed predicate | Original equivalence |
|---|---|---|
| G001 | subprocess.* and listed OS spawn/exec/process creation events denied | UNVERIFIED |
| G002 | socket.* events denied | UNVERIFIED |
| G003 | sqlite3.* events denied | UNVERIFIED |
| G004 | listed filesystem mutations and host environment/cwd mutation denied | UNVERIFIED |
| G005 | real Psycopg, Docker, ctypes and raw ctypes imports denied | UNVERIFIED |
| G006 | file open modes containing w/a/x/+ denied | UNVERIFIED |
| G007 | local extensions other than .py/.md, including .pyc, denied | UNVERIFIED |
| G008 | file open flags permitting write/create/truncate/append denied | UNVERIFIED |
| G009 | unknown/non-string file targets, including descriptor opens, denied | UNVERIFIED |
| G010 | file reads outside canonical local/runtime roots denied | UNVERIFIED |
| G011 | unknown context, invalid bootstrap/import/compile/exec state denied | UNVERIFIED |

Safe diagnostics use only fixed event/category/api/phase/rule values and one bounded
stderr line, followed by os._exit(125), even if output fails. No paths, args,
exceptions, environment values, snapshots, credentials or tracebacks are formatted.
Additional compile/exec/import-state checks are explicitly new reconstruction
checks, not proof they existed in the original. Unknown audit events are not
represented as comprehensively mediated external operations.

## Residual limits

Python's audit system is not an OS sandbox and does not cover every external/native
operation. Finder/token checks do not resist arbitrary hostile code in-process.
Canonical-path checks do not eliminate TOCTOU; MODEL A trust assumptions still
apply. Imported trusted startup modules may already have executed before baseline
inspection; inspection does not undo side effects. The approved launcher hash must
anchor bootstrap and all dependency bytes, not just names or flags.

Potential compatibility failures (dynamic stdlib code, code filenames recorded in
runtime .pyc, package-origin special cases, audit event argument types) remain
unverified. No unknown condition is automatically accepted to make tests pass.
Reconstruction review approval must not be flipped merely to bypass such failures.
Static text review only; syntax/import/runtime checks are NOT EXECUTED.

CBPT1/CBPR1 and all 12 test IDs are unchanged. Previous 57/57 PASS is preserved and
is not evidence for this new bootstrap. Parent tests NOT EXECUTED; parent hashes
CANDIDATE; A/C/D NOT GRANTED; provisioning BLOCKED.
