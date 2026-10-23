"""Read-only byte verification of the pinned 2026-10-13 Docker backup.

No Docker/WSL command, mount, restore, copy, deletion, or output-file creation.
BackupDirectory remains historical provenance, not the actual archive location.
Run with python -B to avoid Python bytecode files.
"""
import argparse
import contextlib
import ctypes
import hashlib
import io
import json
import os
from pathlib import Path, PureWindowsPath
import sys
import unittest

ORIGINAL = PureWindowsPath(
    r"C:\Users\serge\Backups\Cashback-Docker20261013-115332-2d77bf55"
)
VHD = {
    "docker_data.vhdx": (7758413824, "576ee86abea0e3c9256ff72e6606c221413d750351959921a81ad51e1612aa2f"),
    "ext4.vhdx": (109051904, "959f691088557a05c1e0ad76bb7fe44c46280710602cd307428c281f2f4cba06"),
}
EXPECTED = dict(VHD, **{
    "backup-verification.json": (714, "c5d9dcc74cd9e72b0295b19a2319b030a2142a5995f1dbe5229edbab192ffd49")
})


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_names(names):
    require(len(names) == 3 and set(names) == set(EXPECTED), "Unexpected/missing/duplicate archive entries")


def validate_manifest(manifest):
    require(PureWindowsPath(manifest["BackupDirectory"]) == ORIGINAL, "Historical provenance differs")
    require(manifest["CreatedUtc"] == "2026-10-13T10:55:34.9163678Z", "Historical timestamp differs")
    require(manifest["ExclusiveReadOnlySourceHandles"] is True, "Source-handle evidence differs")
    require(manifest["DockerProcessesAbsent"] is True, "Stopped-Docker evidence differs")
    entries = manifest["Files"]
    require(len(entries) == 2 and {x["File"] for x in entries} == set(VHD), "Manifest file set differs")
    for item in entries:
        size, digest = VHD[item["File"]]
        require(item["Bytes"] == size and item["SHA256"] == digest, "Manifest size/digest differs")
        require(item["HashesMatch"] is True and item["SourceLengthAndWriteTimeUnchanged"] is True,
                "Historical verification evidence differs")


def check_stream(stream, size, digest, vhd=False):
    stream.seek(0)
    if vhd:
        require(stream.read(8) == b"vhdxfile", "VHDX file identifier missing")
        stream.seek(0)
    sha = hashlib.sha256()
    count = 0
    while chunk := stream.read(8 * 1024 * 1024):
        sha.update(chunk)
        count += len(chunk)
    require(count == size, "File size differs")
    require(sha.hexdigest() == digest, "SHA256 differs")
    stream.seek(0)
    return {"bytes": count, "sha256": sha.hexdigest()}


def regular_path(path, directory=False):
    st = path.lstat()
    require(not (getattr(st, "st_file_attributes", 0) & 0x400), "Reparse point rejected")
    import stat
    require(stat.S_ISDIR(st.st_mode) if directory else stat.S_ISREG(st.st_mode), "Unexpected entry type")
    return st


def safe_root(value):
    require(os.name == "nt", "Full archive verification requires Windows read locks")
    root = Path(os.path.abspath(value))
    for path in (root, *root.parents):
        regular_path(path, directory=True)
    local = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local")))
    banned = (local / "Docker", local / "Programs" / "DockerDesktop")
    for path in banned:
        # Lexical check after all archive ancestors passed reparse checks.
        require(not root.is_relative_to(path), "Active/installed Docker tree rejected")
    validate_names([item.name for item in root.iterdir()])
    return root


def open_locked(path):
    """GENERIC_READ + FILE_SHARE_READ: refuse concurrent writers or deletion."""
    import msvcrt
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateFileW.argtypes = (ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32,
                                  ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p)
    kernel.CreateFileW.restype = ctypes.c_void_p
    kernel.CloseHandle.argtypes = (ctypes.c_void_p,)
    handle = kernel.CreateFileW(str(path), 0x80000000, 1, None, 3, 0, None)
    if handle == ctypes.c_void_p(-1).value:
        raise OSError(ctypes.get_last_error(), "Unable to acquire read-only archive lock")
    try:
        fd = msvcrt.open_osfhandle(handle, os.O_RDONLY | os.O_BINARY)
    except BaseException:
        kernel.CloseHandle(handle)
        raise
    return os.fdopen(fd, "rb")


