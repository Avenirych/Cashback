"""NEW RECONSTRUCTION, not the recovered original G001-G011 implementation.

Source implementation only. Execution remains BLOCKED. No explicit import-time
file reads, audit-hook installation, sys.path changes, threads or test execution.
The compatibility method install_original_guard() installs a NEW hook only after
separate reconstruction approval; its name is not an equivalence assertion.
"""
import hashlib
import importlib.abc
import importlib.machinery
import importlib.util
import os
import sys
import threading
import types
from contextlib import contextmanager
from pathlib import Path
from types import MappingProxyType

RECONSTRUCTION = 'NEW RECONSTRUCTION'
RULE_STATUS = MappingProxyType({('G%03d' % n): 'UNVERIFIED' for n in range(1, 12)})
# Neither source review nor a matching candidate hash changes this gate.
_RECONSTRUCTION_REVIEW_APPROVED = False
# Exact bytes of all local executable dependencies need a separately approved
# manifest. Empty intentionally: no invented/current hash becomes owner approval.
_APPROVED_SOURCE_HASHES = MappingProxyType({})

_ROOT = r'C:\Users\serge\cashback+\infra\finance-security-test\synthetic-harness'
_LIB = r'C:\Python314\Lib'
_DLL = r'C:\Python314\DLLs'
_EXE = r'C:\Python314\python.exe'
_PREFIX = r'C:\Python314'
_MODULES = MappingProxyType({name: name + '.py' for name in (
    'admission', 'collector', 'contract', 'controller', 'integration', 'oracles',
    'protocol', 'runner_gate', 'scanner', 'targets', 'worker',
    'test_admission_unit', 'test_bounded_stream_unit', 'test_oracles_unit',
    'test_unit', 'test_wiring_unit', 'test_worker_evidence_unit',
)})
_LOCAL_FILES = frozenset(_MODULES.values()) | {'parent_test_adapter.py'}
_PARENT_LABELS = MappingProxyType({
    '<approved-parent-snapshot:common.py>':
        (7558, '634C1FBCDEE3D5F123901881539A2193B7899CD2053502A12B3152685E3231C0'),
    '<approved-parent-snapshot:provision.py>':
        (1666, 'CB9833D4505874CBA4276A74A9AAD268611B5EBED6DDB101882925547DF82A96'),
})
_RESTRICTED = frozenset({'psycopg', 'psycopg_binary', 'psycopg_pool', 'docker',
                         'ctypes', '_ctypes', '_ctypes_test'})
_PHASES = frozenset({'initialization', 'module_import', 'test_scope'})
_MUTATIONS = frozenset({
    'os.remove', 'os.rename', 'os.rmdir', 'os.mkdir', 'os.link', 'os.symlink',
    'os.truncate', 'os.chmod', 'os.chown', 'os.utime', 'os.chdir',
    'os.putenv', 'os.unsetenv', 'shutil.copyfile', 'shutil.copymode',
    'shutil.copystat', 'shutil.rmtree',
})
_SPAWN = frozenset({'os.system', 'os.posix_spawn', 'os.spawn', 'os.startfile',
                    'os.exec', 'os.fork', 'os.forkpty'})
_RULES = MappingProxyType({
    'G001': ('PROCESS_POLICY', 'process', 'PROCESS_CREATION_DENIED'),
    'G002': ('NETWORK_POLICY', 'socket', 'NETWORK_DENIED'),
    'G003': ('DATABASE_POLICY', 'sqlite3', 'DATABASE_DENIED'),
    'G004': ('MUTATION_POLICY', 'filesystem', 'MUTATION_DENIED'),
    'G005': ('IMPORT_POLICY', 'import', 'RESTRICTED_IMPORT'),
    'G006': ('FILE_WRITE_POLICY', 'open', 'WRITE_MODE_DENIED'),
    'G007': ('FILE_READ_POLICY', 'open', 'SOURCE_EXTENSION_DENIED'),
    'G008': ('FILE_WRITE_POLICY', 'open', 'WRITE_FLAGS_DENIED'),
    'G009': ('FILE_READ_POLICY', 'open', 'FILE_TARGET_INVALID'),
    'G010': ('FILE_READ_POLICY', 'open', 'FILE_ROOT_DENIED'),
    'G011': ('CONTEXT_POLICY', 'bootstrap', 'CONTEXT_OR_POLICY_UNVERIFIED'),
})


