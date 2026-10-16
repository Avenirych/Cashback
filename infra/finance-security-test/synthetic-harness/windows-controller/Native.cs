using System.Runtime.InteropServices;

namespace Cashback.Synthetic.Controller;

internal static class Native
{
    internal const uint Inherit = 1, OverlappedFlag = 0x40000000,
        FirstInstance = 0x00080000, RejectRemote = 8,
        Suspended = 4, UnicodeEnvironment = 0x400,
        ExtendedStartup = 0x80000, NoWindow = 0x08000000,
        UseStdHandles = 0x100, WaitTimeout = 258, WaitFailed = uint.MaxValue;
    internal const int PipeConnected = 535, IoPending = 997, IoIncomplete = 996;
    internal static readonly IntPtr Invalid = new(-1);

    [StructLayout(LayoutKind.Sequential)]
    internal struct SecurityAttributes
    {
        internal uint Length;
        internal IntPtr Descriptor;
        internal int InheritHandle;
    }
    [StructLayout(LayoutKind.Sequential)]
    internal struct StartupInfo
    {
        internal uint Cb;
        internal IntPtr Reserved, Desktop, Title;
        internal uint X, Y, XSize, YSize, XCount, YCount, Fill, Flags;
        internal ushort ShowWindow, ReservedLength;
        internal IntPtr ReservedBytes, Stdin, Stdout, Stderr;
    }
    [StructLayout(LayoutKind.Sequential)]
    internal struct StartupInfoEx
    {
        internal StartupInfo Startup;
        internal IntPtr Attributes;
    }
    [StructLayout(LayoutKind.Sequential)]
    internal struct ProcessInformation
    {
        internal IntPtr Process, Thread;
        internal uint ProcessId, ThreadId;
    }
    [StructLayout(LayoutKind.Explicit, Size = 32)]
    internal struct Overlapped
    {
        [FieldOffset(0)] internal nuint Internal;
        [FieldOffset(8)] internal nuint InternalHigh;
        [FieldOffset(16)] internal uint Offset;
        [FieldOffset(20)] internal uint OffsetHigh;
        [FieldOffset(16)] internal IntPtr Pointer;
        [FieldOffset(24)] internal IntPtr Event;
    }