def fingerprint(st):
    return st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns


def verify_archive(value):
    root = safe_root(value)
    result = {}
    with contextlib.ExitStack() as stack:
        files = {}
        for name in EXPECTED:
            path = root / name
            before = regular_path(path)
            stream = stack.enter_context(open_locked(path))
            require(fingerprint(before) == fingerprint(os.fstat(stream.fileno())), "File identity changed")
            files[name] = stream, before
        # Hold all three locks until the entire set passes.
        for name, (size, digest) in EXPECTED.items():
            stream, before = files[name]
            result[name] = check_stream(stream, size, digest, vhd=name in VHD)
            require(fingerprint(before) == fingerprint(os.fstat(stream.fileno())), "File changed while hashing")
            require(fingerprint(before) == fingerprint(regular_path(root / name)), "Path identity changed")
        validate_manifest(json.load(files["backup-verification.json"][0]))
        validate_names([item.name for item in root.iterdir()])
    return {
        "status": "BYTE_INTEGRITY_VERIFIED_RESTORE_UNTESTED",
        "archive_directory": str(root), "files": result,
        "historical_manifest_unchanged": True, "read_only": True,
        "mount_or_restore_executed": False,
        "limitations": "SHA256 and file identifier only; no VHDX filesystem, database or boot validation",
    }


class VerifierTests(unittest.TestCase):
    def test_valid_stream(self):
        data = b"vhdxfile" + b"fixture"
        self.assertEqual(check_stream(io.BytesIO(data), len(data), hashlib.sha256(data).hexdigest(), True)["bytes"], len(data))

    def test_bad_hash(self):
        with self.assertRaises(ValueError):
            check_stream(io.BytesIO(b"x"), 1, "0" * 64)

    def test_truncated(self):
        with self.assertRaises(ValueError):
            check_stream(io.BytesIO(b"x"), 2, hashlib.sha256(b"x").hexdigest())

    def test_bad_vhd_identifier_even_with_matching_hash(self):
        with self.assertRaises(ValueError):
            check_stream(io.BytesIO(b"notavhdx"), 8, hashlib.sha256(b"notavhdx").hexdigest(), True)

    def test_missing_extra_and_duplicate_entries(self):
        for names in (list(EXPECTED)[:2], [*EXPECTED, "extra"], ["docker_data.vhdx"] * 3):
            with self.assertRaises(ValueError):
                validate_names(names)

    def test_exact_names(self):
        validate_names(list(EXPECTED))

    def fixture(self):
        return {"BackupDirectory": str(ORIGINAL), "CreatedUtc": "2026-10-13T10:55:34.9163678Z",
                "ExclusiveReadOnlySourceHandles": True, "DockerProcessesAbsent": True,
                "Files": [{"File": name, "Bytes": size, "SHA256": digest, "HashesMatch": True,
                           "SourceLengthAndWriteTimeUnchanged": True} for name, (size, digest) in VHD.items()]}

    def test_manifest_provenance_is_not_relocated(self):
        validate_manifest(self.fixture())  # Actual directory deliberately not compared to BackupDirectory.
        fixture = self.fixture()
        fixture["BackupDirectory"] = r"D:\rewritten"
        with self.assertRaises(ValueError):
            validate_manifest(fixture)

    def test_manifest_tampering(self):
        fixture = self.fixture()
        fixture["Files"][0]["SHA256"] = "0" * 64
        with self.assertRaises(ValueError):
            validate_manifest(fixture)

    def test_read_error_propagates(self):
        class Broken(io.BytesIO):
            def read(self, size=-1):
                raise OSError("simulated read failure")
        with self.assertRaises(OSError):
            check_stream(Broken(), 0, hashlib.sha256(b"").hexdigest())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--archive-dir")
    group.add_argument("--self-test", action="store_true", help="Memory-only tests; no archive/files written")
    args = parser.parse_args()
    if args.self_test:
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(VerifierTests))
        return 0 if result.wasSuccessful() else 1
    try:
        print(json.dumps(verify_archive(args.archive_dir), indent=2))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        # Do not dump archive/manifest contents or arbitrary exception text.
        print(json.dumps({"status": "VERIFICATION_FAILED", "error_type": type(error).__name__,
                          "action": "STOP_PRESERVE_ORIGINALS"}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
