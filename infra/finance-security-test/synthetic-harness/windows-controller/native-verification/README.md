# Native verification — source only, NOT EXECUTED

No build, restore or execution is authorized by this implementation. The production
NativeIoContractVerified gate remains false. No call to ExecuteOnceAsync exists.
This utility does not approve parent hashes or grant permissions A/C/D.

## Source isolation

The executable project targets net10.0-windows / x64 and links the unchanged
../Native.cs and ../PipePair.cs. It does not compile Controller.cs or Protocol.cs.
Verification.cs.source is an explicit Compile item; its extension deliberately
avoids the production project's recursive *.cs glob. Implicit source items,
generated assembly attributes and SDK-generated implicit/global usings are disabled
here. Verification.cs.source explicitly supplies global System and System.IO
usings required by the unchanged linked sources, without generating a *.cs file.
No production source, project, integrity manifest or test allowlist was changed.
Build compatibility is NOT VERIFIED; no compiler has been run.

Static build-readiness review: a valid async Task<int> Main entry point is present;
the project explicitly compiles Verification.cs.source and both linked sources,
targets net10.0-windows / x64, and declares no PackageReference/ProjectReference.
The cleanup method is named FinalizeRun to avoid conflict with the special
Finalize method name under TreatWarningsAsErrors. No known source compile blocker
remains from this review; actual compiler diagnostics and local targeting/apphost
pack availability remain unverified until a separately authorized offline build.

## Future separately authorized operation

First obtain separate approval for an offline build and review of the resulting
executable, including the linked-source versions and available .NET 10 x64 runtime.
Use the existing approved local NuGet configuration explicitly; do not restore
from network, install packages or change a user configuration. Keep build artifacts
inside this verification project's bin/obj. This document does not authorize build.

Execution requires separate explicit owner approval of the exact scenario and
binary. Run only as the confirmed owner SID from MODEL A. The entry point rejects
other identities, non-Windows/x64 layouts and non-.NET-10 runtimes. Use the built
Cashback.NativeVerification.exe apphost, not dotnet DLL invocation. One invocation
selects exactly one fixed scenario; no discovery, scenario loop, retries or parent
tests exist. Child uses the same apphost and a fixed internal mode, never Python.
The trusted executable directory and runtime are assumptions, not hash-attested
by this utility. Do not invoke the internal --synthetic-child mode directly.

After approval, the command shape is:

    <approved-path>\Cashback.NativeVerification.exe <one-approved-scenario>

An external, separately approved supervisor is required for a hard outer time
limit: no in-process code can guarantee recovery from a hung native call. It must
not search for or terminate unrelated processes. No supervisor is implemented here.

## Fixed scenarios

| Scenario | Child count | Evidence / expected observation |
|---|---:|---|
| abi | 0 | Existing Native.ValidateLayouts assertions succeed. |
| dacl | 0 | Three original PipePair.Open calls validate DACL, candidate access masks, endpoint properties and initial inheritance; cleanup succeeds. |
| io | 1 | Exact 16384-byte fixed pattern, bounded/chunked writes and reads, stdin EOF observed by child, exact echoed stream and both reader EOFs, child exit 0. |
| cancel | 1 | Child never reads/writes; parent observes unfinished read and 64-KiB write before requesting token/native cancellation. Both read/write cancellation and task completion required before cleanup. |
| stdout-limit | 1 | Child attempts 65537 fixed stdout bytes; parent flags overflow at 65536, cancels pending I/O, terminates only owned child if needed, confirms exit and cleanup. |
| stderr-limit | 1 | Same overflow experiment for stderr, in a separately authorized invocation. |
| deadline | 1 | Synthetic child remains idle; parent observes 40-second operational expiration, then cancellation/owned termination and completion within the shared 45-second budget. |

Partial/chunked stream handling is exercised; actual native short-write completion
is NOT attested. No direct ReadFile/WriteFile instrumentation is added. Cancellation
is verified only when pending state and OperationCanceledException are actually
observed; other exception mappings safely produce BLOCKED. Connect cancellation
cannot be deliberately forced through the current PipePair interface; its
cancel/retention branch is not claimed covered. No production change is made to
expose it. Endpoint-query access sufficiency is observed only on successful Open;
no rights fallback exists. Masks are not proved minimal and cross-identity access
denial is not tested.

## Ownership, memory and results

At most one CreateProcessW call, suspended creation, exactly three inherited pipe
endpoints, one ResumeThread, no shell, explicit environment, original process handle
for zero-time exit polls and termination. No PID lookup or process-tree kill.
Creation failures never trigger a retry. Thread and process handles are closed
independently. Parent copies of child endpoints are closed after creation.

Readers start before resume. Two 4096-byte read buffers are used; raw output is
checked/discarded in memory rather than saved or printed. Each channel counts at
most 65536 accepted bytes (sum at most 131072); overflow is latched. Input is fixed
16384 bytes, or 65536 for the cancellation experiment. Synthetic child uses at most
16384 data bytes (257-byte output blocks for overflow). No unbounded collection,
diagnostic file, real secret, environment copy, SQL or provisioning exists.

FileStream owns managed overlapped data-I/O state; task completion is required
before passing ioSettled=true to the original PipePair.CloseResources. A cancellation
request alone is never completion proof. Pending state is retained on BLOCKED;
no buffer/stream is deliberately released as settled. Native connect memory follows
the unchanged PipePair retention logic. Failed exit confirmation has no PASS path.

Output is one fixed CBNV1|SCENARIO_PASS, CBNV1|SCENARIO_FAIL or CBNV1|BLOCKED line;
exit codes are 0, 1 and 125 respectively. No raw exception, path, payload or trace
is reported. SCENARIO_PASS for an overflow/deadline scenario means the EXPECTED
negative condition and cleanup were observed; it is not TEST_PASS, a parent-test
result, full native-contract verification or permission to remove a gate.

Unexpected exceptions, DACL/ABI/identity mismatch, failed child creation/resume,
unconfirmed terminal I/O, cleanup failure or unconfirmed owned-child exit prohibit
SCENARIO_PASS. The process returns BLOCKED and stops, without retry. A controller
crash or failure to terminate the owned child can still leave that child alive;
resource retention is not reclamation. Descendants and privileged interference
are not excluded by this utility. The 40/45-second clock begins immediately before
CreateProcessW; pipe setup precedes it and has the original bounded connect waits.
Synchronous setup/disposal/native calls and scheduling can exceed polling budgets.

This utility independently exercises shared primitives and a small verification
supervisor. It does not execute or verify the production Controller.cs supervision
implementation, CBPT1/CBPR1, Python guard/adapter or the 12 parent tests. Those remain
separate unresolved coverage. SOURCE_INTEGRITY_MANIFEST.md is unchanged and does
not contain these newly created files.
