# Native Job Supervisor with independent watchdog — source only

Owner decision: best-effort 45-second deadline ACCEPTED; an absolute wall-clock
termination guarantee is NOT required. This does not authorize execution,
parent tests, snapshots or provisioning.

## Current implementation

The existing project now explicitly compiles Watchdog.cs.source alongside
Supervisor.cs.source and JobNative.cs.source. Native.cs/PipePair.cs remain linked
and unchanged. File extensions and generated assembly-info suffix avoid the
production recursive *.cs glob. No new test suite or verification mode was added.

Exactly one externally launched supervisor may create at most one watchdog
process and one NativeVerification root, without retry. The watchdog is a fixed
internal role of the SAME separately pinned apphost/DLL; it creates no processes.
The workload job contains only verification and at most its one synthetic child.
The watchdog runs outside that job. Existing host-job constraints are rejected.

Both roles check exact approved owner SID, reject impersonation, validate Windows
x64/.NET 10 and the fixed supervisor apphost path. The existing Require check
remains enforced with SupervisorNativeContractReviewed=true, following owner
acceptance of the static native API review. Production NativeIoContractVerified=false
and reconstruction gates are untouched. No command/env/payload override exists.

## JOB_LIST evidence

SDK 10.0.26100.0 was read locally, without network:
- um/WinBase.h:3507-3510: attribute number mask and INPUT=0x00020000.
- um/WinBase.h:3530-3531: ProcThreadAttributeJobList=13.
- um/WinBase.h:3564-3568: ProcThreadAttributeValue macro.
- um/WinBase.h:3961-3964: JOB_LIST uses (13,FALSE,TRUE,FALSE).
- shared/sdkddkver.h:42: WINTHRESHOLD=0x0A00.

Therefore numeric key 0x0002000D is VERIFIED against this local SDK. No guessed
constant was substituted. SDK guards establish the Windows 10 target family,
not the actual host capability or a tested OS build. The existing >=10.0.10240
precondition is retained. Unsupported update/creation or failed membership stops
without fallback. Runtime atomicity/failure behavior is NOT VERIFIED by headers.

The workload uses 2 attributes: 3-HANDLE inheritance list (24 bytes on x64) and
1-HANDLE JOB_LIST (8 bytes). The original non-inheritable job handle remains alive
through creation; the JOB_LIST array is not an inheritance list. CreateProcessW
is suspended; membership/accounting are checked before its sole ResumeThread.
There is no AssignProcessToJobObject fallback or second workload creation.

## Watchdog bootstrap / READY

Before pipes/workload creation, the supervisor creates unnamed READY and
NORMAL_DONE events plus a 64-byte anonymous pagefile-backed mapping. The record
has fixed magic/version, common T0/frequency, cutoff/deadline, GUID session ID and
zero reserved bytes. Parent writes once and disposes the write view; child gets
SECTION_MAP_READ only. This is control metadata, not a source snapshot.

Five restricted duplicates go through an exact STARTUPINFOEX handle list:
1. owned job: QUERY | TERMINATE (0x000C);
2. real supervisor process: SYNCHRONIZE | QUERY_LIMITED_INFORMATION | TERMINATE
   (0x00101001), duplicated from the current-process pseudo handle into a real one;
3. READY event: EVENT_MODIFY_STATE (2);
4. NORMAL_DONE event: SYNCHRONIZE (0x00100000);
5. mapping: SECTION_MAP_READ (4).

Numeric handles, session ID and self-binary hashes are fixed-format nonsecret argv
metadata; snapshots/credentials are never argv/environment inputs. The child
validates distinct handles and clears their inheritance. No stdio or workload
pipe handles are inherited by watchdog. It emits no diagnostics; its status is
its original process handle's exit code. Parent closes its transferred duplicates.

The watchdog is created RUNNING, not suspended: it can observe parent death even
if the supervisor crashes immediately after CreateProcessW. No watchdog ResumeThread
window is introduced. Before READY it validates record bounds/arithmetic/session,
shared frequency, parent liveness and an empty job. Parent requires READY and
watchdog liveness before workload creation and again before workload resume;
unexpected watchdog exit blocks and triggers owned workload cleanup.

## Best-effort deadline and finalization

