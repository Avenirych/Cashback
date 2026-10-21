"""CBPT1/CBPR1 integration source. NOT an approved executable launcher.

Trusted configuration below is deliberately incomplete. No env/argv/payload
approval, default loader, capture or provisioning fallback. A separately marked
NEW RECONSTRUCTION bootstrap now exists; it is not approved for execution.
"""
import base64
import hashlib
import os
import sys
import threading
import unittest
from unittest.mock import patch
from types import ModuleType

# These blockers never obtain approval from environment, argv or test payloads.
_REVIEWED_BOOTSTRAP = None
_BOOTSTRAP_SOURCE_SHA256 = None
_OWNER_APPROVAL = None
_CAPTURE_DELIVERY_C = False
_EXACT_EXECUTION_D = False

_FILES = (
    ('common.py', 7558, 10080, '634C1FBCDEE3D5F123901881539A2193B7899CD2053502A12B3152685E3231C0'),
    ('provision.py', 1666, 2224, 'CB9833D4505874CBA4276A74A9AAD268611B5EBED6DDB101882925547DF82A96'),
)
_IDS = (
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


def _stop(*_args, **_kwargs):
    # Fixed bounded output only. Existing controller blocks exit 125 regardless
    # of whether detailed guard-line parsing is available.
    try:
        sys.stderr.buffer.write(b'STOP_PARENT_TEST_INTEGRATION\n')
        sys.stderr.buffer.flush()
    finally:
        os._exit(125)


def _receive():
    # Watchdog and exact restored guard must already be active.
    raw = sys.stdin.buffer.readline(16385)
    if type(raw) is not bytes or len(raw) > 16384:
        _stop()
    if raw.endswith(b'\r\n'):
        body = raw[:-2]
    elif raw.endswith(b'\n'):
        body = raw[:-1]
    else:
        _stop()
    fields = body.split(b'|')
    if len(fields) != 3 or fields[0] != b'CBPT1':
        _stop()
    if sys.stdin.buffer.read(1) != b'':
        _stop()
    sources = {}
    for field, (name, size, encoded_size, digest) in zip(fields[1:], _FILES):
        if len(field) != encoded_size:
            _stop()
        try:
            value = base64.b64decode(field, validate=True)
        except Exception:
            _stop()
        if (base64.b64encode(value) != field or len(value) != size
                or hashlib.sha256(value).hexdigest().upper() != digest):
            _stop()
        sources[name] = value
    # No parent snapshot has been compiled/executed. Both must verify before adapter use.
    return sources


def _emit(message):
    # Callers use fixed literals/index/status/counters only. No exception text.
    data = message.encode('ascii') + b'\n'
    if len(data) > 256 or b'\r' in data or data.count(b'\n') != 1:
        _stop()
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def _load_reviewed_bootstrap():
    # Separate trusted entry source, not a normal sys.path import or .pyc loader.
    # The approved launcher artifact must anchor this exact source hash. The
    # bootstrap's own hash is NOT embedded in itself (no circular hash contract).
    digest = _BOOTSTRAP_SOURCE_SHA256
    if (type(digest) is not str or len(digest) != 64
            or any(c not in '0123456789ABCDEF' for c in digest)):
        _stop()
    path = r'C:\Users\serge\cashback+\infra\finance-security-test\synthetic-harness\security_bootstrap.py'
    with open(path, 'rb') as stream:
        raw = stream.read(262145)
    if len(raw) > 262144 or hashlib.sha256(raw).hexdigest().upper() != digest:
        _stop()
    module = ModuleType('_controller_security_bootstrap')
    module.__file__ = path
    exec(compile(raw, path, 'exec', dont_inherit=True, optimize=0), module.__dict__)
    if module.RECONSTRUCTION != 'NEW RECONSTRUCTION':
        _stop()
    return module.SecurityBootstrap()


class _Result(unittest.TestResult):
    """No traceback formatting or storage, including failed subtests."""
    def __init__(self):
        super().__init__()
        self.ended = self.passed_count = self.failed_count = 0
        self.error_count = self.skipped_count = 0
        self.active = None
        self.failed = self.errored = self.skipped_case = False
        self.success_seen = False

    def startTest(self, test):
        if self.active is not None or self.testsRun >= 12 or test.id() != _IDS[self.testsRun]:
            _stop()
        self.active = test
        self.failed = self.errored = self.skipped_case = False
        self.success_seen = False
        super().startTest(test)
        _emit('CBPR1|TEST_BEGIN|index=%02d' % self.testsRun)

    def _require(self, test):
        if test is not self.active:
            _stop()

    def addSuccess(self, test):
        self._require(test)
        if self.success_seen or self.failed or self.errored or self.skipped_case:
            _stop()
        self.success_seen = True

    def addFailure(self, test, err):
        self._require(test)
        self.failed = True

    def addError(self, test, err):
        self._require(test)
        self.errored = True

    def addSkip(self, test, reason):
        self._require(test)
        self.skipped_case = True

    def addSubTest(self, test, subtest, err):
        self._require(test)
        if err is not None:
            if issubclass(err[0], test.failureException):
                self.failed = True
            else:
                self.errored = True

    def addExpectedFailure(self, test, err):
        _stop()

    def addUnexpectedSuccess(self, test):
        _stop()

    def stopTest(self, test):
        self._require(test)
        if self.errored:
            status = 'ERROR'; self.error_count += 1
        elif self.failed:
            status = 'FAIL'; self.failed_count += 1
        elif self.skipped_case:
            status = 'SKIP'; self.skipped_count += 1
        else:
            if not self.success_seen:
                _stop()
            status = 'PASS'; self.passed_count += 1
        _emit('CBPR1|TEST_END|index=%02d|status=%s' % (self.testsRun, status))
        self.ended += 1
        self.active = None
        super().stopTest(test)


def main():
    timer = threading.Timer(45, lambda: os._exit(124))
    timer.daemon = True
    timer.start()  # Includes guard setup, stdin receive, EOF wait and all tests.
    try:
        if (sys.version_info[:3] != (3, 14, 7)
                or sys.executable.casefold() != r'C:\Python314\python.exe'.casefold()
                or not sys.flags.dont_write_bytecode or not sys.flags.no_user_site
                or not sys.flags.no_site):
            _stop()
        approval = {
            'status': 'OWNER_APPROVED', 'scope': 'TWELVE_PARENT_UNIT_MOCK_TESTS_ONLY',
            'files': {name: (size, digest) for name, size, _, digest in _FILES},
        }
        if (_OWNER_APPROVAL != approval or _CAPTURE_DELIVERY_C is not True
                or _EXACT_EXECUTION_D is not True):
            _stop()

        # A supplied object must not bypass the pinned source and reconstruction
        # approval gate. Keep the old placeholder closed, not an injection route.
        if _REVIEWED_BOOTSTRAP is not None:
            _stop()
        bootstrap = _load_reviewed_bootstrap()
        # Compatibility method name; new code explicitly disclaims equivalence
        # to the missing original. Its reconstruction gate also remains false.
        bootstrap.install_original_guard()
        bootstrap.verify_runtime_and_source_only_imports()
        sources = _receive()
        adapter_module = bootstrap.load_parent_adapter()
        if adapter_module.TEST_IDS != _IDS:
            _stop()
        adapter = adapter_module.ParentAdapter(sources, _OWNER_APPROVAL, _stop)
        test_module = bootstrap.load_test_unit()
        if test_module.__name__ != 'test_unit':
            _stop()
        cases = []
        for test_id in _IDS:
            _, class_name, method_name = test_id.split('.')
            case_class = getattr(test_module, class_name)
            if (case_class.__bases__ != (unittest.TestCase,)
                    or case_class.run is not unittest.TestCase.run):
                _stop()
            case = case_class(method_name)
            if case.id() != test_id:
                _stop()
            cases.append(case)
        if len(cases) != 12:
            _stop()
        result = _Result()
        # Scoped through setUp, body, tearDown and cleanups; restored on failure.
        with patch.object(test_module, 'load_targets', adapter.load_targets):
            _emit('CBPR1|DELIVERY_ACCEPTED')
            _emit('CBPR1|TEST_RUN_STARTED|count=12')
            for case in cases:
                with bootstrap.test_scope(case.id()), adapter.test_scope(case.id()):
                    case.run(result)
                if result.shouldStop:
                    _stop()
        if result.testsRun != 12 or result.ended != 12 or result.active is not None:
            _stop()
        if result.passed_count + result.failed_count + result.error_count + result.skipped_count != 12:
            _stop()
        _emit('CBPR1|TEST_RUN_COMPLETED|started=12|passed=%d|failures=%d|errors=%d|skipped=%d|guards=0' % (
            result.passed_count, result.failed_count, result.error_count, result.skipped_count))
        return 1 if result.failed_count or result.error_count else 0
    finally:
        timer.cancel()


if __name__ == '__main__':
    try:
        exit_code = main()
    except BaseException:
        _stop()
    raise SystemExit(exit_code)
