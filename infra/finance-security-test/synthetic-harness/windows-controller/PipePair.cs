using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;

namespace Cashback.Synthetic.Controller;

internal sealed class PipePair
{
    internal const string OwnerSid = "S-1-5-21-3121025797-3907938778-2277447460-1001";
    internal const string Sddl = "D:P(A;;0x00120087;;;" + OwnerSid + ")";
    internal IntPtr Parent { get; private set; }
    internal IntPtr Child { get; private set; }
    internal FileStream? Stream { get; private set; }
    private readonly bool parentWrites;
    private IntPtr connectMemory, connectEvent;
    private bool connectPending;
    private bool cancellationFailed;
    private readonly object parentHandleSync = new();

    internal PipePair(bool writes) { parentWrites = writes; }

    internal void Open()
    {
        IntPtr descriptor = IntPtr.Zero;
        try
        {
            bool converted = Native.ConvertSecurityDescriptor(Sddl, 1, out IntPtr convertedDescriptor, out _);
            Native.Require(converted, "DACL_CONVERSION_FAILED");
            descriptor = convertedDescriptor;
            Native.Require(descriptor != IntPtr.Zero, "DACL_CONVERSION_FAILED");
            var security = new Native.SecurityAttributes {
                Length = 24, Descriptor = descriptor, InheritHandle = 0 };
            string name = @"\\.\pipe\cashback-parent-" + Guid.NewGuid().ToString("N");
            // READ_CONTROL requested explicitly; no broad ACL fallback.
            Parent = Native.CreateNamedPipe(name,
                (parentWrites ? 2u : 1u) | Native.OverlappedFlag | Native.FirstInstance | 0x20000,
                Native.RejectRemote, 1, 4096, 4096, 0, ref security);
            Native.Require(Parent != IntPtr.Zero && Parent != Native.Invalid, "PIPE_SERVER_CREATE_FAILED");
            VerifyActualDacl();
            Child = Native.CreateFile(name, parentWrites ? 0x100081u : 0x100082u,
                0, ref security, 3, 0, IntPtr.Zero);
            Native.Require(Child != IntPtr.Zero && Child != Native.Invalid, "PIPE_CLIENT_OPEN_FAILED");
            Connect();
            Native.Require(Native.GetNamedPipeInfo(Parent, out uint serverFlags, out _, out _, out uint instances) &&
                (serverFlags & 1) == 1 && (serverFlags & 4) == 0 && instances == 1, "PIPE_SERVER_PROPERTIES_INVALID");
            Native.Require(Native.GetNamedPipeInfo(Child, out uint clientFlags, out _, out _, out _) &&
                (clientFlags & 1) == 0 && (clientFlags & 4) == 0, "PIPE_CLIENT_PROPERTIES_INVALID");
            uint own = Native.GetCurrentProcessId();
            Native.Require(Native.GetNamedPipeClientProcessId(Parent, out uint client) && client == own &&
                Native.GetNamedPipeServerProcessId(Child, out uint server) && server == own, "PIPE_IDENTITY_UNCONFIRMED");
            VerifyActualDacl();
            CheckInheritance(Parent, false); CheckInheritance(Child, false);
        }
        finally
        {
            if (descriptor != IntPtr.Zero)
                Native.Require(Native.LocalFree(descriptor) == IntPtr.Zero, "DESCRIPTOR_FREE_FAILED");
        }
    }
    private void Connect()
    {
        connectEvent = Native.CreateEvent(IntPtr.Zero, true, false, null);
        Native.Require(connectEvent != IntPtr.Zero, "CONNECT_EVENT_FAILED");
        connectMemory = Marshal.AllocHGlobal(32);
        Marshal.StructureToPtr(new Native.Overlapped { Event = connectEvent }, connectMemory, false);
        if (Native.ConnectNamedPipe(Parent, connectMemory)) return;
        int error = Marshal.GetLastPInvokeError();
        if (error == Native.PipeConnected) return;
        Native.Require(error == Native.IoPending, "PIPE_CONNECT_FAILED");
        connectPending = true;
        uint wait = Native.WaitForSingleObject(connectEvent, 1000);
        if (wait == 0 && Native.GetOverlappedResult(Parent, connectMemory, out _, false))
        { connectPending = false; return; }
        throw new PolicyFailure("PIPE_CONNECT_UNCONFIRMED");
    }
    internal void MakeChildInheritable()
    {
        VerifyActualDacl();
        CheckInheritance(Parent, false);
        Native.Require(Native.SetHandleInformation(Child, Native.Inherit, Native.Inherit), "INHERITANCE_SET_FAILED");
        CheckInheritance(Child, true);
    }
    internal static void CheckInheritance(IntPtr handle, bool expected)
    {
        Native.Require(handle != IntPtr.Zero && handle != Native.Invalid &&
            Native.GetHandleInformation(handle, out uint flags) && ((flags & 1) != 0) == expected &&
            (flags & 2) == 0, "HANDLE_FLAGS_INVALID");
    }
    internal void CloseChild()
    {
        if (Child == IntPtr.Zero || Child == Native.Invalid) return;
        // Remove the temporary inheritance window even if subsequent CloseHandle fails.
        bool cleared = Native.SetHandleInformation(Child, Native.Inherit, 0);
        bool closed = Native.CloseHandle(Child);
        if (closed) Child = IntPtr.Zero;
        Native.Require(cleared && closed, "CHILD_HANDLE_CLOSE_FAILED");
    }
    private void VerifyActualDacl()
    {
        uint status = Native.GetSecurityInfo(Parent, 1, 4, out _, out _, out IntPtr dacl,
            out _, out IntPtr actualDescriptor);
        Native.Require(status == 0, "DACL_QUERY_FAILED");
        try
        {
            Native.Require(actualDescriptor != IntPtr.Zero && dacl != IntPtr.Zero, "DACL_MISSING");
            uint length = Native.GetSecurityDescriptorLength(actualDescriptor);
            Native.Require(length >= 20 && length <= 4096, "DACL_DESCRIPTOR_SIZE_INVALID");
            byte[] binary = new byte[checked((int)length)];
            Marshal.Copy(actualDescriptor, binary, 0, binary.Length);
            var actual = new RawSecurityDescriptor(binary, 0);
            ControlFlags required = ControlFlags.DiscretionaryAclPresent | ControlFlags.DiscretionaryAclProtected;
            ControlFlags forbidden = ControlFlags.DiscretionaryAclDefaulted |
                ControlFlags.DiscretionaryAclAutoInherited | ControlFlags.DiscretionaryAclAutoInheritRequired;
            Native.Require((actual.ControlFlags & required) == required &&
                (actual.ControlFlags & forbidden) == 0 && actual.BinaryLength == binary.Length,
                "DACL_CONTROL_MISMATCH");
            RawAcl? acl = actual.DiscretionaryAcl;
            if (acl == null || acl.Count != 1 || acl[0] is not CommonAce ace)
                throw new PolicyFailure("DACL_ACE_MISMATCH");
            Native.Require(ace.AceType == AceType.AccessAllowed && ace.AceFlags == AceFlags.None &&
                !ace.IsCallback && ace.OpaqueLength == 0 && ace.AccessMask == 0x00120087 &&
                ace.SecurityIdentifier.Equals(new SecurityIdentifier(OwnerSid)), "DACL_ACE_MISMATCH");
        }
        catch (PolicyFailure) { throw; }
        catch { throw new PolicyFailure("DACL_VALIDATION_FAILED"); }
        finally
        {
            if (actualDescriptor != IntPtr.Zero)
                Native.Require(Native.LocalFree(actualDescriptor) == IntPtr.Zero, "DACL_QUERY_FREE_FAILED");
        }
    }
    private void Close(bool refChild)
    {
        lock (parentHandleSync)
        {
            IntPtr value = refChild ? Child : Parent;
            if (value == IntPtr.Zero || value == Native.Invalid) return;
            Native.Require(Native.CloseHandle(value), "HANDLE_CLOSE_FAILED");
            if (refChild) Child = IntPtr.Zero; else Parent = IntPtr.Zero;
        }
    }
    internal void AttachStream()
    {
        Native.Require(!connectPending && Parent != IntPtr.Zero && Stream == null, "PIPE_TRANSFER_INVALID");
        // Ownership stays with PipePair. FileStream uses a non-owning SafeFileHandle.
        var borrowed = new SafeFileHandle(Parent, ownsHandle: false);
        try { Stream = new FileStream(borrowed, parentWrites ? FileAccess.Write : FileAccess.Read, 4096, isAsync: true); }
        catch { borrowed.Dispose(); throw new PolicyFailure("PIPE_STREAM_ATTACH_FAILED"); }
    }
    internal void CompleteInput()
    {
        if (!parentWrites || Stream == null) throw new PolicyFailure("STDIN_STREAM_INVALID");
        Stream.Dispose();
        Stream = null;
        // The FileStream wrapper is non-owning. Close the native writer too,
        // otherwise the child cannot observe EOF.
        Close(false);
    }
    internal bool NeedsRetention => connectPending || Parent != IntPtr.Zero && Parent != Native.Invalid ||
        Child != IntPtr.Zero && Child != Native.Invalid || connectEvent != IntPtr.Zero || connectMemory != IntPtr.Zero;
    internal bool CloseResources(bool ioSettled)
    {
        bool ok = !cancellationFailed;
        // Independent from parent I/O: never retain an inheritable child endpoint
        // merely because parent read/write completion is unconfirmed.
        try { CloseChild(); } catch { ok = false; }
        if (connectPending)
        {
            if (!CancelNative(connectMemory)) ok = false;
            uint wait = Native.WaitForSingleObject(connectEvent, 1000);
            if (wait == 0)
            {
                bool success = Native.GetOverlappedResult(Parent, connectMemory, out _, false);
                int error = success ? 0 : Marshal.GetLastPInvokeError();
                if (success || error == 995) connectPending = false;
            }
        }
        // Deliberately retain native operation memory if completion is unconfirmed.
        if (connectPending || !ioSettled) return false;
        // A failed Dispose may leave implementation-owned I/O unresolved.
        // Retain the native endpoint rather than claiming safe close/reclamation.
        try { Stream?.Dispose(); Stream = null; } catch { return false; }
        try { Close(false); } catch { ok = false; }
        if (connectMemory != IntPtr.Zero) { Marshal.FreeHGlobal(connectMemory); connectMemory = IntPtr.Zero; }
        if (connectEvent != IntPtr.Zero)
        {
            if (Native.CloseHandle(connectEvent)) connectEvent = IntPtr.Zero;
            else ok = false;
        }
        return ok;
    }
    private bool CancelNative(IntPtr operation)
    {
        lock (parentHandleSync)
        {
            if (Parent == IntPtr.Zero || Parent == Native.Invalid) return true;
            if (Native.CancelIoEx(Parent, operation)) return true;
            // ERROR_NOT_FOUND: no matching outstanding request; NOT completion evidence.
            if (Marshal.GetLastPInvokeError() == 1168) return true;
            cancellationFailed = true;
            return false;
        }
    }
    internal bool RequestIoCancellation() => CancelNative(IntPtr.Zero);
}