class _SourceLoader(importlib.abc.Loader):
    def __init__(self, bootstrap, name, filename):
        self._bootstrap, self._name, self._filename = bootstrap, name, filename

    def create_module(self, spec):
        return None

    def exec_module(self, module):
        b = self._bootstrap
        if (module.__name__ != self._name or self._name in b._loaded_local
                or module.__spec__.loader is not self):
            b._stop('G011')
        path = b._root / self._filename
        raw = b._source_bytes(self._filename)
        # File bytes are read once and hashed before compile/exec. No .pyc APIs.
        with b._compilation(str(path), raw):
            code = compile(raw, str(path), 'exec', dont_inherit=True, optimize=0)
            exec(code, module.__dict__)
        if self._name == 'targets':
            # The original disk-reading parent loader is NEVER callable here.
            module.load_targets = b.boundary_stop
        b._loaded_local[self._name] = module


class _SourceFinder(importlib.abc.MetaPathFinder):
    def __init__(self, bootstrap):
        self._bootstrap = bootstrap

    def find_spec(self, fullname, path=None, target=None):
        b = self._bootstrap
        if fullname not in _MODULES:
            return None
        if path is not None or target is not None or fullname in b._loaded_local:
            b._stop('G011')
        loader = _SourceLoader(b, fullname, _MODULES[fullname])
        spec = importlib.machinery.ModuleSpec(fullname, loader, origin=str(b._root / _MODULES[fullname]))
        spec.has_location = True
        return spec


