"""UNIT/MOCK only. No Docker, sockets, real secret reads, or database operations.

Requires the separately approved pinned Psycopg environment when later run.
"""
import base64
import types
import unittest
from unittest.mock import patch
from contract import POLICY
from scanner import Scanner, verdict
from targets import load_targets

ROLES = ('bootstrap', 'installer', 'runtime', 'authority', 'operator')

def materials():
    return {name: ('%02x' % (i+1) * 32).encode('ascii') for i, name in enumerate(ROLES)}

def verifier(iterations=4096):
    b64 = lambda x: base64.b64encode(x)
    return (b'SCRAM-SHA-256$' + str(iterations).encode('ascii') + b':' + b64(b's'*16)
            + b'$' + b64(b'k'*32) + b':' + b64(b'v'*32))

class Result:
    def __init__(self, rows): self.rows = rows
    def fetchone(self): return self.rows[0] if self.rows else None
    def fetchall(self): return self.rows

class PreflightDouble:
    closed = False
    autocommit = False
    def __init__(self):
        self.rows = [(k, v, 'command line', False) for k, v in POLICY.items()]
        self.user = ('fs_bootstrap', 'fs_bootstrap')
        self.overrides = self.available = self.audit = self.proconfig = False
        self.extensions = [('plpgsql',)]
        self.fail = False
    def execute(self, query, args=None):
        if self.fail: raise RuntimeError('synthetic-private-diagnostic')
        if query == 'SELECT session_user, current_user': return Result([self.user])
        if 'name = ANY' in query: return Result(self.rows)
        if 'pg_db_role_setting' in query: return Result([(self.overrides,)])
        if 'pg_extension' in query: return Result(self.extensions)
        if 'pg_available_extensions' in query: return Result([(self.available,)])
        if 'pg_settings' in query: return Result([(self.audit,)])
        if 'pg_proc' in query: return Result([(self.proconfig,)])
        raise AssertionError('Unmodelled SELECT')

class StrictSecrets(unittest.TestCase):
    def setUp(self): self.common, self.provision = load_targets()
    def test_snapshot_read_once_and_immutable(self):
        values, calls = materials(), []
        def read(path):
            calls.append(path.name)
            return values[path.name]
        with patch.object(self.common.Path, 'read_bytes', read):
            snap = self.common._secret_snapshot()
            values['bootstrap'] = b'f'*64
            with patch.object(self.common.psycopg, 'connect', return_value=object()) as connect:
                self.common._connect_bootstrap(snap)
                self.assertTrue(connect.call_args.kwargs['password'] == snap['bootstrap'].decode('ascii'))
            for role in ROLES[1:]: self.assertTrue(snap[role] == materials()[role])
            self.assertTrue(calls == list(ROLES))
            self.assertTrue(snap['bootstrap'] != values['bootstrap'])
            with self.assertRaises(TypeError): snap['runtime'] = b'0'*64
    def test_byte_exact_formats_and_duplicates(self):
        invalid = [b'', b'a'*63, b'a'*65, b'\xff'+b'a'*63, b'\xef\xbb\xbf'+b'a'*64,
                   b'g'*64, b' '+b'a'*63, b'a'*64+b'\n', b'a'*64+b'\r\n']
        for value in invalid:
            with self.subTest(case=invalid.index(value)):
                with patch.object(self.common.Path, 'read_bytes', return_value=value):
                    with self.assertRaises(RuntimeError): self.common._secret_snapshot()
        with patch.object(self.common.Path, 'read_bytes', return_value=b'a'*64):
            with self.assertRaises(RuntimeError): self.common._secret_snapshot()
    def test_failure_precedes_connect(self):
        with patch.object(self.provision, '_secret_snapshot', side_effect=RuntimeError('refused')):
            with patch.object(self.provision, '_connect_bootstrap') as connect:
                with self.assertRaises(RuntimeError): self.provision.main()
                self.assertFalse(connect.called)
    def test_password_public_string_contract(self):
        with patch.object(self.common.Path, 'read_bytes', return_value=b'a'*64):
            self.assertIs(type(self.common.password('runtime')), str)
    def test_read_error(self):
        with patch.object(self.common.Path, 'read_bytes', side_effect=OSError('synthetic read failure')):
            with self.assertRaises(OSError): self.common._secret_snapshot()

