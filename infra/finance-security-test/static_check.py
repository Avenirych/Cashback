"""Offline checks only: no imports of DB runner, no network/subprocess/SQL."""
import ast
import re
from pathlib import Path
root = Path(__file__).resolve().parent
compose = (root/'compose.yaml').read_text(encoding='utf-8')
assert not re.search(r'^\s*(ports|privileged|network_mode|external):', compose, re.M)
assert 'docker.sock' not in compose
assert 'internal: true' in compose
assert '/docker-entrypoint-initdb.d' not in compose
for old in ['postgres-test-data', 'cashback_docker_test', 'cashback_test', 'DATABASE_URL', 'DB_PASSWORD']:
    assert old not in compose
assert 'FS_' in compose and 'POSTGRES_PASSWORD_FILE' in compose
for p in root.glob('*.py'):
    ast.parse(p.read_text(encoding='utf-8'), filename=str(p))
for p in root.rglob('*'):
    if not p.is_file() or p.suffix == ".whl": continue
    text = p.read_text(encoding='utf-8')
    assert not re.search(r'(?i)(system\s+prune|down\s+-v|volume\s+prune|DROP\s+DATABASE|DROP\s+ROLE)', text), p.name
    assert not re.search(r'(?im)^\s*(?:password|POSTGRES_PASSWORD)\s*[:=]\s*[^$\s]', text), p.name
print('PASS offline syntax and harness denylist checks')

# Offline SQL contract checks (not PostgreSQL parsing/execution).
security = (root/'sql/10_boundary.sql').read_text(encoding='utf-8')
assert '(SELECT open FROM fs_private.admission WHERE id=1) IS NOT TRUE' in security
assert '(SELECT enabled FROM fs_private.auth WHERE id=1) IS NOT TRUE' in security
assert "IF NOT FOUND THEN RAISE EXCEPTION 'CLOSED_MISSING'" in security
assert 'RETURNING generation INTO STRICT result' in security
assert 'SET search_path=pg_catalog,pg_temp' in security
assert 'c.xid=pg_current_xact_id()' in security and 'c.login=session_user' in security
runner = (root/'test_security.py').read_text(encoding='utf-8')
assert 'raise SystemExit(run_checked(main, cleanup))' in runner
assert "assert state()[0] is False" in runner
for p in root.rglob('*'):
    if p.is_file() and p.suffix != ".whl":
        text = p.read_text(encoding='utf-8')
        assert all(line == line.rstrip() for line in text.splitlines()), p.name
print('PASS offline SQL contracts, exit-policy wiring, UTF-8 and whitespace')
