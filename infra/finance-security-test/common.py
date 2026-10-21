"""Fixed new-instance endpoint. Never load dotenv/application config."""
import os
import base64
import re
from pathlib import Path
from types import MappingProxyType
import psycopg

ROLES = {'bootstrap':'fs_bootstrap', 'installer':'fs_installer',
         'runtime':'fs_runtime_login','authority':'fs_authority','operator':'fs_operator'}

def _read_secret(role):
    raw = Path('/run/secrets/' + role).read_bytes()
    if re.fullmatch(rb'[0-9A-Fa-f]{64}', raw) is None:
        raise RuntimeError('Invalid secret format')
    return raw

def password(role):
    return _read_secret(role).decode('ascii')

def _secret_snapshot():
    roles = ('bootstrap', 'installer', 'runtime', 'authority', 'operator')
    values = tuple(_read_secret(role) for role in roles)
    if len(set(values)) != len(values):
        raise RuntimeError('Every login requires a distinct NEW secret')
    return MappingProxyType(dict(zip(roles, values)))

def scram_verifier(connection, role_name, value):
    """Return sensitive SCRAM text; never log it or fall back to another format."""
    try:
        if role_name not in ('fs_installer', 'fs_runtime_login', 'fs_authority', 'fs_operator'):
            raise ValueError('Unsupported password role')
        raw = value.encode('ascii')
        if re.fullmatch(rb'[0-9A-Fa-f]{64}', raw) is None:
            raise ValueError('Invalid secret format')
        if connection.closed or not psycopg.capabilities.has_encrypt_password(check=True):
            raise RuntimeError('SCRAM capability unavailable')
        result = connection.pgconn.encrypt_password(
            raw, role_name.encode('ascii'), algorithm=b'scram-sha-256')
        if not isinstance(result, bytes):
            raise ValueError('Unexpected verifier type')
        match = re.fullmatch(
            rb'SCRAM-SHA-256\$([1-9][0-9]{0,9}):([A-Za-z0-9+/]+={0,2})'
            rb'\$([A-Za-z0-9+/]+={0,2}):([A-Za-z0-9+/]+={0,2})', result)
        if match is None or not 4096 <= int(match[1]) <= 2147483647:
            raise ValueError('Invalid verifier structure')
        fields = [base64.b64decode(part, validate=True) for part in match.groups()[1:]]
        if not fields[0] or len(fields[1]) != 32 or len(fields[2]) != 32:
            raise ValueError('Invalid verifier fields')
        if any(base64.b64encode(decoded) != encoded
               for decoded, encoded in zip(fields, match.groups()[1:])):
            raise ValueError('Noncanonical verifier fields')
        return result.decode('ascii')
    except Exception:
        raise RuntimeError('SCRAM verifier generation refused') from None

def provisioning_logging_preflight(c):
    """Check observable policy only; external monitoring remains a trust boundary.

    No repairs, commits, retries, or claim of detecting every possible audit hook.
    Any role/database override is unexpected in this fresh isolated harness.
    """
    policy = {
        'log_statement': 'none',
        'log_min_error_statement': 'panic',
        'log_min_messages': 'panic',
        'log_min_duration_statement': '-1',
        'log_min_duration_sample': '-1',
        'log_statement_sample_rate': '0',
        'log_transaction_sample_rate': '0',
        'log_duration': 'off',
        'log_parameter_max_length': '0',
        'log_parameter_max_length_on_error': '0',
        'debug_print_parse': 'off',
        'debug_print_rewritten': 'off',
        'debug_print_plan': 'off',
        'log_parser_stats': 'off',
        'log_planner_stats': 'off',
        'log_executor_stats': 'off',
        'log_statement_stats': 'off',
        'shared_preload_libraries': '',
        'session_preload_libraries': '',
        'local_preload_libraries': '',
    }
    try:
        if c.closed or c.autocommit:
            raise RuntimeError('Transactional bootstrap connection required')
        if c.execute('SELECT session_user, current_user').fetchone() != (
                'fs_bootstrap', 'fs_bootstrap'):
            raise RuntimeError('Bootstrap identity required')
        rows = c.execute(
            'SELECT name, setting, source, pending_restart '
            'FROM pg_catalog.pg_settings WHERE name = ANY(%s)',
            (list(policy),)).fetchall()
        if len(rows) != len(policy) or {row[0] for row in rows} != set(policy):
            raise RuntimeError('Incomplete logging policy')
        for name, setting, source, pending_restart in rows:
            if (setting != policy[name] or source != 'command line'
                    or pending_restart is not False):
                raise RuntimeError('Logging policy mismatch')
        if c.execute(
                'SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_db_role_setting '
                'WHERE setconfig IS NOT NULL AND cardinality(setconfig) > 0)'
                ).fetchone() != (False,):
            raise RuntimeError('Unexpected role/database overrides')
        extensions = c.execute(
            'SELECT extname FROM pg_catalog.pg_extension').fetchall()
        if extensions != [('plpgsql',)]:
            raise RuntimeError('Unexpected installed extensions')
        # Known observable audit indicators, not proof of absence of all hooks.
        if c.execute(
                "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_available_extensions "
                "WHERE name ILIKE '%audit%' OR name = 'auto_explain')"
                ).fetchone() != (False,):
            raise RuntimeError('Available audit component requires review')
        if c.execute(
                "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_settings "
                "WHERE name ILIKE '%audit%' OR name LIKE 'auto_explain.%')"
                ).fetchone() != (False,):
            raise RuntimeError('Audit settings require review')
        if c.execute(
                'SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_proc '
                'WHERE proconfig IS NOT NULL AND cardinality(proconfig) > 0)'
                ).fetchone() != (False,):
            raise RuntimeError('Function-local settings require review')
    except Exception:
        raise RuntimeError('Provisioning logging preflight refused') from None


def connect(role):
    return _connect_with_secret(role, _read_secret(role))

def _connect_bootstrap(snapshot):
    return _connect_with_secret('bootstrap', snapshot['bootstrap'])

def _connect_with_secret(role, raw):
    if not isinstance(raw, bytes) or re.fullmatch(rb'[0-9A-Fa-f]{64}', raw) is None:
        raise RuntimeError('Invalid secret format')
    return psycopg.connect(host='pg', port=5432, dbname='finance_security_test',
        user=ROLES[role], password=raw.decode('ascii'), connect_timeout=5,
        options='-c statement_timeout=15000 -c lock_timeout=10000')

def identity(c, bootstrap=False):
    expected = os.environ.get('FS_EXPECTED_CLUSTER', '')
    if not expected.isdigit() or expected == '7695793866029359141':
        raise RuntimeError('Reviewed NEW cluster identity required')
    db, version = c.execute("SELECT current_database(), current_setting('server_version_num')::int").fetchone()
    if db != 'finance_security_test' or not 170000 <= version < 180000:
        raise RuntimeError('Wrong isolated target')
    query = 'SELECT system_identifier::text FROM pg_control_system()' if bootstrap else 'SELECT fs_api.cluster_identity()'
    if str(c.execute(query).fetchone()[0]) != expected:
        raise RuntimeError('Cluster identity mismatch')
    c.rollback()
