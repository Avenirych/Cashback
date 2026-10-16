# Windows parent-test controller — source implementation only

This directory is an isolated .NET 10 Windows x64 **library**, not an executable.
There is no controller entry point, capture component, test discovery,
provisioning integration, automatic cleanup command, or CI integration.
The owner subsequently reported .NET SDK 10.0.402 BUILD PASS. This integration
change performs no new build, compilation, execution or tests.
The SDK version reported by the owner is 10.0.402; it is not independently queried
or pinned through a repository-wide SDK configuration by this project.

## Current execution status: BLOCKED

`ParentTestController.NativeIoContractVerified` deliberately returns false.
It cannot be enabled through CBPT1, environment, arguments, or authorization data.
The source stops with `NATIVE_IO_CONTRACT_NOT_VERIFIED` before pipe creation and
before consuming the one-shot execution attempt. Changing this gate requires
separately authorized source changes after closing the blockers below.

This gate is not a substitute for A/C/D. Permission B authorized source editing
only. Current parent hashes remain CANDIDATE. No owner-approved launcher bytes or
launcher hash are supplied here. The public authorization record is trusted-host
input, not an authentication mechanism or an owner approval generator. A future
host must establish real approvals outside test payloads. No executable host is
provided. Exact baseline equality never creates owner approval.

## Files and implemented boundaries

- `Native.cs`: explicit Win32 declarations; x64 size/offset checks; no native calls
  at module initialization. Windows ABI: BOOL represented as four-byte Win32 BOOL,
  DWORD as uint, pointers as IntPtr, SIZE_T/DWORD_PTR as nuint. OVERLAPPED union is
  explicit. CreateProcessW receives an unmanaged mutable UTF-16 command buffer.
- `PipePair.cs`: three controller-created byte-mode local pipe pairs; explicit
  approved-candidate SDDL; fail-closed effective-DACL checks on the server handle;
  first-instance/remote rejection; overlapped server
  endpoints, synchronous child endpoints; PID/property checks; initial inheritance
  disabled; no reconnect. FileStream wrappers borrow the native parent handles;
  native stdin is explicitly closed after successful write/dispose to deliver EOF.
- `Protocol.cs`: fixed 12-ID mapping, ASCII/LF-only 256-byte records, exact 27-record
  CBPR1 automaton, ordered indexes, observed counters, strict completion and EOF.
  Invalid protocol never becomes valid again. CBPT1 generation takes caller-supplied
  copies, checks both sizes/hashes, then Base64-encodes exactly 12312 bytes including LF.
  EOF is latched even for an incomplete prefix; input after EOF or repeated EOF is
  invalid. The 12-ID list is exposed internally through a read-only collection.
- `Controller.cs`: fixed Python path/flags, trusted-host launcher hash check,
  candidate-baseline approval checks, explicit environment and working directory,
  one suspended CreateProcessW and one ResumeThread, original process/thread handles,
  bounded readers, one finalizer, owned-child termination, confirmed exit and safe
  result records. No parent-source file access exists in the controller.

## Approved MODEL A and DACL candidate

Owner identity: `DESKTOP-1E3H20Q\serge`.
SID: `S-1-5-21-3121025797-3907938778-2277447460-1001`.

```
D:P(A;;0x00120087;;;S-1-5-21-3121025797-3907938778-2277447460-1001)
```

This is the owner-approved implementation candidate, **not** proven minimal or
sufficient access. No default/null DACL fallback, sandbox SID, broad group grant,
or generic-write client fallback exists. Child access candidates are 0x00100081
(stdin read) and 0x00100082 (stdout/stderr write). Parent creation explicitly
requests READ_CONTROL. Their sufficiency is unverified. Runtime access denial is
BLOCKED; the code does not widen rights.

MODEL A excludes protection against malicious same-user processes. PID checks are
consistency evidence, not cryptographic authentication. FIRST_PIPE_INSTANCE and
ACLs do not prove absence of privileged duplication. Handle-list inheritance only
limits this creation, not descendants. A trusted host must have no competing
process-creation paths during the short inheritable-handle interval. This library
cannot enforce that property against arbitrary in-process code.

## Limits and finalization

Saved stdout <=65536 bytes; saved stderr <=65536 bytes; saved total <=131072 bytes.
Two fixed 4096-byte working chunks. CBPR1 has a fixed 255-byte content buffer
(plus LF, total 256); no unbounded diagnostic queue or raw output reporting.
Total RSS is not claimed to be 128 KiB. Buffers never go to disk.

The monotonic clock starts immediately before CreateProcessW. Normal operation
has 40 seconds and finalization uses the remainder of the same 45-second budget.
No retry, PID lookup, process-name search, or process-tree kill exists. The native
process handle is waited with zero-time polls; only a signaled handle followed by
GetExitCodeProcess confirms exit. TerminateProcess success alone is insufficient.
Ordinary FAIL/ERROR/SKIP events do not terminate a healthy run prematurely.

Cancellation does not prove I/O completion. Pending buffers/streams are retained,
not freed as though settled. One failed run can be retained until host exit;
`HasUnconfirmedResources` reports this without exposing contents. No background
retry or unbounded reaper is created. This is a deliberate failure state, not a
claim that resources were fully reclaimed. Incomplete I/O or exit prohibits PASS.
Native connect cancellation has a separate bounded setup wait before child start.