A single Stopwatch timestamp T0 is shared; neither process restarts the budget.
Normal work stops at T0+40 seconds; completion/cleanup use the remainder to T0+45.
The watchdog independently observes supervisor death and NORMAL_DONE. At cutoff
or error after admission, it requests supervisor and workload-job termination
independently, then attempts to confirm supervisor exit AND zero job active
processes before the common deadline. Timeout/death always yields BLOCKED.
Failure of one request must not prevent the other request. No PID rediscovery.

Normal supervisor cleanup confirms root exit, job empty and settled readers,
closes its resources, then signals NORMAL_DONE. Watchdog independently queries
emptiness and exits 0 after closing control handles. Supervisor requires confirmed
watchdog exit 0 and successful control-resource cleanup before any PASS.
NORMAL_DONE may acknowledge a safely quiescent failed scenario; the original
fault/scenario classification still prevents a false PASS.

Pending pipe I/O is never declared completed just because cancellation was
requested. Unknown completion/exit/cleanup retains required state and yields
BLOCKED. Closing a job handle is not exit evidence; the watchdog duplicate changes
kill-on-LAST-close behavior, so parent death is explicitly monitored. Failures
after admission may terminate the supervisor before it can print a final record;
an observed process exit 126 is never scenario success.

Readiness cannot protect work started before READY; none is started. Workload
creation remains guarded by JOB_LIST during any parent/watchdog failure race.
Late/in-flight native creation, simultaneous stalls, kernel failures or OS
suspension are not covered by an absolute timing claim. Best-effort supervision
does not make a user-mode process a real-time OS security boundary.

## Output and future invocation

Supervisor captures <=64 KiB stdout and <=64 KiB stderr plus two 4096-byte working
buffers. It prints only one fixed CBJS1 status line, with no raw diagnostics,
exception text or traceback. PASS requires exact CBNV1 result/exit consistency,
both EOFs, no stderr/fault, verified empty job, original root exit, confirmed
watchdog shutdown and elapsed <=45 seconds. Watchdog itself has no stdio capture
or output channel and creates no descendants.

The normal invocation now requires FOUR real, separately approved uppercase
SHA-256 pins (verification apphost/DLL and supervisor apphost/DLL):
    <approved-path>\\Cashback.NativeJobSupervisor.exe <mode> <VERIFICATION_EXE_SHA256> <VERIFICATION_DLL_SHA256> <SUPERVISOR_EXE_SHA256> <SUPERVISOR_DLL_SHA256>

Do not directly invoke --watchdog. No hashes are fabricated or approved by source.
The exact four binary pins in DIAGNOSTIC_AUTHORIZATION.md are APPROVED by owner.
Supervisor.cs.source accepts these normal mode literals: abi, dacl, io, cancel,
stdout-limit, stderr-limit, deadline. It forwards the selected mode unchanged to
the fixed NativeVerification executable. These sources do not designate exactly
one of those modes as the owner's approved single diagnostic scenario; mode
selection remains BLOCKED pending an unambiguous scenario designation.
Fixed Release paths are in source; no dotnet-DLL/debug/RID/path fallback.
Runtimeconfig/deps/runtime authenticity are MODEL A trusted-directory assumptions;
the pins do not establish those independently and TOCTOU is not eliminated.

## Remaining blockers

- SupervisorNativeContractReviewed=true is owner-authorized; the Require check
  remains enforced in BOTH process roles.
- Numeric JOB_LIST key is checked; runtime JOB_LIST capability/atomicity is not.
- New duplicate-handle/mapping/event/bootstrap, cross-process timing, process
  shutdown and existing shared pipe I/O contracts have not been runtime validated.
- Latest supervisor BUILD PASS is owner-reported; the four exact binary pins are
  owner-approved as recorded in DIAGNOSTIC_AUTHORIZATION.md.
- One isolated native-only synthetic diagnostic execution is authorized, without
  retries or fallback; the exact single mode is not established by these sources.
- The prior absolute-deadline blocker is removed by the owner's best-effort choice,
  not by inventing an absolute guarantee.

JOB_LIST, watchdog and native I/O runtime contracts remain UNVERIFIED.
NativeIoContractVerified=false; A/C/D remain NOT GRANTED; parent tests remain
NOT EXECUTED; provisioning remains BLOCKED. This README update performs no build,
restore, execution, tests, snapshot capture or production/manifest modification.