class Scram(unittest.TestCase):
    def setUp(self): self.common, _ = load_targets()
    def invoke(self, result, *, closed=False, capable=True, error=False):
        method = unittest.mock.Mock(return_value=result)
        if error: method.side_effect = RuntimeError('synthetic-sensitive-error')
        c = types.SimpleNamespace(closed=closed, pgconn=types.SimpleNamespace(encrypt_password=method))
        with patch.object(self.common.psycopg.capabilities, 'has_encrypt_password', return_value=capable):
            value = self.common.scram_verifier(c, 'fs_runtime_login', 'a'*64)
        self.assertTrue(method.call_count == 1)
        self.assertTrue(method.call_args.kwargs == {'algorithm': b'scram-sha-256'})
        self.assertTrue(method.call_args.args == (b'a'*64, b'fs_runtime_login'))
        return value
    def test_bounds(self):
        for n in (4096, 2147483647): self.assertIs(type(self.invoke(verifier(n))), str)
        for n in (0, 4095, 2147483648):
            with self.assertRaises(RuntimeError): self.invoke(verifier(n))
    def test_malformed(self):
        valid = verifier()
        salt = base64.b64encode(b's'*16)
        malformed = [None, valid.decode('ascii'), b'md5'+b'a'*32,
                     valid.replace(b'SCRAM-SHA-256', b'PLAINTEXT'),
                     valid.replace(base64.b64encode(b's'*16), b'!'),
                     valid.replace(base64.b64encode(b's'*16), b''),
                     valid.replace(salt, salt[:-3]+b'x=='),
                     valid.replace(base64.b64encode(b'k'*32), base64.b64encode(b'k'*31)),
                     valid.replace(base64.b64encode(b'v'*32), base64.b64encode(b'v'*33))]
        for index, value in enumerate(malformed):
            with self.subTest(case=index):
                with self.assertRaises(RuntimeError): self.invoke(value)
    def test_capability_closed_and_error_safe(self):
        for kwargs in ({'closed': True}, {'capable': False}, {'error': True}):
            with self.assertRaises(RuntimeError) as caught: self.invoke(verifier(), **kwargs)
            self.assertTrue(str(caught.exception) == 'SCRAM verifier generation refused')

class LoggingPreflight(unittest.TestCase):
    def setUp(self): self.common, _ = load_targets()
    def test_valid(self): self.common.provisioning_logging_preflight(PreflightDouble())
    def test_guc_rows(self):
        for mutation in ('value', 'missing', 'source', 'pending', 'null'):
            c = PreflightDouble()
            if mutation == 'missing': c.rows.pop()
            else:
                row = list(c.rows[0])
                if mutation == 'value': row[1] = 'unexpected'
                if mutation == 'source': row[2] = 'default'
                if mutation == 'pending': row[3] = True
                if mutation == 'null': row[1] = None
                c.rows[0] = tuple(row)
            with self.subTest(case=mutation):
                with self.assertRaises(RuntimeError): self.common.provisioning_logging_preflight(c)
    def test_all_other_gates(self):
        changes = [('overrides', True), ('extensions', [('plpgsql',), ('other',)]),
                   ('available', True), ('audit', True), ('proconfig', True),
                   ('user', ('other', 'fs_bootstrap')), ('user', ('fs_bootstrap', 'other')),
                   ('fail', True), ('closed', True), ('autocommit', True)]
        for name, value in changes:
            c = PreflightDouble(); setattr(c, name, value)
            with self.subTest(case=name):
                with self.assertRaises(RuntimeError) as caught:
                    self.common.provisioning_logging_preflight(c)
                self.assertTrue(str(caught.exception) == 'Provisioning logging preflight refused')
    def test_wrong_cluster(self):
        c = unittest.mock.Mock()
        c.execute.side_effect = [Result([('finance_security_test', 170011)]), Result([('999',)])]
        with patch.dict(self.common.os.environ, {'FS_EXPECTED_CLUSTER': '888'}):
            with self.assertRaises(RuntimeError): self.common.identity(c, bootstrap=True)

class LeakScanner(unittest.TestCase):
    def test_positive_controls_and_incomplete(self):
        scanner = Scanner(); secret = materials()['runtime']; actual = verifier()
        scanner.register(secret); scanner.register(actual)
        for marker in (secret, actual, base64.b64encode(actual), actual.hex().encode('ascii'), actual[16:32]):
            result = scanner.inspect('pg_stderr', b'prefix '+marker, complete=True)
            self.assertTrue(result['leak_detected'])
        self.assertTrue(scanner.inspect('pg_stderr', None, complete=True)['status'] == 'INCONCLUSIVE')
        self.assertTrue(scanner.inspect('pg_stderr', b'', complete=None)['status'] == 'INCONCLUSIVE')
        self.assertTrue(Scanner().inspect('pg_stderr', b'', complete=True)['status'] == 'INCONCLUSIVE')
    def test_complete_bundle_and_client_error(self):
        scanner = Scanner(); scanner.register(materials()['runtime'])
        results = [scanner.inspect(c, b'PASS', complete=True) for c in
                   ('pg_stdout', 'pg_stderr', 'pg_server_logs', 'runner_stdout', 'runner_stderr', 'client_diagnostics')]
        self.assertTrue(verdict(results) == 'PASS')
        self.assertTrue(verdict(results[:-1]) == 'INCONCLUSIVE')
        results[0]['collection_complete'] = False
        self.assertTrue(verdict(results) == 'INCONCLUSIVE')
        self.assertTrue(scanner.inspect('client_diagnostics', materials()['runtime'], complete=True)['status'] == 'FAIL')

if __name__ == '__main__':
    unittest.main()