class SecurityBootstrap:
    """Trusted bootstrap object; never created from CBPT1/test configuration."""
    def __init__(self):
        self._phase = 'initialization'
        self._installed = self._verified = False
        self._stopping = False
        self._probe = object()
        self._probe_seen = False
        self._owner_thread = threading.get_ident()
        self._active = None
        self._compile_scope = None
        self._compile_stack = ()
        self._root = None
        self._lib = self._dll = None
        self._loaded_local = {}
        self._adapter = None
        self._finder = None
        self._runtime_hook = None

    def _stop(self, event='G011'):
        if self._stopping:
            os._exit(125)
        self._stopping = True
        event = event if event in _RULES else 'G011'
        category, api, rule = _RULES[event]
        phase = self._phase if self._phase in _PHASES else 'initialization'
        # All values come from closed constants. No target, args, traceback,
        # environment, credentials or exception text enter the diagnostic.
        message = ('STOP_EXTERNAL_ACTION_POLICY|event_id=%s|category=%s|api=%s|phase=%s|rule=%s\n'
                   % (event, category, api, phase, rule)).encode('ascii')
        try:
            if len(message) <= 256:
                sys.stderr.buffer.write(message)
                sys.stderr.buffer.flush()
        finally:
            os._exit(125)

    def boundary_stop(self, *_args, **_kwargs):
        self._stop('G011')

    @staticmethod
    def _inside(path, root):
        return path == root or root in path.parents

    def _canonical(self, text, must_exist=True):
        if type(text) is not str or not text or not Path(text).is_absolute():
            self._stop('G010')
        path = Path(text).resolve(strict=must_exist)
        if os.path.normcase(str(path)) != os.path.normcase(os.path.normpath(text)):
            self._stop('G010')
        return path

    def install_original_guard(self):
        """Compatibility name only: NEW RECONSTRUCTION, all original rules UNVERIFIED."""
        if (_RECONSTRUCTION_REVIEW_APPROVED is not True or self._installed
                or threading.get_ident() != self._owner_thread):
            self._stop('G011')
        self._root = self._canonical(_ROOT)
        self._lib, self._dll = self._canonical(_LIB), self._canonical(_DLL)
        self._installed = True
        sys.addaudithook(self._audit)
        sys.audit('cashback.reconstruction.probe', self._probe)
        if not self._probe_seen:
            self._stop('G011')
        # Probe confirms THIS hook saw one event. It does NOT enumerate or prove
        # absence of existing Python/native hooks or privileged monitoring.

    def _audit(self, event, args):
        try:
            if self._phase not in _PHASES:
                self._stop('G011')
            if event == 'cashback.reconstruction.probe':
                if args != (self._probe,) or self._probe_seen:
                    self._stop('G011')
                self._probe_seen = True
            elif event.startswith('subprocess.') or event in _SPAWN:
                self._stop('G001')
            elif event.startswith('socket.'):
                self._stop('G002')
            elif event.startswith('sqlite3.'):
                self._stop('G003')
            elif event in _MUTATIONS:
                self._stop('G004')
            elif event == 'import':
                if not args or type(args[0]) is not str:
                    self._stop('G005')
                if args[0].split('.')[0] in _RESTRICTED:
                    self._stop('G005')
            elif event == 'open':
                self._check_open(args)
            elif event == 'sys.addaudithook':
                self._stop('G011')
            elif event == 'compile':
                self._check_compile(args)
            elif event == 'exec':
                self._check_exec(args)
        except BaseException:
            self._stop('G011')

    def _check_open(self, args):
        if len(args) != 3:
            self._stop('G009')
        target, mode, flags = args
        if mode is not None and (type(mode) is not str or any(c in mode for c in 'wax+')):
            self._stop('G006')
        write_flags = (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND
                       | getattr(os, 'O_TEMPORARY', 0))  # Windows delete-on-close is a mutation.
        if type(flags) is not int or flags & write_flags:
            self._stop('G008')
        if type(target) is not str:
            self._stop('G009')
        # No repr/fspath callback on an unknown target, and no descriptor opens.
        # A missing runtime cache file may legitimately produce FileNotFoundError
        # and fall back to runtime .py. This does NOT permit local .pyc access.
        path = self._canonical(target, must_exist=False)
        if self._inside(path, self._root):
            if path.suffix.lower() not in ('.py', '.md'):
                self._stop('G007')
        elif not any(self._inside(path, root) for root in (self._lib, self._dll)):
            self._stop('G010')

    def _check_compile(self, args):
        if len(args) != 2 or type(args[1]) is not str:
            self._stop('G011')
        raw, filename = args
        if filename in _PARENT_LABELS or filename == '<approved-parent-snapshot>':
            if self._active is None and filename != '<approved-parent-snapshot>':
                self._stop('G011')
            candidates = (_PARENT_LABELS[filename],) if filename in _PARENT_LABELS else tuple(_PARENT_LABELS.values())
            if type(raw) is not bytes or not any(len(raw) == n and hashlib.sha256(raw).hexdigest().upper() == h
                                                  for n, h in candidates):
                self._stop('G011')
            return
        if self._compile_scope is not None and filename == self._compile_scope[0]:
            if type(raw) is not bytes or raw != self._compile_scope[1]:
                self._stop('G011')
            return
        # Runtime modules are trusted only within the canonical stdlib roots.
        path = self._canonical(filename)
        if not any(self._inside(path, root) for root in (self._lib, self._dll)):
            self._stop('G011')

    def _check_exec(self, args):
        if len(args) != 1 or not isinstance(args[0], types.CodeType):
            self._stop('G011')
        filename = args[0].co_filename
        if filename in _PARENT_LABELS:
            if self._active is None or threading.get_ident() != self._owner_thread:
                self._stop('G011')
            return
        if self._compile_scope is not None and filename == self._compile_scope[0]:
            return
        if filename.startswith('<frozen ') and filename.endswith('>'):
            return
        path = self._canonical(filename)
        if not any(self._inside(path, root) for root in (self._lib, self._dll)):
            self._stop('G011')

    def _check_modules(self):
        main = sys.modules.get('__main__')
        for name, module in tuple(sys.modules.items()):
            if not isinstance(module, types.ModuleType):
                self._stop('G011')
            if name.split('.')[0] in _RESTRICTED:
                self._stop('G005')
            # sys.modules is consulted before meta_path. A preloaded reserved
            # name must not bypass our fixed source-only loader, even if its
            # reported origin lies inside the trusted runtime directories.
            if name in _MODULES or name == 'parent_test_adapter':
                if module is not self._loaded_local.get(name):
                    self._stop('G011')
            spec = vars(module).get('__spec__')
            origin = getattr(spec, 'origin', None)
            if origin in ('built-in', 'frozen'):
                pass
            elif (name == '__main__' and module is main and spec is None
                  and vars(module).get('__file__') is None):
                pass  # Only the actual -c main module is a known special case.
            elif module is self._loaded_local.get(name) or module is self._adapter:
                pass
            else:
                path = self._canonical(origin)
                if not any(self._inside(path, root) for root in (self._lib, self._dll)):
                    self._stop('G011')
            package_path = vars(module).get('__path__')
            if package_path is not None:
                # Accept bounded concrete paths and the known CPython namespace
                # cache without triggering its path recomputation/iteration.
                if type(package_path) not in (list, tuple):
                    kind = type(package_path)
                    if kind.__module__ != '_frozen_importlib_external' or kind.__name__ != '_NamespacePath':
                        self._stop('G011')
                    package_path = vars(package_path).get('_path')
                if type(package_path) not in (list, tuple) or not 1 <= len(package_path) <= 64:
                    self._stop('G011')
                for entry in package_path:
                    if not self._inside(self._canonical(entry), self._lib):
                        self._stop('G011')

    def verify_runtime_and_source_only_imports(self):
        if not self._installed or not self._probe_seen or self._verified:
            self._stop('G011')
        if (os.name != 'nt' or sys.version_info[:3] != (3, 14, 7)
                or self._canonical(sys.executable) != self._canonical(_EXE)
                or self._canonical(sys.prefix) != self._canonical(_PREFIX)
                or self._canonical(sys.base_prefix) != self._canonical(_PREFIX)
                or not sys.flags.dont_write_bytecode or not sys.flags.no_site or not sys.flags.no_user_site):
            self._stop('G011')
        # Controller deliberately uses the trusted Python installation as cwd.
        # It must not become a sys.path entry; it is not the project/source root.
        if Path.cwd().resolve(strict=True) != self._canonical(_PREFIX):
            self._stop('G011')
        protected = (self._root, self._root.parent, self._root.parent.parent.parent)
        for runtime in (self._lib, self._dll):
            for forbidden in protected:
                if self._inside(runtime, forbidden) or self._inside(forbidden, runtime):
                    self._stop('G011')
        if set(_APPROVED_SOURCE_HASHES) != _LOCAL_FILES:
            self._stop('G011')
        if any(type(v) is not str or len(v) != 64 or any(c not in '0123456789ABCDEF' for c in v)
               for v in _APPROVED_SOURCE_HASHES.values()):
            self._stop('G011')
        self._check_modules()
        if tuple(sys.meta_path) != (importlib.machinery.BuiltinImporter,
                                    importlib.machinery.FrozenImporter,
                                    importlib.machinery.PathFinder):
            self._stop('G011')
        self._finder = _SourceFinder(self)
        self._runtime_hook = importlib.machinery.FileFinder.path_hook(
            (importlib.machinery.ExtensionFileLoader, importlib.machinery.EXTENSION_SUFFIXES),
            (importlib.machinery.SourceFileLoader, importlib.machinery.SOURCE_SUFFIXES))
        sys.path[:] = [str(self._lib), str(self._dll)]
        sys.path_hooks[:] = [self._runtime_hook]
        sys.path_importer_cache.clear()
        sys.meta_path[:] = [self._finder, importlib.machinery.BuiltinImporter,
                           importlib.machinery.FrozenImporter, importlib.machinery.PathFinder]
        self._verified = True
        self._verify_import_state()

    def _verify_import_state(self):
        if (not self._verified or sys.path != [str(self._lib), str(self._dll)]
                or sys.path_hooks != [self._runtime_hook]
                or sys.meta_path != [self._finder, importlib.machinery.BuiltinImporter,
                                    importlib.machinery.FrozenImporter, importlib.machinery.PathFinder]):
            self._stop('G011')
        for key, finder in tuple(sys.path_importer_cache.items()):
            path = self._canonical(key)
            if (not any(self._inside(path, root) for root in (self._lib, self._dll))
                    or finder is not None and type(finder) is not importlib.machinery.FileFinder):
                self._stop('G011')
        self._check_modules()

    def _source_bytes(self, filename):
        if not self._verified or filename not in _LOCAL_FILES:
            self._stop('G011')
        path = self._canonical(str(self._root / filename))
        if path.parent != self._root:
            self._stop('G010')
        with open(path, 'rb') as stream:
            raw = stream.read(262145)
        if len(raw) > 262144 or hashlib.sha256(raw).hexdigest().upper() != _APPROVED_SOURCE_HASHES[filename]:
            self._stop('G011')
        return raw

    @contextmanager
    def _compilation(self, filename, raw):
        if (len(self._compile_stack) >= len(_LOCAL_FILES)
                or filename in self._compile_stack):
            self._stop('G011')
        old_phase = self._phase
        previous = self._compile_scope
        stack = self._compile_stack
        scope = (filename, raw)
        self._phase = 'module_import'
        self._compile_scope = scope
        self._compile_stack = stack + (filename,)
        try:
            yield
        finally:
            if self._compile_scope is not scope or self._compile_stack != stack + (filename,):
                self._stop('G011')
            self._compile_scope = previous
            self._compile_stack = stack
            self._phase = old_phase

    def load_parent_adapter(self):
        self._verify_import_state()
        if self._adapter is not None or 'parent_test_adapter' in sys.modules:
            self._stop('G011')
        loader = _SourceLoader(self, 'parent_test_adapter', 'parent_test_adapter.py')
        spec = importlib.machinery.ModuleSpec('parent_test_adapter', loader,
            origin=str(self._root / 'parent_test_adapter.py'))
        spec.has_location = True
        module = importlib.util.module_from_spec(spec)
        loader.exec_module(module)
        self._adapter = module
        return module

    def load_test_unit(self):
        self._verify_import_state()
        if 'test_unit' in sys.modules:
            self._stop('G011')
        module = importlib.import_module('test_unit')
        if module is not self._loaded_local.get('test_unit'):
            self._stop('G011')
        self._verify_import_state()
        return module

    @contextmanager
    def test_scope(self, test_id):
        self._verify_import_state()
        if (self._active is not None or self._adapter is None
                or test_id not in self._adapter.TEST_IDS
                or threading.get_ident() != self._owner_thread):
            self._stop('G011')
        context = (test_id, object())
        self._active = context
        self._phase = 'test_scope'
        try:
            yield  # Token is neither yielded nor passed to mocks/doubles.
        finally:
            intact = self._active is context and threading.get_ident() == self._owner_thread
            self._active = None
            self._phase = 'initialization'
            if not intact:
                self._stop('G011')
            self._verify_import_state()
