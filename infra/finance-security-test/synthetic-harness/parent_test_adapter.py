"""Source-only parent adapter. No entry point, file I/O, real Psycopg or DB.

Only a separately reviewed, guarded launcher may construct/use this adapter.
Neither hash equality nor a transport frame grants owner approval.
"""
import ast
import base64
import builtins
import hashlib
import re
import types
from contextlib import contextmanager
from types import MappingProxyType
from unittest.mock import Mock, patch

BASELINE = MappingProxyType({
    'common.py': (7558, '634C1FBCDEE3D5F123901881539A2193B7899CD2053502A12B3152685E3231C0'),
    'provision.py': (1666, 'CB9833D4505874CBA4276A74A9AAD268611B5EBED6DDB101882925547DF82A96'),
})
TEST_IDS = (
    'test_unit.StrictSecrets.test_snapshot_read_once_and_immutable',
    'test_unit.StrictSecrets.test_byte_exact_formats_and_duplicates',
    'test_unit.StrictSecrets.test_failure_precedes_connect',
    'test_unit.StrictSecrets.test_password_public_string_contract',
    'test_unit.StrictSecrets.test_read_error',
    'test_unit.Scram.test_bounds',
    'test_unit.Scram.test_malformed',
    'test_unit.Scram.test_capability_closed_and_error_safe',
    'test_unit.LoggingPreflight.test_valid',
    'test_unit.LoggingPreflight.test_guc_rows',
    'test_unit.LoggingPreflight.test_all_other_gates',
    'test_unit.LoggingPreflight.test_wrong_cluster',
)
_COMMON_ROUTES = frozenset({
    ('os', ()), ('base64', ()), ('re', ()), ('pathlib', ('Path',)),
    ('types', ('MappingProxyType',)), ('psycopg', ()),
})
_PROVISION_ROUTES = frozenset({
    ('pathlib', ('Path',)), ('psycopg', ('sql',)),
    ('common', ('identity', 'ROLES', 'scram_verifier', '_secret_snapshot', '_connect_bootstrap')),
    ('common', ('provisioning_logging_preflight',)),
})


def verify_sources(sources, approval, stop):
    expected = {
        'status': 'OWNER_APPROVED',
        'scope': 'TWELVE_PARENT_UNIT_MOCK_TESTS_ONLY',
        'files': dict(BASELINE),
    }
    if type(approval) is not dict or approval != expected:
        stop()
    if type(sources) is not dict or set(sources) != set(BASELINE):
        stop()
    # Verify BOTH immutable buffers before parsing or compiling either source.
    for name, (size, digest) in BASELINE.items():
        raw = sources[name]
        if (type(raw) is not bytes or len(raw) != size
                or hashlib.sha256(raw).hexdigest().upper() != digest):
            stop()
    return MappingProxyType(dict(sources))


