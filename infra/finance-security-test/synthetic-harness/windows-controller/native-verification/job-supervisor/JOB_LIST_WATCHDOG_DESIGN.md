# JOB_LIST / watchdog implementation record

This supersedes the former design-only status of this document. The owner's
approved design is implemented in source in Watchdog.cs.source and integrated in
Supervisor.cs.source; see README.md for exact protocol, rights, paths and invocation.
No build or execution occurred; both gates remain false.

## Decisions preserved

- MODEL A and exact owner SID remain unchanged; impersonation rejected.
- Best-effort deadline accepted by owner; no absolute 45-second promise.
- One externally launched supervisor, one internal watchdog and at most one
  verification root plus its single existing synthetic child; no retries.
- Watchdog outside workload job, no descendants, fixed same apphost internal role.
- No new test suite, verification modes, owner hash approvals or parent permissions.

## Bootstrap record (64 bytes, little-endian)

| Offset | Size | Value |
|---:|---:|---|
| 0 | 4 | magic 0x31445743 |
| 4 | 4 | version 1 |
| 8 | 8 | shared Stopwatch T0 |
| 16 | 8 | Stopwatch frequency |
| 24 | 8 | T0 + 45*frequency |
| 32 | 8 | T0 + 40*frequency |
| 40 | 16 | GUID bytes matching fixed-format session argument |
| 56 | 8 | reserved zero |

Only fixed control data is mapped. Exactly 5 restricted handles are inherited.
The child clears inheritance and maps only 64 bytes read-only. It validates the
record, common frequency, checked deadline arithmetic, parent liveness and job
emptiness before signaling READY. Parent waits on READY and checks the original
watchdog handle. No workload is created before this completes.

## Watchdog / creation lifecycle

The watchdog starts immediately (no suspended-bootstrap orphan window). If the
parent dies before READY, there is no workload; after valid admission the watchdog
monitors the original parent handle and terminates the job on death/failure.
Workload creation uses JOB_LIST plus suspended creation and exact pipe handle
inheritance. Membership/accounting are checked before resume, never repaired by
late assignment. Parent monitors watchdog liveness through original handles.
At cutoff watchdog requests owned parent/job termination independently; cleanup
evidence is confirmed parent exit plus zero job active processes. NORMAL_DONE is
used only after parent has stopped all workload creation and confirmed quiescence.
Both control processes need confirmed completion before a successful report.

The common deadline starts before watchdog creation, includes READY and workload
setup and is never restarted. A hung OS call, watchdog failure or suspension can
defeat best-effort timing; unconfirmed state is BLOCKED, never fabricated success.
The independently held job handle means kill-on-last-close alone is insufficient.

## JOB_LIST evidence and remaining uncertainty

Local SDK 10.0.26100.0 WinBase.h lines 3507-3510, 3531, 3564-3568, 3963-3964 confirm
JOB_LIST=0x0002000D. sdkddkver.h line 42 identifies WINTHRESHOLD=0x0A00.
Numeric-key check PASS; current-host support and runtime semantics UNVERIFIED.
No network was used, no unsupported constant guessed, no gates opened.
New watchdog interop/handshake and shared pipe I/O still require runtime evidence.
No such validation is claimed and no extra testing/review cycle is created here.

Source modifications stay within job-supervisor/. Production, NativeVerification,
integrity manifest, parent sources and approvals are unchanged. Compilation is
required after source changes, separately authorized; execution remains BLOCKED.
