using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;

namespace Cashback.Synthetic.Controller;

/// <summary>Trusted-host inputs, never decoded from CBPT1 or test payloads.</summary>
public sealed record ExecutionAuthorization(
    bool OwnerBaselineApprovalA,
    bool ImplementationB,
    bool SnapshotDeliveryC,
    bool ExactExecutionD,
    string ApprovedCommonSha256,
    string ApprovedProvisionSha256,
    string ApprovedLauncherSha256);

/// <summary>No raw output, exceptions, snapshots or diagnostic text.</summary>
public sealed record ControllerResult(
    string Status, string Reason, uint? ExitCode,
    bool DeliverySent, bool DeliveryAccepted, bool ExitConfirmed,
    bool ReadersComplete, int Passed, int Failures, int Errors, int Skipped);

/// <summary>
/// Library only: no CLI, launcher, capture, parent-file loading or provisioning.
/// One attempted execution per hosting process, including failed starts.
/// </summary>
public static class ParentTestController
{
    private const string Python = @"C:\Python314\python.exe";
    private const string WorkingDirectory = @"C:\Python314";
    // Intentional source-level STOP. It is not an owner permission switch.
    // Full named-pipe rights/EOF/cancellation contracts remain unverified.
    private static bool NativeIoContractVerified => false;
    private static int attemptConsumed;
    private static RunState? retainedUnconfirmedState;
    public static bool HasUnconfirmedResources => Volatile.Read(ref retainedUnconfirmedState) != null;

    public static async Task<ControllerResult> ExecuteOnceAsync(
        ExecutionAuthorization authorization, string approvedLauncher,
        ReadOnlyMemory<byte> commonSnapshot, ReadOnlyMemory<byte> provisionSnapshot,
        CancellationToken cancellation = default)
    {
        var s = new RunState();
        try
        {
            if (authorization is null) throw new PolicyFailure("AUTHORIZATION_MISSING");
            Native.Require(authorization.OwnerBaselineApprovalA && authorization.ImplementationB &&
                authorization.SnapshotDeliveryC && authorization.ExactExecutionD, "PERMISSION_MISSING");
            Native.Require(authorization.ApprovedCommonSha256 == SnapshotFrame.CommonHash &&
                authorization.ApprovedProvisionSha256 == SnapshotFrame.ProvisionHash, "OWNER_BASELINE_MISMATCH");
            Native.ValidateLayouts();
            Native.Require(Environment.Version.Major == 10, "DOTNET_RUNTIME_MISMATCH");
            using (var identity = WindowsIdentity.GetCurrent())
                Native.Require(identity.User?.Value == PipePair.OwnerSid, "CONTROLLER_IDENTITY_MISMATCH");
            Native.Require(!string.IsNullOrEmpty(approvedLauncher) && approvedLauncher.Length <= 24000 &&
                !approvedLauncher.Contains('\0'), "LAUNCHER_INVALID");
            byte[] launcherBytes = new UTF8Encoding(false, true).GetBytes(approvedLauncher);
            Native.Require(authorization.ApprovedLauncherSha256.Length == 64 &&
                Convert.ToHexString(SHA256.HashData(launcherBytes)) == authorization.ApprovedLauncherSha256,
                "LAUNCHER_HASH_MISMATCH");
            Native.Require(commonSnapshot.Length == 7558 && provisionSnapshot.Length == 1666, "SNAPSHOT_SIZE_MISMATCH");
            // Copy before verification: caller mutations cannot change the checked frame.
            byte[] common = commonSnapshot.ToArray(), provision = provisionSnapshot.ToArray();
            try { s.Frame = SnapshotFrame.Encode(common, provision); }
            finally { CryptographicOperations.ZeroMemory(common); CryptographicOperations.ZeroMemory(provision); }
            Native.Require(!cancellation.IsCancellationRequested, "EXPLICIT_CANCELLATION");
            Native.Require(NativeIoContractVerified, "NATIVE_IO_CONTRACT_NOT_VERIFIED");
            Native.Require(Interlocked.CompareExchange(ref attemptConsumed, 1, 0) == 0, "ATTEMPT_ALREADY_CONSUMED");

            s.Input.Open(); s.Output.Open(); s.Error.Open();
            PrepareCreation(s, approvedLauncher);
            Native.Require(!cancellation.IsCancellationRequested, "EXPLICIT_CANCELLATION");
            s.Clock.Start();
            s.StartAttempted = true;
            bool created = Native.CreateProcess(s.Application, s.Command, IntPtr.Zero, IntPtr.Zero,
                true, Native.Suspended | Native.UnicodeEnvironment | Native.ExtendedStartup | Native.NoWindow,
                s.Environment, s.Directory, ref s.Startup, out s.Information);
            s.StartConfirmed = created;
            // PROCESS_INFORMATION outputs are not ownership evidence on failure.
            if (!created) s.Information = default;
            Native.Require(created, "PROCESS_CREATE_FAILED");
            Native.Require(s.Information.Process != IntPtr.Zero && s.Information.Thread != IntPtr.Zero,
                "PROCESS_OWNERSHIP_UNCONFIRMED");
            s.Input.CloseChild(); s.Output.CloseChild(); s.Error.CloseChild();
            ReleaseCreation(s);
            s.Input.AttachStream(); s.Output.AttachStream(); s.Error.AttachStream();
            s.OutputTask = ReadChannel(s, s.Output.Stream!, s.Stdout, isStdout: true);
            s.ErrorTask = ReadChannel(s, s.Error.Stream!, s.Stderr, isStdout: false);
            // Async readers have been invoked before the suspended child can execute.
            // An immediate read error/EOF must not permit resuming the child.
            // Pending tasks alone do not attest native I/O readiness.
            Native.Require(s.Fault == null && !s.OutputTask.IsCompleted && !s.ErrorTask.IsCompleted,
                "READERS_NOT_READY");
            Native.Require(s.Clock.ElapsedMilliseconds < 40000 && !cancellation.IsCancellationRequested,
                "PRE_RESUME_DEADLINE_OR_CANCELLATION");
            Native.Require(Native.ResumeThread(s.Information.Thread) == 1, "PROCESS_RESUME_FAILED");
            s.Resumed = true;
            Native.Require(Native.CloseHandle(s.Information.Thread), "THREAD_HANDLE_CLOSE_FAILED");
            s.Information.Thread = IntPtr.Zero;
            Native.Require(s.Clock.ElapsedMilliseconds < 40000 && !cancellation.IsCancellationRequested,
                "PRE_DELIVERY_DEADLINE_OR_CANCELLATION");
            Native.Require(s.Fault == null, "PRE_DELIVERY_IO_FAILURE");
            s.DeliveryTask = Deliver(s);

            while (s.Clock.ElapsedMilliseconds < 40000)
            {
                if (cancellation.IsCancellationRequested) { s.Stop("EXPLICIT_CANCELLATION"); break; }
                if (s.Fault != null) break;
                PollExit(s);
                if (s.ExitConfirmed && s.TasksSettled) break;
                await Task.Delay(10).ConfigureAwait(false);
            }
            if (!s.ExitConfirmed || !s.TasksSettled)
                s.Stop("OPERATIONAL_TIMEOUT");
        }
        catch (PolicyFailure e) { s.Stop(e.Code); }
        catch { s.Stop("CONTROLLER_EXCEPTION"); }
        finally { await FinalizeOnce(s).ConfigureAwait(false); }

        return Classify(s);
    }