class ParentAdapter:
    def __init__(self, sources, approval, stop):
        # stop must be the trusted launcher's uncatchable process fail-stop,
        # never a test-supplied RuntimeError/Mock or a callback that returns.
        self._stop_callback = stop
        self._sources = verify_sources(sources, approval, self._stop)
        self._active = None
        self._check_source_contract()

    def _stop(self, *_args, **_kwargs):
        self._stop_callback()
        # Defence against a broken stop callback; still never resume the test.
        raise SystemExit(125)

    def _check_source_contract(self):
        for name, routes in (('common.py', _COMMON_ROUTES), ('provision.py', _PROVISION_ROUTES)):
            try:
                tree = ast.parse(self._sources[name], filename='<approved-parent-snapshot>')
                seen = []
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        if len(node.names) != 1 or node.names[0].asname is not None:
                            self._stop()
                        route = (node.names[0].name, ())
                    elif isinstance(node, ast.ImportFrom):
                        if node.level != 0 or any(a.asname is not None for a in node.names):
                            self._stop()
                        route = (node.module, tuple(a.name for a in node.names))
                    else:
                        continue
                    if route not in routes:
                        self._stop()
                    seen.append(route)
                if len(seen) != len(routes) or set(seen) != routes:
                    self._stop()
                if name == 'provision.py':
                    mains = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'main']
                    if len(mains) != 1 or not mains[0].body:
                        self._stop()
                    first = mains[0].body[0]
                    if (not isinstance(first, ast.Assign) or len(first.targets) != 1
                            or not isinstance(first.targets[0], ast.Name) or first.targets[0].id != 'snapshot'
                            or not isinstance(first.value, ast.Call)
                            or not isinstance(first.value.func, ast.Name)
                            or first.value.func.id != '_secret_snapshot'
                            or first.value.args or first.value.keywords):
                        self._stop()
            except Exception:
                self._stop()

    @contextmanager
    def test_scope(self, test_id):
        if self._active is not None or test_id not in TEST_IDS:
            self._stop()
        context = (test_id, object())
        self._active = context
        try:
            # The token is never yielded or passed to a synthetic facade.
            yield
        finally:
            intact = self._active is context
            self._active = None
            if not intact:
                self._stop()

    def load_targets(self):
        context = self._active
        if context is None or context[0] not in TEST_IDS:
            self._stop()

        def require_context():
            if self._active is not context:
                self._stop()

        def denied(*_args, **_kwargs):
            require_context()
            self._stop()

        def facade(name, **attributes):
            module = types.ModuleType(name)
            module.__dict__.update(attributes)
            module.__getattr__ = denied
            return module

        class SyntheticPath:
            _allowed = frozenset({
                '/run/secrets/bootstrap', '/run/secrets/installer', '/run/secrets/runtime',
                '/run/secrets/authority', '/run/secrets/operator',
                'sql', 'sql/00_roles.sql', 'sql/10_boundary.sql',
            })

            def __init__(path, value):
                require_context()
                if type(value) is not str or value not in SyntheticPath._allowed:
                    denied()
                path._value = value

            def __truediv__(path, other):
                require_context()
                if type(other) is not str:
                    denied()
                return SyntheticPath(path._value + '/' + other)

            @property
            def name(path):
                require_context()
                return path._value.rsplit('/', 1)[-1]

            def __str__(path):
                require_context()
                return path._value

            def __repr__(path):
                require_context()
                return '<SyntheticPath>'

            def read_bytes(path):
                denied()

            def read_text(path, **_kwargs):
                denied()

            open = write_bytes = write_text = denied

        # Fresh class and fresh synthetic environment for every setUp/load_targets.
        fake_os = facade('os', environ={})
        fake_sql = facade('psycopg.sql', SQL=denied, Identifier=denied, Literal=denied)
        fake_capabilities = facade('psycopg.capabilities', has_encrypt_password=denied)
        fake_psycopg = facade('psycopg', connect=denied, capabilities=fake_capabilities, sql=fake_sql)
        modules = {
            'os': fake_os,
            'pathlib': facade('pathlib', Path=SyntheticPath),
            'psycopg': fake_psycopg,
            'base64': facade('base64', b64encode=base64.b64encode, b64decode=base64.b64decode),
            're': facade('re', fullmatch=re.fullmatch),
            'types': facade('types', MappingProxyType=MappingProxyType),
        }

        def guarded_import(routes):
            def importing(name, globals=None, locals=None, fromlist=(), level=0):
                require_context()
                if fromlist is None:
                    fromlist = ()
                if (type(name) is not str or type(level) is not int or level != 0
                        or type(fromlist) not in (tuple, list)
                        or any(type(item) is not str for item in fromlist)
                        or (name, tuple(fromlist)) not in routes):
                    denied()
                return modules[name]
            return importing

        names = ('Exception', 'RuntimeError', 'ValueError', 'str', 'bytes', 'isinstance',
                 'len', 'set', 'tuple', 'dict', 'zip', 'any', 'int', 'list')

        def load(name, routes):
            namespace = types.ModuleType('_isolated_parent_' + name[:-3])
            namespace.__file__ = '<approved-parent-snapshot:' + name + '>'
            safe_builtins = {key: getattr(builtins, key) for key in names}
            safe_builtins.update(__import__=guarded_import(routes), print=denied)
            namespace.__dict__['__builtins__'] = safe_builtins
            try:
                code = compile(self._sources[name], namespace.__file__, 'exec', dont_inherit=True, optimize=0)
                exec(code, namespace.__dict__)
            except Exception:
                denied()
            return namespace

        def bind(function):
            def guarded(*args, **kwargs):
                require_context()
                return function(*args, **kwargs)
            return guarded

        common = load('common.py', _COMMON_ROUTES)
        for key in ('_read_secret', 'password', '_secret_snapshot', 'scram_verifier',
                    'provisioning_logging_preflight', 'connect', '_connect_bootstrap',
                    '_connect_with_secret', 'identity'):
            common.__dict__[key] = bind(common.__dict__[key])
        modules['common'] = common
        provision = load('provision.py', _PROVISION_ROUTES)
        original_main = provision.main
        main_used = False

        def early_main_only():
            nonlocal main_used
            require_context()
            if context[0] != 'test_unit.StrictSecrets.test_failure_precedes_connect' or main_used:
                denied()
            main_used = True
            snapshot_mock = provision._secret_snapshot
            connect_mock = provision._connect_bootstrap
            if (not isinstance(snapshot_mock, Mock) or not isinstance(connect_mock, Mock)
                    or type(snapshot_mock.side_effect) is not RuntimeError
                    or snapshot_mock.call_count != 0 or connect_mock.call_count != 0):
                denied()
            expected_error = snapshot_mock.side_effect
            entered = False

            def failing_snapshot():
                nonlocal entered
                require_context()
                if entered:
                    denied()
                entered = True
                snapshot_mock()
                denied()

            with patch.object(provision, '_secret_snapshot', failing_snapshot), \
                    patch.object(provision, '_connect_bootstrap', denied):
                try:
                    original_main()
                except BaseException as error:
                    if (error is not expected_error or not entered
                            or snapshot_mock.call_count != 1 or connect_mock.call_count != 0):
                        denied()
                    raise
                else:
                    denied()

        provision.main = early_main_only
        # No registration of common, provision or fake Psycopg in sys.modules.
        return common, provision
