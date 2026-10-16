# Native-only diagnostic authorization record

Record date: 2026-10-16.
Project: `C:\Users\serge\cashback+`.

**Binary pin owner approval: APPROVED for the exact four hashes below.**
This document records the owner's explicit approval within the native-only
authorization boundary below. It does not verify runtime contracts or introduce
a bypass. This task records closure of the owner-reported run; no additional
execution is performed. Remaining authorized supervisor invocations: **0**.

## Final outcome — authorization consumed

- Approved diagnostic mode: **abi**.
- Authorized supervisor invocations: **1**.
- Completed supervisor invocations: **1** (owner-reported).
- Remaining authorized invocations: **0**.
- Observed stdout: `CBJS1|BLOCKED`.
- Observed exit code: **125**.
- Final result: **BLOCKED**.
- Exact root cause: **UNKNOWN**.
- Runtime contracts: **UNVERIFIED**.
- CBJD1: **NOT IMPLEMENTED**.
- No further execution authorized. No retries or fallback.

BLOCKED does not identify a specific failed native component. Watchdog, JOB_LIST,
I/O and cleanup success have not been established by the supplied result.
In-memory-only diagnostics were considered but not implemented.
Any future execution requires separate explicit owner authorization; the four
approved binary pins do not renew the consumed execution authorization.

## Reported prerequisites

- Latest supervisor BUILD PASS: owner-reported.
- Static native API review: **ACCEPTED BY OWNER**.
- Supervisor gate source change: **AUTHORIZED**.
- Owner Windows identity PASS: owner-reported for the owner's local session.
  This does not assert that CodexSandboxOffline is the approved owner identity.
- Hash comparison: **PASS (owner-reported)** for the four binaries below.
- Binary pin owner approval: **APPROVED** by explicit owner decision.
- JOB_LIST numeric constant: confirmed against local Windows SDK 10.0.26100.0.
- Best-effort deadline: accepted by owner; no absolute 45-second guarantee.
- One native-only diagnostic run: authorization consumed by the reported abi run.
- JOB_LIST runtime: **UNVERIFIED**.
- Watchdog runtime: **UNVERIFIED**.
- Native I/O runtime: **UNVERIFIED**.

## Four binary pins — OWNER APPROVED

Paths are relative to `C:\Users\serge\cashback+`.
These four SHA-256 values are transcribed from the owner's latest PowerShell
results, not recomputed in this task. Their approval is based on the explicit
owner decision, not inferred from hash comparison.

All four values are unchanged by this approval record update. Approval applies
only to these exact binary pins for one isolated native-only synthetic execution.
Any subsequent rebuild requires pin refresh and explicit approval of changed pins.
This record update does not authorize a build or perform execution.

| Binary | SHA-256 |
|---|---|
| `infra/finance-security-test/synthetic-harness/windows-controller/native-verification/bin/Release/net10.0-windows/Cashback.NativeVerification.exe` | `6A80766A5AB8B0FFF317A8FED33807961966212C5F43F1BF0ED63CA800B17593` |
| `infra/finance-security-test/synthetic-harness/windows-controller/native-verification/bin/Release/net10.0-windows/Cashback.NativeVerification.dll` | `C4370BBB12B33C22220BE2E147872C573CEC7725E57829DA6B65A1A153A85DA3` |
| `infra/finance-security-test/synthetic-harness/windows-controller/native-verification/job-supervisor/bin/Release/net10.0-windows/Cashback.NativeJobSupervisor.exe` | `8D897780176EC02F9BEE81AED53D20AE5F7D827BFC6F3B20F5DAB6EECBD3EBDF` |
| `infra/finance-security-test/synthetic-harness/windows-controller/native-verification/job-supervisor/bin/Release/net10.0-windows/Cashback.NativeJobSupervisor.dll` | `DF6FF42216138D965D383C10B18F6A4E5C4CFC88332023FB724C6E0629B55AE4` |

## Exact authorization boundary

The consumed execution authorization covered one isolated synthetic NativeVerification
diagnostic run under the approved owner identity only:

- Identity: `DESKTOP-1E3H20Q\serge`.
- SID: `S-1-5-21-3121025797-3907938778-2277447460-1001`.
- One supervisor invocation, at most one independent watchdog and one verification
  root with at most its existing single synthetic child.
- Synthetic data only, fixed executable paths and fixed existing scenario set.
- No retries or fallback; the authorization does not authorize running every scenario.
- No production controller / ExecuteOnceAsync execution.
- No parent Python tests, parent harness execution or Python execution.
- No snapshot capture/delivery, real credentials, provisioning, Docker,
  PostgreSQL or SQL.

A/C/D remain NOT GRANTED. This native-only authorization does not grant them or
approve parent hashes. The owner separately authorized only the supervisor gate
source change to true; no other security gate change is authorized.

## Recorded approval and preserved state

`SupervisorNativeContractReviewed=true` records acceptance of the completed
static native API review in source. The existing Main Require check remains
enforced for supervisor and watchdog roles; no diagnostic exception or alternative
route is authorized. Latest supervisor BUILD PASS is owner-reported. Binary pin
owner approval is APPROVED for the four exact hashes above, under the approved
owner SID only, with one native-only diagnostic execution maximum, no retries or
fallback and a best-effort deadline. Runtime checks and existing gates remain
mandatory; this record does not claim they have passed at execution time.

`NativeIoContractVerified=false` is preserved. Runtime contracts remain UNVERIFIED
until actual separately admitted diagnostic evidence exists; no result is inferred
from successful compilation or hash comparison. Parent tests remain NOT EXECUTED.
Provisioning remains BLOCKED.

## Actions performed for this record

Only this Markdown record was updated in this task. No executable source,
watchdog logic, production files, NativeVerification files, security gates or
integrity manifest were changed. SupervisorNativeContractReviewed=true and
NativeIoContractVerified=false were preserved.
No build, restore, tests, supervisor/watchdog/verification/Python execution,
snapshot capture, provisioning, Git or network operation was performed.

**Additional launches in this task: 0.** The completed diagnostic invocation above
is owner-reported; no supervisor, watchdog, verification or child was launched
while updating this record. All four approved SHA-256 values remain unchanged.