    private static void PrepareCreation(RunState s, string launcher)
    {
        PipePair[] pipes = [s.Input, s.Output, s.Error];
        Native.Require(pipes.Select(p => p.Child).Distinct().Count() == 3, "DUPLICATE_CHILD_HANDLE");
        foreach (var pipe in pipes) pipe.MakeChildInheritable();
        nuint size = 0;
        bool sizing = Native.InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref size);
        int sizingError = Marshal.GetLastPInvokeError();
        Native.Require(!sizing && sizingError == 122 && size > 0 && size <= 65536, "ATTRIBUTE_LIST_SIZE_INVALID");
        s.AttributeMemory = Marshal.AllocHGlobal(checked((int)size));
        Native.Require(Native.InitializeProcThreadAttributeList(s.AttributeMemory, 1, 0, ref size), "ATTRIBUTE_LIST_INIT_FAILED");
        s.AttributesInitialized = true;
        s.HandleArray = Marshal.AllocHGlobal(24);
        for (int i = 0; i < 3; i++) Marshal.WriteIntPtr(s.HandleArray, i * 8, pipes[i].Child);
        Native.Require(Native.UpdateProcThreadAttribute(s.AttributeMemory, 0, 0x20002,
            s.HandleArray, 24, IntPtr.Zero, IntPtr.Zero), "HANDLE_LIST_FAILED");
        foreach (var pipe in pipes)
        { PipePair.CheckInheritance(pipe.Parent, false); PipePair.CheckInheritance(pipe.Child, true); }
        s.Startup = new Native.StartupInfoEx {
            Startup = new Native.StartupInfo {
                Cb = 112, Flags = Native.UseStdHandles,
                Stdin = pipes[0].Child, Stdout = pipes[1].Child, Stderr = pipes[2].Child },
            Attributes = s.AttributeMemory };
        s.Application = Marshal.StringToHGlobalUni(Python);
        // Windows CRT quoting: no shell and no source/snapshot in separate arguments.
        string command = Quote(Python) + " -B -s -S -c " + Quote(launcher);
        Native.Require(command.Length < 32767, "COMMAND_LENGTH_INVALID");
        s.Command = Marshal.StringToHGlobalUni(command);
        s.Directory = Marshal.StringToHGlobalUni(WorkingDirectory);
        // Explicit environment; never copied from the hosting environment.
        s.Environment = Marshal.StringToHGlobalUni(
            "PYTHONDONTWRITEBYTECODE=1\0PYTHONNOUSERSITE=1\0SystemRoot=C:\\Windows\0\0");
    }
    private static string Quote(string value)
    {
        var b = new StringBuilder(value.Length * 2 + 2); b.Append('"');
        int slashes = 0;
        foreach (char c in value)
        {
            if (c == '\\') { slashes++; continue; }
            if (c == '"') b.Append('\\', slashes * 2 + 1);
            else b.Append('\\', slashes);
            b.Append(c); slashes = 0;
        }
        return b.Append('\\', slashes * 2).Append('"').ToString();
    }

    private static async Task Deliver(RunState s)
    {
        try
        {
            await s.Input.Stream!.WriteAsync(s.Frame!.AsMemory(), s.IoCancellation.Token).ConfigureAwait(false);
            s.WriteCompleted = true;
            // Synchronous close may block: no hard OS watchdog guarantee is claimed.
            s.Input.CompleteInput();
            s.StdinClosed = true;
            s.DeliverySent = true;
        }
        catch (OperationCanceledException) { s.Stop("STDIN_CANCELLED"); }
        catch { s.Stop("STDIN_DELIVERY_FAILED"); }
    }
    private static async Task ReadChannel(RunState s, Stream stream, Channel channel, bool isStdout)
    {
        byte[] chunk = new byte[4096];
        try
        {
            while (true)
            {
                int n = await stream.ReadAsync(chunk.AsMemory(), s.IoCancellation.Token).ConfigureAwait(false);
                if (n == 0)
                {
                    lock (s.Sync) { channel.Eof = true; if (isStdout) s.Parser.Eof(); }
                    return;
                }
                lock (s.Sync)
                {
                    int room = Math.Min(channel.Bytes.Length - channel.Count, 131072 - s.Captured);
                    int keep = Math.Min(room, n);
                    chunk.AsSpan(0, keep).CopyTo(channel.Bytes.AsSpan(channel.Count));
                    channel.Count += keep; s.Captured += keep;
                    if (keep != n) { channel.Incomplete = true; s.Stop("DIAGNOSTICS_OVERFLOW"); return; }
                    if (isStdout)
                    {
                        s.Parser.Feed(chunk.AsSpan(0, n));
                        if (s.Parser.Invalid != null) s.Stop("RESULT_PROTOCOL_INVALID");
                    }
                    // Nonempty stderr is never printed or treated as safe by default.
                    // Guard exit 125 is classified independently after confirmed exit.
                }
            }
        }
        catch (OperationCanceledException)
        { lock (s.Sync) channel.Incomplete = true; s.Stop("READER_CANCELLED"); }
        catch { lock (s.Sync) channel.Incomplete = true; s.Stop("READER_ERROR"); }
        finally { CryptographicOperations.ZeroMemory(chunk); }
    }
    private static void PollExit(RunState s)
    {
        if (!s.StartConfirmed || s.ExitConfirmed || s.Information.Process == IntPtr.Zero) return;
        uint wait = Native.WaitForSingleObject(s.Information.Process, 0);
        if (wait == 0)
        {
            Native.Require(Native.GetExitCodeProcess(s.Information.Process, out uint exit), "EXIT_CODE_UNCONFIRMED");
            s.ExitCode = exit; s.ExitConfirmed = true;
        }
        else Native.Require(wait == Native.WaitTimeout, "EXIT_WAIT_FAILED");
    }

    private static async Task FinalizeOnce(RunState s)
    {
        if (s.FinalizationEntered) { s.Stop("DUPLICATE_FINALIZATION"); return; }
        s.FinalizationEntered = true;
        try
        {
            // Normal supervision already waited for natural exit, not merely protocol completion.
            if (s.Fault != null || !s.TasksSettled)
            {
                try { s.IoCancellation.Cancel(); } catch { s.CleanupFailed = true; }
                if (!s.Input.RequestIoCancellation()) s.CleanupFailed = true;
            }
            if (s.StartConfirmed && !s.ExitConfirmed)
            {
                try { PollExit(s); } catch { s.Stop("EXIT_CONFIRMATION_FAILED"); }
                if (!s.ExitConfirmed && s.Information.Process != IntPtr.Zero)
                {
                    s.TerminationRequested = true;
                    if (!Native.TerminateProcess(s.Information.Process, 126)) s.Stop("TERMINATION_REQUEST_FAILED");
                }
                while (!s.ExitConfirmed && s.Clock.ElapsedMilliseconds < 45000)
                {
                    try { PollExit(s); } catch { s.Stop("EXIT_CONFIRMATION_FAILED"); break; }
                    if (!s.ExitConfirmed) await Task.Delay(10).ConfigureAwait(false);
                }
            }
            if (!s.TasksSettled)
            {
                if (!s.Output.RequestIoCancellation()) s.CleanupFailed = true;
                if (!s.Error.RequestIoCancellation()) s.CleanupFailed = true;
                while (!s.TasksSettled && s.Clock.ElapsedMilliseconds < 45000)
                    await Task.Delay(10).ConfigureAwait(false);
            }
        }
        catch { s.CleanupFailed = true; s.Stop("FINALIZATION_EXCEPTION"); }
        finally
        {
            // Independent cleanup steps: one failure must not skip the others.
            try { ReleaseCreation(s); } catch { s.CleanupFailed = true; }
            try { if (!s.Input.CloseResources(s.DeliveryTask?.IsCompleted ?? true)) s.CleanupFailed = true; }
            catch { s.CleanupFailed = true; }
            try { if (!s.Output.CloseResources(s.OutputTask?.IsCompleted ?? true)) s.CleanupFailed = true; }
            catch { s.CleanupFailed = true; }
            try { if (!s.Error.CloseResources(s.ErrorTask?.IsCompleted ?? true)) s.CleanupFailed = true; }
            catch { s.CleanupFailed = true; }
            if (s.TasksSettled)
            {
                if (s.Frame != null) CryptographicOperations.ZeroMemory(s.Frame);
                CryptographicOperations.ZeroMemory(s.Stdout.Bytes);
                CryptographicOperations.ZeroMemory(s.Stderr.Bytes);
                try { s.IoCancellation.Dispose(); } catch { s.CleanupFailed = true; }
            }
            else
            {
                // One-shot bound: retain at most one failed run until host exit.
                // Do not release buffers/handles still owned by pending native I/O.
                retainedUnconfirmedState = s;
            }
            try
            {
                if (s.StartConfirmed && s.Information.Thread != IntPtr.Zero)
                {
                    if (!Native.CloseHandle(s.Information.Thread)) s.CleanupFailed = true;
                    else s.Information.Thread = IntPtr.Zero;
                }
            }
            catch { s.CleanupFailed = true; }
            try
            {
                if (s.StartConfirmed && s.Information.Process != IntPtr.Zero && s.ExitConfirmed)
                {
                    if (!Native.CloseHandle(s.Information.Process)) s.CleanupFailed = true;
                    else s.Information.Process = IntPtr.Zero;
                }
            }
            catch { s.CleanupFailed = true; }
            if (s.StartConfirmed && (s.Information.Process != IntPtr.Zero || s.Information.Thread != IntPtr.Zero))
                retainedUnconfirmedState = s;
            if (s.Input.NeedsRetention || s.Output.NeedsRetention || s.Error.NeedsRetention)
                retainedUnconfirmedState = s;
            s.Finalized = true;
        }
    }
    private static void ReleaseCreation(RunState s)
    {
        if (s.AttributesInitialized)
        { Native.DeleteProcThreadAttributeList(s.AttributeMemory); s.AttributesInitialized = false; }
        Free(ref s.AttributeMemory); Free(ref s.HandleArray); Free(ref s.Application);
        Free(ref s.Command); Free(ref s.Environment); Free(ref s.Directory);
    }
    private static void Free(ref IntPtr memory)
    { if (memory != IntPtr.Zero) { Marshal.FreeHGlobal(memory); memory = IntPtr.Zero; } }

    private static ControllerResult Classify(RunState s)
    {
        // Do not inspect parser/counters concurrently with an unfinished reader.
        if (!s.TasksSettled)
            return new("BLOCKED", s.StartConfirmed && !s.ExitConfirmed ?
                "PROCESS_TERMINATION_UNCONFIRMED" : s.ExitCode == 125 ? "GUARD_STOP" : "IO_COMPLETION_UNCONFIRMED",
                s.ExitCode, s.DeliverySent, false, s.ExitConfirmed, false, 0, 0, 0, 0);
        string status, reason;
        bool readers = s.OutputTask != null && s.ErrorTask != null && s.TasksSettled &&
            s.Stdout.Eof && s.Stderr.Eof && !s.Stdout.Incomplete && !s.Stderr.Incomplete;
        if (s.StartConfirmed && !s.ExitConfirmed) { status = "BLOCKED"; reason = "PROCESS_TERMINATION_UNCONFIRMED"; }
        else if (s.ExitCode == 125) { status = "BLOCKED"; reason = "GUARD_STOP"; }
        else if (s.Parser.Invalid != null) { status = "BLOCKED"; reason = "RESULT_PROTOCOL_INVALID"; }
        else if (s.Fault != null)
        { status = s.Fault is "DIAGNOSTICS_OVERFLOW" or "READER_ERROR" or "READER_CANCELLED" ? "INCONCLUSIVE" : "BLOCKED"; reason = s.Fault; }
        else if (s.ExitCode is not (0 or 1)) { status = "BLOCKED"; reason = "PROCESS_FAILURE"; }
        else if (!readers || s.CleanupFailed || !s.Finalized || !s.Parser.Complete || !s.DeliverySent)
        { status = "INCONCLUSIVE"; reason = "EVIDENCE_INCOMPLETE"; }
        else if (s.Stderr.Count != 0) { status = "BLOCKED"; reason = "STDERR_PROTOCOL_UNVERIFIED"; }
        else if ((s.Parser.Failures + s.Parser.Errors > 0) != (s.ExitCode == 1))
        { status = "BLOCKED"; reason = "PROCESS_RESULT_MISMATCH"; }
        else if (s.Parser.Errors > 0) { status = "TEST_ERROR"; reason = "TEST_ERRORS"; }
        else if (s.Parser.Failures > 0) { status = "TEST_FAIL"; reason = "TEST_FAILURES"; }
        else if (s.Parser.Skipped > 0) { status = "INCONCLUSIVE"; reason = "REQUIRED_TEST_SKIPPED"; }
        else if (s.Parser.Passed == 12 && s.Parser.Accepted && s.ExitCode == 0 && !s.TerminationRequested)
        { status = "TEST_PASS"; reason = "COMPLETE"; }
        else { status = "BLOCKED"; reason = "RESULT_UNCONFIRMED"; }
        return new(status, reason, s.ExitCode, s.DeliverySent, s.Parser.Accepted,
            s.ExitConfirmed, readers, s.Parser.Passed, s.Parser.Failures, s.Parser.Errors, s.Parser.Skipped);
    }

    private sealed class Channel
    {
        internal readonly byte[] Bytes = new byte[65536];
        internal int Count;
        internal bool Eof, Incomplete;
    }
    private sealed class RunState
    {
        internal readonly object Sync = new();
        internal readonly Stopwatch Clock = new();
        internal readonly CancellationTokenSource IoCancellation = new();
        internal readonly PipePair Input = new(true), Output = new(false), Error = new(false);
        internal readonly Channel Stdout = new(), Stderr = new();
        internal readonly CbprParser Parser = new();
        internal Native.StartupInfoEx Startup;
        internal Native.ProcessInformation Information;
        internal IntPtr AttributeMemory, HandleArray, Application, Command, Environment, Directory;
        internal bool AttributesInitialized, StartAttempted, StartConfirmed, Resumed,
            WriteCompleted, StdinClosed, DeliverySent, ExitConfirmed, TerminationRequested,
            FinalizationEntered, Finalized, CleanupFailed;
        internal uint? ExitCode;
        internal int Captured;
        internal byte[]? Frame;
        internal Task? DeliveryTask, OutputTask, ErrorTask;
        private string? fault;
        internal string? Fault => Volatile.Read(ref fault);
        internal void Stop(string code) => Interlocked.CompareExchange(ref fault, code, null);
        internal bool TasksSettled => (DeliveryTask?.IsCompleted ?? true) &&
            (OutputTask?.IsCompleted ?? true) && (ErrorTask?.IsCompleted ?? true);
    }
}