Any unrecognized stderr prohibits PASS. Guard exit 125 blocks the result; detailed
guard-line validation is not implemented because the final approved launcher text
and exact diagnostics contract are not available in this implementation.

## Exact unresolved security blockers

1. Native access-check behavior for candidate masks, required query rights,
   synchronous-client SYNCHRONIZE semantics, connection return/error handling, and
   .NET FileStream EOF/cancellation mapping need authoritative verification.
2. Effective object DACL verification is now implemented in source using
   GetSecurityInfo (SE_FILE_OBJECT / DACL_SECURITY_INFORMATION), bounded descriptor
   decoding (20..4096 bytes), and exact protected-DACL checks. It requires one
   non-inherited, non-callback ACCESS_ALLOWED ACE, the approved SID and mask
   0x00120087; null/defaulted/auto-inherited DACL states are rejected. It runs after
   server creation, after connection, and before enabling child inheritance.
   GetSecurityInfo's returned status is checked directly. This is source-only:
   the new interop and descriptor behavior are not independently verified or
   executed. No rights are widened to make the query succeed. A DACL observation
   does not prevent later privileged/same-user changes under MODEL A.
3. Async FileStream creation for overlapped pipe handles and CancelIoEx interaction,
   including pending-operation completion and ownership after construction failure,
   remain runtime-unverified. The code must stay gated until reviewed.
4. Parent receiver/adapter/CBPR1 runner sources now exist in ../parent_test_launcher.py
   and ../parent_test_adapter.py. The exact approved G001-G011/source-only bootstrap
   and final launcher hash are still absent; the new launcher blocks before receive.
   No replacement guard or hash is invented. See ../PARENT_CONTROLLER_INTEGRATION.md.
5. Current SDK is owner-reported; exact deployed runtime patch and native binary
   authenticity are not proved by checking Environment.Version.Major.
6. No external supervisor/job boundary exists. A blocked synchronous native call,
   process crash, or privileged interference can defeat the internal deadline or
   leave the child. Descendants may hold pipe handles. No absolute isolation claim.
7. The owner's reported prior BUILD PASS does not prove native ABI/I/O behavior or
   validate the newly added Python integration. Runtime validation remains separately
   permissioned. NativeIoContractVerified is still false.

## Preserved state

MODEL A OWNER APPROVED; identity OWNER CONFIRMED; DACL DESIGN OWNER APPROVED CANDIDATE.
Allowlist FIXED AT 12. Previous 57/57 PASS unchanged. Parent tests NOT EXECUTED.
Parent hashes CANDIDATE. B SOURCE IMPLEMENTATION ONLY. A/C/D NOT GRANTED.
Provisioning BLOCKED. No new tests have been added.

## One-pass source review corrections

Only the six existing controller files were read once for this pass. No build,
controller, Python, tests, Git, Docker or PostgreSQL were executed. Edits were made
through the file patch API, never PowerShell writes. The csproj was reviewed and
left unchanged. NativeIoContractVerified remains false.

Corrections: complete x64 field-offset assertions and explicit x64 architecture
check; effective DACL validation; irreversible protocol EOF; immutable ID list;
checked CancelIoEx failure reporting (ERROR_NOT_FOUND does not prove completion);
removal of temporary child-handle inheritance during cleanup independently of
pending parent I/O; retention rather than native-close after failed stream Dispose;
serialized parent native close/cancel to prevent raw-handle reuse races; independent
thread/process handle cleanup and retention when close is unconfirmed. An
unexpected reader cancellation now latches an incomplete-result reason. Guard exit
125 retains BLOCKED classification even when I/O completion is unconfirmed.

These corrections are static source findings, not runtime evidence. Pending
operations can still require retention until hosting-process exit. The fixed
approved DACL remains an implementation candidate, not a proven minimum.

## Native I/O contract review (2026-10-16)

Source review now rejects immediately completed/failed stdout or stderr readers
before ResumeThread, and rechecks the operational deadline, explicit cancellation
and latched I/O failure before stdin delivery. These are precondition checks, not
proof that a native read has been submitted or that subsequent I/O cannot fail.

ReadFile/WriteFile and their data-operation OVERLAPPED/buffer ownership are
delegated to the installed .NET FileStream implementation; Native.Overlapped is
used explicitly only for ConnectNamedPipe. No direct data-I/O completion-count
verification is implemented here. Partial-write handling, broken-pipe-to-EOF
mapping, cancellation completion, constructor/disposal behavior and the safety of
native CancelIoEx together with FileStream remain unverified by this source review.
Connect operation memory/event are retained while connectPending remains true;
ERROR_NOT_FOUND from CancelIoEx is never treated as completion evidence.

The code contains x64 size/offset assertions and explicit BOOL/pointer/Unicode
marshalling, but these assertions were not executed in this pass and the Windows
SDK declarations were not independently reread. DACL equality is checked in
source; actual access sufficiency of the candidate masks remains unverified.
64 KiB per-channel saved-output caps and the 40/45-second polling budgets are
visible in source. Synchronous native calls, cancellation callbacks, stream
construction/disposal and scheduler delays cannot be given a hard 45-second
wall-clock guarantee by these polling loops.

NativeIoContractVerified remains false. No compilation, execution, tests or
snapshot capture were performed. SOURCE_INTEGRITY_MANIFEST.md was not modified;
its recorded Controller.cs digest now describes the pre-review source and must
not be treated as the digest of the current file. This README is not an entry in
that source manifest. No integrity baseline was silently updated or approved.