    // Declarations correspond to SDK 10.0.26100.0. No native calls at type load.
    [DllImport("kernel32.dll", EntryPoint = "CreateProcessW", ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool CreateProcess(
        IntPtr application, IntPtr command, IntPtr processSecurity, IntPtr threadSecurity,
        [MarshalAs(UnmanagedType.Bool)] bool inheritHandles, uint flags,
        IntPtr environment, IntPtr directory, ref StartupInfoEx startup,
        out ProcessInformation information);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool InitializeProcThreadAttributeList(IntPtr list, uint count, uint flags, ref nuint size);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, nuint attribute,
        IntPtr value, nuint size, IntPtr previous, IntPtr returnedSize);
    [DllImport("kernel32.dll")]
    internal static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll", EntryPoint = "CreateNamedPipeW", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    internal static extern IntPtr CreateNamedPipe(string name, uint openMode, uint pipeMode,
        uint instances, uint outputSize, uint inputSize, uint timeout, ref SecurityAttributes security);
    [DllImport("kernel32.dll", EntryPoint = "CreateFileW", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    internal static extern IntPtr CreateFile(string name, uint access, uint share,
        ref SecurityAttributes security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool ConnectNamedPipe(IntPtr pipe, IntPtr overlapped);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool GetOverlappedResult(IntPtr file, IntPtr overlapped, out uint bytes,
        [MarshalAs(UnmanagedType.Bool)] bool wait);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool CancelIoEx(IntPtr file, IntPtr overlapped);
    [DllImport("kernel32.dll", EntryPoint = "CreateEventW", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    internal static extern IntPtr CreateEvent(IntPtr security, [MarshalAs(UnmanagedType.Bool)] bool manual,
        [MarshalAs(UnmanagedType.Bool)] bool initial, string? name);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool GetNamedPipeInfo(IntPtr pipe, out uint flags, out uint output, out uint input, out uint instances);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool GetNamedPipeClientProcessId(IntPtr pipe, out uint id);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool GetNamedPipeServerProcessId(IntPtr pipe, out uint id);
    [DllImport("kernel32.dll")]
    internal static extern uint GetCurrentProcessId();
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool GetHandleInformation(IntPtr handle, out uint flags);
    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool CloseHandle(IntPtr handle);
    [DllImport("advapi32.dll", EntryPoint = "ConvertStringSecurityDescriptorToSecurityDescriptorW",
        CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static extern bool ConvertSecurityDescriptor(string text, uint revision, out IntPtr descriptor, out uint size);
    // GetSecurityInfo returns a Win32 status directly, not a BOOL/last-error result.
    // SE_FILE_OBJECT = 1 also covers named pipes; DACL_SECURITY_INFORMATION = 4.
    [DllImport("advapi32.dll", ExactSpelling = true)]
    internal static extern uint GetSecurityInfo(IntPtr handle, uint objectType, uint information,
        out IntPtr owner, out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);
    [DllImport("advapi32.dll", ExactSpelling = true)]
    internal static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern IntPtr LocalFree(IntPtr memory);

    internal static void Require(bool condition, string code)
    {
        if (!condition) throw new PolicyFailure(code);
    }
    internal static void ValidateLayouts()
    {
        Require(OperatingSystem.IsWindows() && Environment.Is64BitProcess, "PLATFORM_MISMATCH");
        Require(RuntimeInformation.ProcessArchitecture == Architecture.X64, "PROCESS_ARCHITECTURE_MISMATCH");
        Require(IntPtr.Size == 8 && UIntPtr.Size == 8, "ABI_POINTER_SIZE_MISMATCH");
        Size<SecurityAttributes>(24); Offset<SecurityAttributes>(nameof(SecurityAttributes.Length), 0);
        Offset<SecurityAttributes>(nameof(SecurityAttributes.Descriptor), 8);
        Offset<SecurityAttributes>(nameof(SecurityAttributes.InheritHandle), 16);
        Size<ProcessInformation>(24); Offset<ProcessInformation>(nameof(ProcessInformation.Process), 0);
        Offset<ProcessInformation>(nameof(ProcessInformation.Thread), 8);
        Offset<ProcessInformation>(nameof(ProcessInformation.ProcessId), 16);
        Offset<ProcessInformation>(nameof(ProcessInformation.ThreadId), 20);
        Size<StartupInfo>(104); Offset<StartupInfo>(nameof(StartupInfo.Cb), 0);
        Offset<StartupInfo>(nameof(StartupInfo.Reserved), 8); Offset<StartupInfo>(nameof(StartupInfo.Desktop), 16);
        Offset<StartupInfo>(nameof(StartupInfo.Title), 24); Offset<StartupInfo>(nameof(StartupInfo.X), 32);
        Offset<StartupInfo>(nameof(StartupInfo.Y), 36); Offset<StartupInfo>(nameof(StartupInfo.XSize), 40);
        Offset<StartupInfo>(nameof(StartupInfo.YSize), 44); Offset<StartupInfo>(nameof(StartupInfo.XCount), 48);
        Offset<StartupInfo>(nameof(StartupInfo.YCount), 52); Offset<StartupInfo>(nameof(StartupInfo.Fill), 56);
        Offset<StartupInfo>(nameof(StartupInfo.Flags), 60);
        Offset<StartupInfo>(nameof(StartupInfo.ShowWindow), 64); Offset<StartupInfo>(nameof(StartupInfo.ReservedLength), 66);
        Offset<StartupInfo>(nameof(StartupInfo.ReservedBytes), 72); Offset<StartupInfo>(nameof(StartupInfo.Stdin), 80);
        Offset<StartupInfo>(nameof(StartupInfo.Stdout), 88); Offset<StartupInfo>(nameof(StartupInfo.Stderr), 96);
        Size<StartupInfoEx>(112); Offset<StartupInfoEx>(nameof(StartupInfoEx.Startup), 0);
        Offset<StartupInfoEx>(nameof(StartupInfoEx.Attributes), 104);
        Size<Overlapped>(32); Offset<Overlapped>(nameof(Overlapped.Internal), 0);
        Offset<Overlapped>(nameof(Overlapped.InternalHigh), 8); Offset<Overlapped>(nameof(Overlapped.Offset), 16);
        Offset<Overlapped>(nameof(Overlapped.OffsetHigh), 20); Offset<Overlapped>(nameof(Overlapped.Pointer), 16);
        Offset<Overlapped>(nameof(Overlapped.Event), 24);
    }
    private static void Size<T>(int expected) where T : struct =>
        Require(Marshal.SizeOf<T>() == expected, "ABI_LAYOUT_MISMATCH");
    private static void Offset<T>(string field, int expected) where T : struct =>
        Require(Marshal.OffsetOf<T>(field).ToInt64() == expected, "ABI_LAYOUT_MISMATCH");
}

internal sealed class PolicyFailure(string code) : Exception
{
    internal string Code { get; } = code;
}
