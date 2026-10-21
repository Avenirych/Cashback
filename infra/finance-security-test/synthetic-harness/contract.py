"""Closed manifest, public constants, and synthetic-only fixtures. No I/O at import."""
import re
from datetime import datetime
from pathlib import PureWindowsPath, PurePosixPath

IMAGE_ID = 'sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826'
IMAGE = 'postgres:17-bookworm@' + IMAGE_ID
FORBIDDEN = frozenset({'7696805878431612967', '7695793866029359141'})
SOURCE_FILES = ('common.py', 'provision.py', 'sql/00_roles.sql', 'sql/10_boundary.sql')
POLICY = {
    'log_statement': 'none', 'log_min_error_statement': 'panic',
    'log_min_messages': 'panic', 'log_min_duration_statement': '-1',
    'log_min_duration_sample': '-1', 'log_statement_sample_rate': '0',
    'log_transaction_sample_rate': '0', 'log_duration': 'off',
    'log_parameter_max_length': '0', 'log_parameter_max_length_on_error': '0',
    'debug_print_parse': 'off', 'debug_print_rewritten': 'off',
    'debug_print_plan': 'off', 'log_parser_stats': 'off',
    'log_planner_stats': 'off', 'log_executor_stats': 'off',
    'log_statement_stats': 'off', 'shared_preload_libraries': '',
    'session_preload_libraries': '', 'local_preload_libraries': '',
}

class Blocked(RuntimeError):
    """Only fixed safe messages may be supplied; never database diagnostics."""

class ScenarioFailure(RuntimeError):
    """Unexpected synthetic oracle result; distinct from unavailable admission."""

def utc(value):
    if not isinstance(value, str) or not value:
        raise Blocked('Timestamp missing')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise Blocked('Timezone missing')
    return result

def validate_manifest(m):
    required = {
        'schema', 'run_id', 'project', 'docker_context', 'service',
        'container_name', 'container_id', 'image_reference', 'image_id',
        'volume', 'volume_driver', 'volume_created_at', 'volume_destination',
        'network', 'network_id', 'bootstrap_source', 'bootstrap_destination',
        'database', 'bootstrap_user', 'expected_cluster_id',
        'forbidden_cluster_ids', 'reviewed_source_sha256',
    }
    if (not isinstance(m, dict) or set(m) not in (required, required | {'runner'})
            or type(m['schema']) is not int or m['schema'] != 1):
        raise Blocked('Manifest schema incomplete')
    for key in required - {'schema', 'forbidden_cluster_ids', 'reviewed_source_sha256'}:
        if not isinstance(m[key], str) or not m[key]:
            raise Blocked('Manifest field missing')
    if re.fullmatch(r'[a-f0-9]{16}', m['run_id']) is None:
        raise Blocked('Run ID invalid')
    if m['project'] != 'cashback-synth-' + m['run_id']:
        raise Blocked('Project outside synthetic namespace')
    for key, suffix in [('container_name', '-pg'), ('volume', '-pgdata'), ('network', '-private')]:
        if m[key] != m['project'] + suffix:
            raise Blocked('Ambiguous resource name')
    if any(re.fullmatch(r'[a-f0-9]{64}', m[k]) is None for k in ('container_id', 'network_id')):
        raise Blocked('Exact resource IDs required')
    fixed = {'docker_context': 'desktop-linux', 'service': 'pg',
             'image_reference': IMAGE, 'image_id': IMAGE_ID, 'volume_driver': 'local',
             'volume_destination': '/var/lib/postgresql/data',
             'bootstrap_destination': '/run/secrets/bootstrap',
             'database': 'finance_security_test', 'bootstrap_user': 'fs_bootstrap'}
    if any(m[k] != v for k, v in fixed.items()):
        raise Blocked('Fixed manifest boundary mismatch')
    if (not isinstance(m['forbidden_cluster_ids'], list)
            or len(m['forbidden_cluster_ids']) != len(FORBIDDEN)
            or set(m['forbidden_cluster_ids']) != FORBIDDEN):
        raise Blocked('Forbidden cluster list invalid')
    cluster = m['expected_cluster_id']
    if re.fullmatch(r'[1-9][0-9]{0,19}', cluster) is None or cluster in FORBIDDEN:
        raise Blocked('Approved new cluster identity required')
    utc(m['volume_created_at'])
    # Require a new synthetic-specific directory, never existing secrets paths.
    source = m['bootstrap_source'].replace('\\', '/')
    if (not (PureWindowsPath(source).is_absolute() or PurePosixPath(source).is_absolute())
            or '..' in source.split('/') or ',' in source or '\n' in source
            or source.split('/')[-2:] != [m['project'], 'bootstrap']):
        raise Blocked('Synthetic bootstrap source invalid')
    hashes = m['reviewed_source_sha256']
    if not isinstance(hashes, dict) or set(hashes) != set(SOURCE_FILES):
        raise Blocked('Reviewed source manifest missing')
    if any(not isinstance(v, str) or re.fullmatch(r'[a-f0-9]{64}', v) is None
           for v in hashes.values()):
        raise Blocked('Reviewed source hashes unconfirmed')
    if 'runner' in m:
        r = m['runner']
        if (not isinstance(r, dict) or set(r) != {'container_id','container_name','image_id','image_reference'}
                or any(not isinstance(v,str) or not v for v in r.values())
                or re.fullmatch(r'[a-f0-9]{64}',r['container_id']) is None
                or r['container_id'] == m['container_id']
                or r['container_name'] != m['project']+'-runner'
                or re.fullmatch(r'sha256:[a-f0-9]{64}',r['image_id']) is None
                or r['image_reference'] != r['image_id']):
            raise Blocked('Approved immutable runner identity required')
    return m
